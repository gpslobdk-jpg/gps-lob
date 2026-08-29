"use client";

import { CheckCircle2, CloudOff, Loader2, MapPin, Trophy, XCircle } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

import QuestionTtsButton from "../QuestionTtsButton";
import StudentSubmissionStatus from "../StudentSubmissionStatus";
import TeacherBroadcastModal from "../TeacherBroadcastModal";
import type { PlayActions, PlayUiState } from "../types";
import { wrapTextClass } from "../playUtils";
import PilenConversationCard from "./PilenConversationCard";

type StandardStudentPlayExperienceProps = {
  ui: PlayUiState;
  actions: PlayActions;
  children?: ReactNode;
  onRetrySubmission: () => void;
};

const answerButtonClassName =
  "flex min-h-[62px] w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left text-base font-bold leading-snug transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/80 disabled:cursor-default motion-reduce:transition-none sm:min-h-[66px] sm:px-5 sm:text-lg";

const primaryButtonClassName =
  "inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-base font-black text-slate-950 shadow-[0_16px_36px_rgba(16,185,129,0.28)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/80 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

function StandardProgress({
  postNumber,
  totalPosts,
  progressPercent,
}: {
  postNumber: number;
  totalPosts: number;
  progressPercent: number;
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/14 bg-slate-950/92 px-4 py-3 text-white shadow-[0_16px_44px_rgba(2,6,23,0.4)] backdrop-blur-xl sm:px-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-base font-black sm:text-lg">Post {postNumber} af {totalPosts}</p>
        <p className="text-sm font-bold text-emerald-200">{progressPercent}%</p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/12"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
        />
      </div>
    </div>
  );
}

export default function StandardStudentPlayExperience({
  ui,
  actions,
  children,
  onRetrySubmission,
}: StandardStudentPlayExperienceProps) {
  const [skipConfirmKey, setSkipConfirmKey] = useState<string | null>(null);
  const { progress, flags } = ui;
  const {
    currentPostIndex,
    displayPostNumber,
    totalQuestions,
    dismissedPostIndex,
    showQuestion,
    currentPost,
    feedback,
    theme,
  } = progress;
  const {
    activeQuestion,
    activePostVariant,
    activeQuestionDisplayText,
    activeTypedAnswerKey,
    activeTypedAnswerError,
    activePostActionError,
    activeQuizAnswerFeedback,
    activeQuizPostBurned,
  } = currentPost;
  const {
    studentSubmission,
    latestMessage,
    resumeMessage,
    vm26GoalFeedback,
    wrongAnswerFeedback,
  } = feedback;
  const {
    canManualUnlock,
    gpsOverrideEnabled,
    hasActiveQuizSuccess,
    isClosing,
    isSubmitting,
    isSubmittingAnswer,
    pendingAnswerCount,
  } = flags;
  const isCurrentPostAnswered =
    progress.solvedPostIndexes.includes(currentPostIndex) ||
    progress.answeredPostIndexes.includes(currentPostIndex);
  const routeProgressPercent =
    totalQuestions > 0
      ? Math.round(
          (progress.answeredPostIndexes.length / totalQuestions) * 100,
        )
      : 0;
  const isAnswerSubmissionPending = isSubmittingAnswer || isSubmitting;
  const isSubmissionBlocking = [
    "submitting",
    "queued_offline",
    "awaiting_confirmation",
    "retryable_error",
    "rejected",
    "session_closed",
  ].includes(studentSubmission.status);
  const showPendingAnswerNotice =
    pendingAnswerCount > 0 &&
    studentSubmission.status !== "submitting" &&
    studentSubmission.status !== "queued_offline";
  const canShowEmergencySkip =
    Boolean(activePostActionError) &&
    pendingAnswerCount === 0 &&
    !isCurrentPostAnswered &&
    !hasActiveQuizSuccess &&
    !isSubmissionBlocking;
  const canShowManualOpen =
    !showQuestion &&
    Boolean(activeQuestion) &&
    (gpsOverrideEnabled || dismissedPostIndex === currentPostIndex);
  const skipConfirmOpen = skipConfirmKey === activeTypedAnswerKey;

  return (
    <main
      data-testid="standard-play-v2"
      className="relative h-[100svh] min-h-[100svh] w-full overflow-hidden bg-slate-950 text-white"
    >
      <div className="absolute inset-0 z-0">{children}</div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,rgba(2,6,23,0.76)_0%,rgba(2,6,23,0.08)_30%,rgba(2,6,23,0.04)_62%,rgba(2,6,23,0.7)_100%)]"
      />

      {!showQuestion ? (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
            <div className="pointer-events-auto mx-auto max-w-xl space-y-2">
              {theme?.vm26?.enabled ? (
                <div className="flex items-center gap-2 rounded-2xl border border-amber-200/30 bg-slate-950/90 px-4 py-2 text-sm font-bold text-amber-100 shadow-lg backdrop-blur-xl">
                  <Trophy aria-hidden="true" className="h-4 w-4 text-amber-300" />
                  VM26 – Jagten på pokalen
                </div>
              ) : null}
              <StandardProgress
                postNumber={displayPostNumber}
                totalPosts={totalQuestions}
                progressPercent={routeProgressPercent}
              />
              <StudentSubmissionStatus
                state={studentSubmission}
                onRetry={onRetrySubmission}
                retryDisabled={isAnswerSubmissionPending}
              />
              {showPendingAnswerNotice ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-3 rounded-2xl border border-sky-300/35 bg-sky-500/12 px-4 py-4 text-sm text-sky-50 shadow-sm"
                >
                  <CloudOff aria-hidden="true" className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">Svaret er gemt på telefonen</p>
                    <p className="mt-1 leading-relaxed opacity-90">
                      Det sendes automatisk, når forbindelsen er tilbage.
                    </p>
                  </div>
                </div>
              ) : null}
              {gpsOverrideEnabled ? (
                <div className="rounded-[1.4rem] border border-white/14 bg-slate-950/92 px-4 py-3 shadow-[0_16px_44px_rgba(2,6,23,0.4)] backdrop-blur-xl sm:px-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/80">
                    Det skal du gøre nu
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h1
                        data-testid="standard-play-navigation-title"
                        className="text-2xl font-black leading-tight sm:text-3xl"
                      >
                        Posten er klar
                      </h1>
                      <p className="mt-1 text-sm text-white/72">
                        Åbn posten, når du er klar.
                      </p>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
                      <MapPin aria-hidden="true" className="h-5 w-5" />
                    </span>
                  </div>
                </div>
              ) : null}

              {resumeMessage ? (
                <div className="rounded-2xl border border-emerald-200/25 bg-emerald-950/92 px-4 py-3 text-sm font-semibold text-emerald-50 shadow-lg">
                  {resumeMessage}
                </div>
              ) : null}

              {wrongAnswerFeedback ? (
                <div className="rounded-2xl border border-rose-200/25 bg-rose-950/92 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg">
                  {wrongAnswerFeedback}
                </div>
              ) : null}
            </div>
          </header>

          {canShowManualOpen ? (
            <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[1300] mx-auto max-w-md sm:inset-x-4">
              <button
                type="button"
                disabled={!canManualUnlock}
                onClick={actions.unlockCurrentPost}
                className={primaryButtonClassName}
              >
                <MapPin aria-hidden="true" className="h-5 w-5" />
                {dismissedPostIndex === currentPostIndex ? "Åbn posten igen" : "Åbn post"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {vm26GoalFeedback ? (
        <div className="pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[2400] flex justify-center">
          <div className="rounded-2xl border border-amber-200/50 bg-emerald-950/96 px-5 py-3 text-center text-lg font-black text-amber-100 shadow-xl">
            {vm26GoalFeedback.message}
          </div>
        </div>
      ) : null}

      {showQuestion && activeQuestion ? (
        <section
          data-testid="standard-play-task"
          aria-labelledby="standard-play-question"
          className="absolute inset-0 z-[2000] overflow-y-auto bg-[linear-gradient(180deg,#07111f_0%,#0f172a_100%)] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5"
        >
          <div className="mx-auto flex min-h-full w-full max-w-xl flex-col py-2 sm:justify-center sm:py-5">
            <StandardProgress
              postNumber={displayPostNumber}
              totalPosts={totalQuestions}
              progressPercent={routeProgressPercent}
            />

            {activePostVariant === "character" && activeQuestion.characterConfig ? (
              <div className="mt-3">
                <PilenConversationCard
                  config={activeQuestion.characterConfig}
                  disabled={isAnswerSubmissionPending || isSubmissionBlocking}
                  onCompletePost={actions.completeCharacterPost}
                />
                <div className="mt-4">
                  <StudentSubmissionStatus
                    state={studentSubmission}
                    onRetry={onRetrySubmission}
                    retryDisabled={isAnswerSubmissionPending}
                  />
                </div>
                {activePostActionError ? (
                  <p className={`mt-4 rounded-2xl border border-amber-200/30 bg-amber-500/12 px-4 py-3 text-sm font-semibold text-amber-50 ${wrapTextClass}`}>
                    {activePostActionError}
                  </p>
                ) : null}
              </div>
            ) : (
            <div className="mt-3 rounded-[1.75rem] border border-white/12 bg-slate-900 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.5)] sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/80">
                Opgaven
              </p>

              {activeQuestion.mediaUrl ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src={activeQuestion.mediaUrl}
                    alt="Billede til opgaven"
                    width={800}
                    height={450}
                    className="max-h-[34svh] w-full object-cover"
                    unoptimized
                    loader={({ src }) => src}
                  />
                </div>
              ) : null}

              <div className="mt-4 flex items-start gap-3">
                <h1
                  id="standard-play-question"
                  className={`min-w-0 flex-1 text-2xl font-black leading-tight text-white sm:text-3xl ${wrapTextClass}`}
                >
                  {activeQuestionDisplayText}
                </h1>
                <QuestionTtsButton
                  question={activeQuestion.text}
                  answers={activeQuestion.answers}
                />
              </div>

              <div className="mt-5">
                <StudentSubmissionStatus
                  state={studentSubmission}
                  onRetry={onRetrySubmission}
                  retryDisabled={isAnswerSubmissionPending}
                />
              </div>

              {hasActiveQuizSuccess ? (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="standard-play-answer-success"
                  className="mt-5 rounded-[1.5rem] border border-emerald-200/40 bg-emerald-400 p-5 text-slate-950"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 aria-hidden="true" className="h-7 w-7 shrink-0" />
                    <div>
                      <p className="text-xl font-black">Korrekt! Du får point.</p>
                      <p className="mt-1 text-sm font-semibold">Godt klaret – nu skal du videre.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void actions.continueFromSolvedPost()}
                    className="mt-4 inline-flex min-h-[60px] w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-base font-black text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/90 motion-reduce:transition-none"
                  >
                    {progress.correctAnswersCount < totalQuestions ? "Gå til næste post" : "Se resultat"}
                  </button>
                </div>
              ) : isCurrentPostAnswered || activeQuizPostBurned ? (
                <div className="mt-5 rounded-2xl border border-white/12 bg-white/5 px-4 py-4 text-sm font-semibold text-white/80">
                  Besvaret. Nu går turen videre.
                </div>
              ) : (
                <div className="mt-5 space-y-3" data-testid="standard-play-answers">
                  {activeQuestion.answers.map((answer, index) => {
                    const isSelected = activeQuizAnswerFeedback?.selectedIndex === index;
                    const isCorrect = isSelected && activeQuizAnswerFeedback?.tone === "success";
                    const isWrong = isSelected && activeQuizAnswerFeedback?.tone === "error";
                    const isDimmed = Boolean(activeQuizAnswerFeedback) && !isSelected;

                    return (
                      <button
                        key={`${activeTypedAnswerKey}-${index}`}
                        type="button"
                        aria-label={answer}
                        disabled={
                          isClosing ||
                          Boolean(activeQuizAnswerFeedback) ||
                          isAnswerSubmissionPending ||
                          isSubmissionBlocking
                        }
                        onClick={() => void actions.submitQuizAnswer(index)}
                        className={`${answerButtonClassName} ${
                          isCorrect
                            ? "border-emerald-200 bg-emerald-400 text-slate-950"
                            : isWrong
                              ? "border-rose-200 bg-rose-500 text-white"
                              : isDimmed
                                ? "border-white/8 bg-slate-950/45 text-white/45"
                                : "border-white/16 bg-slate-950 text-white shadow-[0_12px_28px_rgba(2,6,23,0.28)] hover:border-emerald-300/70 hover:bg-slate-800"
                        }`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-white/5 text-sm font-black">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className={`min-w-0 flex-1 ${wrapTextClass}`}>{answer}</span>
                        {isCorrect ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" /> : null}
                        {isWrong ? <XCircle aria-hidden="true" className="h-5 w-5 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeQuizAnswerFeedback?.tone === "error" && !activeQuizPostBurned ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-4 rounded-2xl border border-rose-200/30 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-50"
                >
                  Det var ikke det rigtige svar. Nu går turen videre.
                </p>
              ) : null}

              {activeTypedAnswerError ? (
                <p className={`mt-4 rounded-2xl border border-rose-200/30 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-50 ${wrapTextClass}`}>
                  {activeTypedAnswerError}
                </p>
              ) : null}

              {activePostActionError ? (
                <p className={`mt-4 rounded-2xl border border-amber-200/30 bg-amber-500/12 px-4 py-3 text-sm font-semibold text-amber-50 ${wrapTextClass}`}>
                  {activePostActionError}
                </p>
              ) : null}

              {canShowEmergencySkip ? (
                <div className="mt-5 border-t border-white/10 pt-4 text-center">
                  {!skipConfirmOpen ? (
                    <button
                      type="button"
                      onClick={() => setSkipConfirmKey(activeTypedAnswerKey)}
                      className="inline-flex min-h-[44px] items-center justify-center px-3 text-sm font-semibold text-white/65 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Stadig låst?
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-amber-200/25 bg-amber-500/10 p-4 text-left">
                      <p className="text-sm leading-6 text-amber-50">
                        Som nødløsning kan posten springes over. I får 0 point.
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setSkipConfirmKey(null)}
                          className="min-h-[52px] rounded-2xl border border-white/15 bg-white/5 px-4 font-bold text-white"
                        >
                          Bliv på posten
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSkipConfirmKey(null);
                            void actions.skipCurrentPostAsEmergency();
                          }}
                          className="min-h-[52px] rounded-2xl bg-amber-400 px-4 font-black text-slate-950"
                        >
                          Spring over
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            )}
          </div>
        </section>
      ) : null}

      <TeacherBroadcastModal
        message={latestMessage}
        onDismiss={actions.dismissLatestMessage}
      />

      {isAnswerSubmissionPending && studentSubmission.status === "idle" ? (
        <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[2300] mx-auto flex max-w-sm items-center justify-center gap-2 rounded-2xl border border-amber-200/30 bg-slate-950/96 px-4 py-3 text-sm font-bold text-amber-50 shadow-xl">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Sender svar…
        </div>
      ) : null}
    </main>
  );
}
