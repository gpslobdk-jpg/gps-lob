"use client";

/**
 * /play/[sessionId]/bonus
 *
 * Isoleret bonusspil-side for elever der er færdige før de andre.
 * Kommunikerer KUN med /api/bonus/* — rører ikke normal score eller participants.
 *
 * Flow: loading → intro → quiz → feedback → finished → leaderboard
 *
 * Error-strategi ved svar-submit fejl:
 *   - "Prøv igen": retries det sidst valgte svar
 *   - "Spring over": giver 0 point og fortsætter lokalt (API-fejl blokerer ikke eleven)
 */

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type BonusQuestion = {
  id: string;
  questionIndex: number;
  questionText: string;
  answers: string[];
  points: number;
  mediaUrl: string | null;
};

type BonusSessionInfo = {
  bonusSessionId: string;
  status: string;
  currentIndex: number;
  score: number;
  totalQuestions: number;
  isFinished: boolean;
};

type AnswerResult = {
  isCorrect: boolean;
  pointsAwarded: number;
  score: number;
  currentIndex: number;
  isFinished: boolean;
  nextQuestionIndex: number;
};

type LeaderboardEntry = {
  rank: number;
  studentName: string;
  score: number;
  totalQuestions: number;
  finishedAt: string | null;
};

type Phase =
  | "loading"
  | "intro"
  | "quiz"
  | "feedback"
  | "finished"
  | "leaderboard"
  | "error"
  | "disabled";

type DisabledReason = "bonus_disabled" | "too_few_posts" | null;

// ── BonusPageInner ────────────────────────────────────────────────────────────

function BonusPageInner() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId ?? "";
  const studentName = searchParams.get("name") ?? "Elev";
  const participantId = searchParams.get("participantId") ?? null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("loading");
  const [bonusSession, setBonusSession] = useState<BonusSessionInfo | null>(null);
  const [questions, setQuestions] = useState<BonusQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const lastAttemptedIdx = useRef<number | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [finalTotalQuestions, setFinalTotalQuestions] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [disabledReason, setDisabledReason] = useState<DisabledReason>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // ── Init ───────────────────────────────────────────────────────────────────
  const initBonus = useCallback(async () => {
    setPhase("loading");
    setErrorMsg("");
    setDisabledReason(null);

    try {
      // 1. Create/resume bonus session
      const sessionRes = await fetch("/api/bonus/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, studentName, participantId }),
      });

      if (!sessionRes.ok) {
        const err = (await sessionRes.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
        };
        if (sessionRes.status === 403) {
          setDisabledReason("bonus_disabled");
          setPhase("disabled");
          return;
        }
        if (sessionRes.status === 422) {
          setDisabledReason("too_few_posts");
          setPhase("disabled");
          return;
        }
        throw new Error(err.error ?? "Kunne ikke starte bonusspillet.");
      }

      const sessionData = (await sessionRes.json()) as BonusSessionInfo;
      setBonusSession(sessionData);

      // 2. Fetch questions
      const qRes = await fetch(
        `/api/bonus/questions?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!qRes.ok) {
        const err = (await qRes.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
        };
        if (qRes.status === 403) {
          setDisabledReason("bonus_disabled");
          setPhase("disabled");
          return;
        }
        if (qRes.status === 422) {
          setDisabledReason("too_few_posts");
          setPhase("disabled");
          return;
        }
        throw new Error(err.error ?? "Kunne ikke hente spørgsmål.");
      }

      const qData = (await qRes.json()) as {
        questions: BonusQuestion[];
        totalQuestions: number;
      };
      const qs: BonusQuestion[] = (qData.questions ?? []).map((q) => ({
        id: q.id,
        questionIndex: q.questionIndex,
        questionText: q.questionText,
        answers: q.answers,
        points: q.points,
        mediaUrl: q.mediaUrl ?? null,
      }));

      setQuestions(qs);

      // If already finished, show finished screen
      if (sessionData.isFinished) {
        setFinalScore(sessionData.score);
        setFinalTotalQuestions(sessionData.totalQuestions);
        setPhase("finished");
        return;
      }

      // Resume mid-quiz if needed
      const resumeIdx = Math.max(
        0,
        Math.min(sessionData.currentIndex, qs.length - 1)
      );
      setCurrentQuestionIdx(resumeIdx);
      setSelectedAnswerIdx(null);
      setAnswerResult(null);
      setSubmitError(null);

      setPhase("intro");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Der gik noget galt. Prøv igen."
      );
      setPhase("error");
    }
  }, [sessionId, studentName, participantId]);

  useEffect(() => {
    void initBonus();
  }, [initBonus]);

  // ── Submit answer ──────────────────────────────────────────────────────────
  const submitAnswer = useCallback(
    async (selectedIndex: number) => {
      if (!bonusSession || isSubmitting) return;
      const question = questions[currentQuestionIdx];
      if (!question) return;

      setIsSubmitting(true);
      setSubmitError(null);
      setSelectedAnswerIdx(selectedIndex);
      lastAttemptedIdx.current = selectedIndex;

      try {
        const res = await fetch("/api/bonus/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bonusSessionId: bonusSession.bonusSessionId,
            questionId: question.id,
            questionIndex: question.questionIndex,
            selectedIndex,
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? "Fejl ved svarindsendelse.");
        }

        const result = (await res.json()) as AnswerResult;
        setAnswerResult(result);
        setBonusSession((prev) =>
          prev
            ? {
                ...prev,
                score: result.score,
                currentIndex: result.currentIndex,
                isFinished: result.isFinished,
              }
            : prev
        );
        setPhase("feedback");
      } catch (err) {
        // Reset selection so buttons are re-enabled — student can retry or skip
        setSelectedAnswerIdx(null);
        setSubmitError(
          err instanceof Error ? err.message : "Fejl ved svarindsendelse."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [bonusSession, isSubmitting, questions, currentQuestionIdx]
  );

  // ── Skip question (local — 0 points, never blocks student) ────────────────
  const skipQuestion = useCallback(() => {
    if (!bonusSession) return;
    const question = questions[currentQuestionIdx];
    if (!question) return;

    setSubmitError(null);
    setSelectedAnswerIdx(null);

    const nextIdx = currentQuestionIdx + 1;
    const isLast = nextIdx >= questions.length;

    const localResult: AnswerResult = {
      isCorrect: false,
      pointsAwarded: 0,
      score: bonusSession.score,
      currentIndex: bonusSession.currentIndex,
      isFinished: isLast,
      nextQuestionIndex: question.questionIndex + 1,
    };

    setAnswerResult(localResult);
    setPhase("feedback");
  }, [bonusSession, currentQuestionIdx, questions]);

  // ── Advance after feedback ─────────────────────────────────────────────────
  const advanceAfterFeedback = useCallback(async () => {
    if (!answerResult || !bonusSession) return;

    const nextIdx = currentQuestionIdx + 1;
    const isDone = answerResult.isFinished || nextIdx >= questions.length;

    if (isDone) {
      // Call finish (non-blocking — score shown regardless)
      fetch("/api/bonus/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonusSessionId: bonusSession.bonusSessionId }),
      }).catch(() => undefined);

      setFinalScore(answerResult.score);
      setFinalTotalQuestions(questions.length);
      setPhase("finished");
    } else {
      setCurrentQuestionIdx(nextIdx);
      setSelectedAnswerIdx(null);
      setAnswerResult(null);
      setSubmitError(null);
      setPhase("quiz");
    }
  }, [answerResult, bonusSession, currentQuestionIdx, questions.length]);

  // ── Fetch leaderboard ──────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(
        `/api/bonus/leaderboard?sessionId=${encodeURIComponent(sessionId)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { leaderboard: LeaderboardEntry[] };
        setLeaderboard(data.leaderboard ?? []);
      }
    } catch {
      // Non-blocking
    } finally {
      setLeaderboardLoading(false);
    }
  }, [sessionId]);

  const showLeaderboard = useCallback(async () => {
    setPhase("leaderboard");
    await fetchLeaderboard();
  }, [fetchLeaderboard]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return <LoadingScreen />;
  }

  if (phase === "disabled") {
    return <DisabledScreen reason={disabledReason} sessionId={sessionId} />;
  }

  if (phase === "error") {
    return <ErrorScreen message={errorMsg} onRetry={() => void initBonus()} />;
  }

  if (phase === "intro") {
    return (
      <IntroScreen
        studentName={studentName}
        totalQuestions={questions.length}
        onStart={() => setPhase("quiz")}
      />
    );
  }

  const currentQuestion = questions[currentQuestionIdx] ?? null;

  if (phase === "quiz" && currentQuestion) {
    return (
      <QuizScreen
        question={currentQuestion}
        questionNumber={currentQuestionIdx + 1}
        totalQuestions={questions.length}
        score={bonusSession?.score ?? 0}
        selectedAnswerIdx={selectedAnswerIdx}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onSelectAnswer={(idx) => void submitAnswer(idx)}
        onRetry={() => {
          const idx = lastAttemptedIdx.current;
          if (idx !== null) void submitAnswer(idx);
        }}
        onSkip={skipQuestion}
      />
    );
  }

  if (phase === "feedback" && answerResult) {
    return (
      <FeedbackScreen
        isCorrect={answerResult.isCorrect}
        pointsAwarded={answerResult.pointsAwarded}
        score={answerResult.score}
        isLast={
          answerResult.isFinished ||
          currentQuestionIdx + 1 >= questions.length
        }
        onNext={() => void advanceAfterFeedback()}
      />
    );
  }

  if (phase === "finished") {
    return (
      <FinishedScreen
        score={finalScore}
        totalQuestions={finalTotalQuestions}
        studentName={studentName}
        sessionId={sessionId}
        onShowLeaderboard={() => void showLeaderboard()}
      />
    );
  }

  if (phase === "leaderboard") {
    return (
      <LeaderboardScreen
        leaderboard={leaderboard}
        loading={leaderboardLoading}
        studentName={studentName}
        sessionId={sessionId}
        myScore={finalScore}
        onRefresh={() => void fetchLeaderboard()}
      />
    );
  }

  return <LoadingScreen />;
}

// ── LoadingScreen ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 text-white">
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-yellow-400/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-t-yellow-400 border-r-transparent border-b-transparent border-l-transparent" />
          <div className="absolute inset-4 rounded-full bg-yellow-400/10 animate-pulse" />
        </div>
        <p className="text-sm font-semibold tracking-widest uppercase text-yellow-200/70 animate-pulse">
          Indlæser bonusspil…
        </p>
      </div>
    </div>
  );
}

// ── DisabledScreen ────────────────────────────────────────────────────────────

function DisabledScreen({
  reason,
  sessionId,
}: {
  reason: DisabledReason;
  sessionId: string;
}) {
  const msg =
    reason === "too_few_posts"
      ? "Der er ikke nok spørgsmål til et bonusspil endnu."
      : "Bonusspillet er ikke slået til for dette løb.";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white px-6">
      <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
        <div className="text-6xl select-none">🎮</div>
        <h1 className="text-2xl font-black text-white/90">
          Bonusspil utilgængeligt
        </h1>
        <p className="text-base text-white/60 leading-relaxed">{msg}</p>
        <Link
          href={`/play/${sessionId}`}
          className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-white/20 px-6 py-3 text-sm font-bold text-white/80 hover:bg-white/10 transition-colors"
        >
          ← Tilbage til løbet
        </Link>
      </div>
    </div>
  );
}

// ── ErrorScreen ───────────────────────────────────────────────────────────────

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white px-6">
      <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
        <div className="text-6xl select-none">⚠️</div>
        <h1 className="text-xl font-black text-white/90">Ups!</h1>
        <p className="text-sm text-white/60 leading-relaxed">{message}</p>
        <button
          onClick={onRetry}
          className="mt-2 rounded-2xl bg-yellow-400 px-8 py-3 text-sm font-black text-slate-900 shadow-lg hover:bg-yellow-300 active:scale-95 transition"
        >
          Prøv igen
        </button>
      </div>
    </div>
  );
}

// ── IntroScreen ───────────────────────────────────────────────────────────────

function IntroScreen({
  studentName,
  totalQuestions,
  onStart,
}: {
  studentName: string;
  totalQuestions: number;
  onStart: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 text-white px-6">
      <div className="max-w-sm w-full flex flex-col items-center gap-7 text-center">
        {/* Trophy */}
        <div className="relative">
          <span className="text-8xl select-none drop-shadow-[0_0_32px_rgba(251,191,36,0.55)] animate-bounce inline-block">
            🏆
          </span>
          <div className="pointer-events-none absolute -inset-6 rounded-full bg-yellow-400/10 blur-3xl" />
        </div>

        {/* Badge */}
        <div className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-4 py-1 text-xs font-bold tracking-widest uppercase text-yellow-300">
          Bonus Quiz
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-black text-white sm:text-4xl">
            Færdig før de andre?
          </h1>
          <p className="text-base leading-relaxed text-white/70">
            Prøv bonusspillet og se, om du kan komme øverst på bonuslisten.
          </p>
          {totalQuestions > 0 && (
            <p className="text-sm text-yellow-300/80 font-semibold">
              {totalQuestions} spørgsmål · Svar hurtigt og korrekt
            </p>
          )}
          <p className="text-xs text-white/35">
            Bonuspoint tæller ikke med i dit normale løbsresultat.
          </p>
        </div>

        {/* Name badge */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-2">
          <span className="text-sm text-white/50">Spiller: </span>
          <span className="font-bold text-white">{studentName}</span>
        </div>

        <button
          onClick={onStart}
          className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 py-4 text-base font-black text-slate-900 shadow-[0_8px_32px_rgba(251,191,36,0.35)] hover:brightness-110 active:scale-[0.98] transition"
        >
          Start bonusquiz 🚀
        </button>
      </div>
    </div>
  );
}

// ── QuizScreen ────────────────────────────────────────────────────────────────

const ANSWER_GRADIENT_CLASSES = [
  "from-blue-700 to-blue-600 border-blue-500/40 hover:from-blue-600 hover:to-blue-500",
  "from-emerald-700 to-emerald-600 border-emerald-500/40 hover:from-emerald-600 hover:to-emerald-500",
  "from-orange-700 to-orange-600 border-orange-500/40 hover:from-orange-600 hover:to-orange-500",
  "from-purple-700 to-purple-600 border-purple-500/40 hover:from-purple-600 hover:to-purple-500",
] as const;

const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

function QuizScreen({
  question,
  questionNumber,
  totalQuestions,
  score,
  selectedAnswerIdx,
  isSubmitting,
  submitError,
  onSelectAnswer,
  onRetry,
  onSkip,
}: {
  question: BonusQuestion;
  questionNumber: number;
  totalQuestions: number;
  score: number;
  selectedAnswerIdx: number | null;
  isSubmitting: boolean;
  submitError: string | null;
  onSelectAnswer: (idx: number) => void;
  onRetry: () => void;
  onSkip: () => void;
}) {
  const progressPct = ((questionNumber - 1) / totalQuestions) * 100;
  // Buttons are disabled while submitting or while waiting for feedback (answered, no error)
  const buttonsDisabled = isSubmitting || (selectedAnswerIdx !== null && !submitError);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 backdrop-blur-sm bg-black/30 border-b border-white/5">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-4">
          {/* Progress */}
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-white/50">
              <span>
                Spørgsmål {questionNumber} af {totalQuestions}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          {/* Score pill */}
          <div className="flex-shrink-0 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-black text-yellow-300">
            ⭐ {score}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-4 py-6 mx-auto w-full max-w-lg gap-5">
        {/* Points badge */}
        <div className="self-start rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1 text-xs font-bold text-yellow-300/80">
          +{question.points} point for korrekt svar
        </div>

        {/* Question card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <p className="text-lg font-bold leading-snug text-white sm:text-xl">
            {question.questionText}
          </p>
        </div>

        {/* Answer buttons */}
        <div className="grid grid-cols-1 gap-3">
          {question.answers.map((answer, idx) => (
            <button
              key={idx}
              onClick={() => onSelectAnswer(idx)}
              disabled={buttonsDisabled}
              className={[
                "relative flex items-center gap-4 rounded-2xl border bg-gradient-to-r px-5 py-4 text-left text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed",
                ANSWER_GRADIENT_CLASSES[idx] ??
                  "from-slate-700 to-slate-600 border-slate-500/40",
              ].join(" ")}
            >
              <span className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-black">
                {ANSWER_LABELS[idx]}
              </span>
              <span className="leading-snug">{answer}</span>
              {isSubmitting && selectedAnswerIdx === idx && (
                <span className="ml-auto animate-spin text-base leading-none select-none">
                  ⏳
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Submit error panel */}
        {submitError && (
          <div className="rounded-2xl border border-red-400/30 bg-red-950/40 p-4">
            <p className="mb-3 text-sm font-semibold text-red-300 text-center">
              {submitError}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onRetry}
                className="rounded-xl bg-red-500 px-5 py-2.5 text-xs font-black text-white hover:bg-red-400 active:scale-95 transition"
              >
                Prøv igen
              </button>
              <button
                onClick={onSkip}
                className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-bold text-white/70 hover:bg-white/10 active:scale-95 transition"
              >
                Spring over (0 point)
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/30">
              "Spring over" giver 0 point og fortsætter til næste spørgsmål.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FeedbackScreen ────────────────────────────────────────────────────────────

function FeedbackScreen({
  isCorrect,
  pointsAwarded,
  score,
  isLast,
  onNext,
}: {
  isCorrect: boolean;
  pointsAwarded: number;
  score: number;
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 text-white px-6">
      <div className="max-w-sm w-full flex flex-col items-center gap-6 text-center">
        {/* Emoji */}
        <span
          className={[
            "text-8xl select-none",
            isCorrect ? "animate-bounce" : "",
          ].join(" ")}
        >
          {isCorrect ? "🎉" : "😅"}
        </span>

        {/* Result card */}
        <div
          className={[
            "w-full rounded-2xl border px-6 py-5",
            isCorrect
              ? "border-green-500/30 bg-green-950/40"
              : "border-red-500/30 bg-red-950/40",
          ].join(" ")}
        >
          <p
            className={[
              "text-2xl font-black",
              isCorrect ? "text-green-300" : "text-red-300",
            ].join(" ")}
          >
            {isCorrect ? "Rigtigt!" : "Ikke rigtigt"}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {isCorrect ? `+${pointsAwarded} point` : "0 point denne gang"}
          </p>
        </div>

        {/* Running score */}
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-2.5">
          <span className="text-sm text-white/50">Total score: </span>
          <span className="font-black text-yellow-300">{score} point</span>
        </div>

        <button
          onClick={onNext}
          className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 py-4 text-base font-black text-slate-900 shadow-[0_8px_32px_rgba(251,191,36,0.35)] hover:brightness-110 active:scale-[0.98] transition"
        >
          {isLast ? "Se dit resultat 🏆" : "Næste spørgsmål →"}
        </button>
      </div>
    </div>
  );
}

// ── FinishedScreen ────────────────────────────────────────────────────────────

function FinishedScreen({
  score,
  totalQuestions,
  studentName,
  sessionId,
  onShowLeaderboard,
}: {
  score: number;
  totalQuestions: number;
  studentName: string;
  sessionId: string;
  onShowLeaderboard: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 text-white px-6">
      <div className="max-w-sm w-full flex flex-col items-center gap-7 text-center">
        {/* Trophy */}
        <div className="relative">
          <span className="text-8xl select-none drop-shadow-[0_0_40px_rgba(251,191,36,0.65)] animate-pulse inline-block">
            🏆
          </span>
          <div className="pointer-events-none absolute -inset-6 rounded-full bg-yellow-400/10 blur-3xl" />
        </div>

        {/* Badge */}
        <div className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-4 py-1 text-xs font-bold tracking-widest uppercase text-yellow-300">
          Bonusspil slut!
        </div>

        <h1 className="text-3xl font-black text-white">
          Godt klaret,{" "}
          <span className="text-yellow-300">{studentName}</span>!
        </h1>

        {/* Score card */}
        <div className="w-full rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-6 py-6">
          <p className="text-xs font-bold tracking-widest uppercase text-white/40">
            Din bonus-score
          </p>
          <p className="mt-2 text-6xl font-black text-yellow-300">{score}</p>
          <p className="mt-1 text-sm text-white/40">
            point af {totalQuestions} spørgsmål
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onShowLeaderboard}
            className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 py-4 text-base font-black text-slate-900 shadow-[0_8px_32px_rgba(251,191,36,0.35)] hover:brightness-110 active:scale-[0.98] transition"
          >
            Se bonus-ranglisten 🏅
          </button>
          <Link
            href={`/play/${sessionId}`}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 py-3.5 text-sm font-bold text-white/70 hover:bg-white/10 transition-colors"
          >
            ← Tilbage til løbet
          </Link>
        </div>

        <p className="text-xs text-white/25 text-center">
          Ranglisten opdateres løbende — tryk Opdatér hvis du ikke ser dig selv endnu.
        </p>
      </div>
    </div>
  );
}

// ── LeaderboardScreen ─────────────────────────────────────────────────────────

type RankStyle = { medal: string; cardBg: string; scoreColor: string };

const RANK_STYLES: Record<number, RankStyle> = {
  1: {
    medal: "🥇",
    cardBg: "border-yellow-400/40 bg-yellow-900/20",
    scoreColor: "text-yellow-300",
  },
  2: {
    medal: "🥈",
    cardBg: "border-slate-400/30 bg-slate-800/40",
    scoreColor: "text-slate-300",
  },
  3: {
    medal: "🥉",
    cardBg: "border-orange-400/30 bg-orange-900/20",
    scoreColor: "text-orange-300",
  },
};

function LeaderboardScreen({
  leaderboard,
  loading,
  studentName,
  sessionId,
  myScore,
  onRefresh,
}: {
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  studentName: string;
  sessionId: string;
  myScore: number;
  onRefresh: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-sm bg-black/40 border-b border-white/5">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between gap-4">
          <h1 className="text-lg font-black">🏅 Bonus-rangliste</h1>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-bold text-white/60 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {loading ? "…" : "Opdatér"}
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 mx-auto w-full max-w-lg">
        {/* Loading */}
        {loading && leaderboard.length === 0 && (
          <div className="flex justify-center py-20">
            <div className="animate-spin text-4xl select-none">⏳</div>
          </div>
        )}

        {/* Empty */}
        {!loading && leaderboard.length === 0 && (
          <div className="text-center py-20 flex flex-col items-center gap-4 text-white/40">
            <span className="text-5xl select-none">🎯</span>
            <p className="text-sm">Ingen har afsluttet bonusspillet endnu.</p>
            <p className="text-xs text-white/25">Du er måske den første!</p>
          </div>
        )}

        {/* Entries */}
        {leaderboard.length > 0 && (
          <div className="flex flex-col gap-3">
            {leaderboard.map((entry) => {
              const style = RANK_STYLES[entry.rank];
              const isMe =
                entry.studentName === studentName && entry.score === myScore;

              return (
                <div
                  key={`${entry.rank}-${entry.studentName}-${entry.score}`}
                  className={[
                    "rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all",
                    style
                      ? style.cardBg
                      : "border-white/10 bg-white/5",
                    isMe ? "ring-2 ring-yellow-400/50 shadow-[0_0_20px_rgba(251,191,36,0.15)]" : "",
                  ].join(" ")}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-10 text-center">
                    {style ? (
                      <span className="text-2xl select-none">{style.medal}</span>
                    ) : (
                      <span className="text-base font-black text-white/35">
                        #{entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate leading-tight">
                      {entry.studentName}
                      {isMe && (
                        <span className="ml-2 text-yellow-300 text-xs font-normal">
                          (dig)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">
                      {entry.totalQuestions} spørgsmål
                    </p>
                  </div>

                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <p
                      className={[
                        "text-2xl font-black leading-none",
                        style ? style.scoreColor : "text-white",
                      ].join(" ")}
                    >
                      {entry.score}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">point</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back */}
        <div className="mt-8">
          <Link
            href={`/play/${sessionId}`}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 py-3.5 text-sm font-bold text-white/70 hover:bg-white/10 transition-colors"
          >
            ← Tilbage til løbet
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Page export (Suspense required for useSearchParams in Next.js App Router) ─

export default function BonusPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BonusPageInner />
    </Suspense>
  );
}
