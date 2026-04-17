"use client";

import { BookOpenText, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useRef, useState } from "react";

import GradeLevelMultiSelect from "@/components/builders/GradeLevelMultiSelect";
import {
  DEFAULT_SELECTED_GRADE_LEVELS,
  formatGradeLevelsForPrompt,
  normalizeGradeLevels,
  type GradeLevel,
} from "@/utils/gradeLevels";
import {
  clearSessionDraft,
  readSessionDraft,
  writeSessionDraft,
} from "@/utils/runDrafts";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;
const DEFAULT_QUESTION_COUNT: (typeof QUESTION_COUNT_OPTIONS)[number] = 10;
const MANUAL_AI_INTERVIEW_SESSION_KEY = "manual_ai_interview_state";

type Step = 1 | 2 | 3 | 4;
type RestorableStep = 1 | 2 | 3;
type SessionDraftState = {
  step?: unknown;
  gradeLevels?: unknown;
  subject?: unknown;
  topic?: unknown;
  questionCount?: unknown;
};

export type ManualAiInterviewQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
};

export type ManualAiInterviewDraft = {
  subject: string;
  title: string;
  questions: ManualAiInterviewQuestion[];
  gradeLevels: GradeLevel[];
  topic: string;
};

type ApiSuccessResponse = {
  title: string;
  questions: Array<{
    question: string;
    options: [string, string, string, string];
    correctAnswer: string;
  }>;
};

type Props = {
  open: boolean;
  initialSubject?: string;
  initialGradeLevels?: GradeLevel[];
  subjectSuggestions: string[];
  onClose: () => void;
  onComplete: (draft: ManualAiInterviewDraft) => void;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeQuestionCount(value: unknown): (typeof QUESTION_COUNT_OPTIONS)[number] {
  return QUESTION_COUNT_OPTIONS.includes(value as (typeof QUESTION_COUNT_OPTIONS)[number])
    ? (value as (typeof QUESTION_COUNT_OPTIONS)[number])
    : DEFAULT_QUESTION_COUNT;
}

function normalizeStep(value: unknown): RestorableStep {
  return value === 2 || value === 3 ? value : 1;
}

function toOptionsTuple(value: unknown): [string, string, string, string] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;

  const options = value.map((item) => asTrimmedString(item));
  if (options.some((option) => !option)) return null;

  return [options[0]!, options[1]!, options[2]!, options[3]!];
}

function isInterviewDraftResponse(value: unknown): value is ApiSuccessResponse {
  if (!value || typeof value !== "object") return false;

  const candidate = value as {
    title?: unknown;
    questions?: unknown;
  };
  if (!asTrimmedString(candidate.title)) {
    return false;
  }

  if (!Array.isArray(candidate.questions) || candidate.questions.length === 0) {
    return false;
  }

  return candidate.questions.every((question) => {
    if (!question || typeof question !== "object") return false;

    const candidateQuestion = question as {
      question?: unknown;
      options?: unknown;
      correctAnswer?: unknown;
    };

    const options = toOptionsTuple(candidateQuestion.options);
    return Boolean(
      asTrimmedString(candidateQuestion.question) &&
        options &&
        asTrimmedString(candidateQuestion.correctAnswer)
    );
  });
}

export default function ManualAiInterviewModal({
  open,
  initialSubject = "",
  initialGradeLevels = DEFAULT_SELECTED_GRADE_LEVELS,
  subjectSuggestions,
  onClose,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>(DEFAULT_SELECTED_GRADE_LEVELS);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] =
    useState<(typeof QUESTION_COUNT_OPTIONS)[number]>(DEFAULT_QUESTION_COUNT);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const topicInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const restoredDraft = readSessionDraft<SessionDraftState>(MANUAL_AI_INTERVIEW_SESSION_KEY);
    const restoredGradeLevels = normalizeGradeLevels(restoredDraft?.gradeLevels);
    const normalizedInitialGradeLevels = normalizeGradeLevels(initialGradeLevels);

    setStep(normalizeStep(restoredDraft?.step));
    setGradeLevels(
      restoredGradeLevels.length > 0
        ? restoredGradeLevels
        : normalizedInitialGradeLevels.length > 0
          ? normalizedInitialGradeLevels
          : DEFAULT_SELECTED_GRADE_LEVELS
    );
    setSubject(asTrimmedString(restoredDraft?.subject) || initialSubject.trim());
    setTopic(asTrimmedString(restoredDraft?.topic));
    setQuestionCount(normalizeQuestionCount(restoredDraft?.questionCount));
    setError(null);
    setIsGenerating(false);
  }, [initialGradeLevels, initialSubject, open]);

  useEffect(() => {
    if (!open) return;

    writeSessionDraft(MANUAL_AI_INTERVIEW_SESSION_KEY, {
      step: step === 4 ? 3 : step,
      gradeLevels,
      subject,
      topic,
      questionCount,
    } satisfies SessionDraftState);
  }, [gradeLevels, open, questionCount, step, subject, topic]);

  useEffect(() => {
    if (!open || step !== 2) return;

    const timeoutId = window.setTimeout(() => {
      topicInputRef.current?.focus();
    }, 30);

    return () => window.clearTimeout(timeoutId);
  }, [open, step]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  if (!open) return null;

  const trimmedTopic = topic.trim();
  const trimmedSubject = subject.trim();
  const selectedGradeLevelLabel = formatGradeLevelsForPrompt(gradeLevels);
  const canContinueGradeLevels = gradeLevels.length > 0;
  const canContinueTopic = trimmedTopic.length > 0;
  const progress = (step / 4) * 100;

  const handleClose = () => {
    if (isGenerating) return;
    setError(null);
    clearSessionDraft(MANUAL_AI_INTERVIEW_SESSION_KEY);
    onClose();
  };

  const goBack = () => {
    if (isGenerating || step === 1) return;
    setError(null);
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  };

  const goToTopicStep = () => {
    if (!canContinueGradeLevels) {
      setError("Vælg mindst ét klassetrin, før du går videre.");
      return;
    }

    setError(null);
    setStep(2);
  };

  const goToCountStep = () => {
    if (!canContinueTopic) {
      setError("Skriv først hvilket emne quizløbet skal fokusere på.");
      return;
    }

    setError(null);
    setStep(3);
  };

  const handleGenerate = async (selectedCount: (typeof QUESTION_COUNT_OPTIONS)[number]) => {
    if (!trimmedTopic || !canContinueGradeLevels || isGenerating) return;

    setQuestionCount(selectedCount);
    setError(null);
    setStep(4);
    setIsGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/manual-builder/interview", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          builderType: "manual",
          subject: trimmedSubject || undefined,
          gradeLevels,
          manualTopic: trimmedTopic,
          count: selectedCount,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiSuccessResponse | { error?: string } | null;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "AI'en kunne ikke bygge quizløbet lige nu.";
        throw new Error(message);
      }

      if (!isInterviewDraftResponse(payload)) {
        throw new Error("AI'en returnerede et ugyldigt løbsformat.");
      }

      const draft: ManualAiInterviewDraft = {
        subject: trimmedSubject,
        title: asTrimmedString(payload.title),
        questions: payload.questions.map((question) => {
          const candidateQuestion = question as {
            question?: unknown;
            options?: unknown;
            correctAnswer?: unknown;
          };

          return {
            question: asTrimmedString(candidateQuestion.question),
            options: toOptionsTuple(candidateQuestion.options)!,
            correctAnswer: asTrimmedString(candidateQuestion.correctAnswer),
          };
        }),
        gradeLevels,
        topic: trimmedTopic,
      };

      clearSessionDraft(MANUAL_AI_INTERVIEW_SESSION_KEY);
      onComplete(draft);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }

      setStep(3);
      setError(requestError instanceof Error ? requestError.message : "Noget gik galt. Prøv igen.");
    } finally {
      abortRef.current = null;
      setIsGenerating(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-1300 overflow-y-auto bg-slate-950/94 print:hidden ${poppins.className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-ai-interview-title"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_bottom,rgba(6,95,70,0.12),transparent_34%)]" />

      <div className="relative flex min-h-screen items-start justify-center px-6 py-10 sm:items-center">
        <div className="mx-auto w-full max-w-5xl text-center">
          <div className="flex items-center justify-between gap-4 text-xs font-semibold tracking-[0.24em] text-slate-400 uppercase">
            <button
              type="button"
              onClick={handleClose}
              disabled={isGenerating}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Luk
            </button>
            <span className="inline-flex items-center gap-2 text-emerald-200">
              <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-[1.05rem] border border-white/85 bg-white p-1 text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),inset_0_-6px_12px_rgba(6,95,70,0.08),0_16px_34px_rgba(255,255,255,0.12),0_14px_28px_rgba(16,185,129,0.28)] ring-1 ring-emerald-200/45">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1.5 top-1 h-px rounded-full bg-white/95"
                />
                <span className="relative flex h-full w-full items-center justify-center rounded-[0.8rem] bg-linear-to-br from-emerald-100 via-white to-emerald-200">
                  <Sparkles className="h-4.5 w-4.5" />
                </span>
              </span>
              Quiz-assistent
            </span>
            <span>Trin {step}/4</span>
          </div>

          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-10 rounded-4xl border border-white/10 bg-white/3 px-6 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10 sm:py-14">
            {step === 1 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-emerald-300 uppercase">Trin 1</p>
                <h2
                  id="manual-ai-interview-title"
                  className={`mt-5 flex items-center justify-center gap-3 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  <span className="relative inline-flex h-[4.8rem] w-[4.8rem] items-center justify-center overflow-hidden rounded-[1.8rem] border border-white/90 bg-white p-2.5 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-8px_16px_rgba(6,95,70,0.08),0_24px_52px_rgba(255,255,255,0.14),0_18px_42px_rgba(16,185,129,0.3)] ring-1 ring-emerald-200/55 sm:h-[5.3rem] sm:w-[5.3rem]">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-3 top-1.5 h-px rounded-full bg-white/95"
                    />
                    <span className="relative flex h-full w-full items-center justify-center rounded-[1.15rem] bg-linear-to-br from-emerald-100 via-white to-emerald-200 text-emerald-900 shadow-[inset_0_-10px_18px_rgba(16,185,129,0.12)]">
                      <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8" />
                    </span>
                    <span className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-900/10 bg-emerald-500 text-white shadow-[0_8px_18px_rgba(16,185,129,0.35)]">
                      <BookOpenText className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  Hvilket klassetrin er quizløbet til?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg et eller flere klassetrin, så assistenten tilpasser niveau, sprog og sværhedsgrad til den rigtige elevgruppe.
                </p>

                <div className="mt-10">
                  <GradeLevelMultiSelect
                    selectedGradeLevels={gradeLevels}
                    onChange={setGradeLevels}
                    tone="emerald"
                    disabled={isGenerating}
                  />
                </div>

                <p className="mt-5 text-sm text-emerald-100/70">Valgt: {selectedGradeLevelLabel}</p>

                <div className="mt-10 flex items-center justify-center gap-6">
                  <button
                    type="button"
                    onClick={goToTopicStep}
                    disabled={!canContinueGradeLevels}
                    className="inline-flex min-w-55 items-center justify-center rounded-[1.4rem] border border-emerald-300/30 bg-emerald-500 px-8 py-4 text-lg font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Næste
                  </button>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-emerald-300 uppercase">Trin 2</p>
                <h2
                  id="manual-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvilket emne skal quizløbet fokusere på?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg gerne en kategori som hurtig start, og beskriv derefter temaet mere konkret, så udkastet bliver skarpt og brugbart.
                </p>

                <div className="mt-8 rounded-[1.9rem] border border-white/10 bg-slate-950/65 p-5 text-left shadow-[0_22px_52px_rgba(0,0,0,0.24)]">
                  <label className="block text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">
                    Fag / kategori
                  </label>
                  <select
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    disabled={isGenerating}
                    className="mt-3 w-full rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="" className="bg-slate-900 text-white">
                      Vælg fag eller kategori...
                    </option>
                    {subjectSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} className="bg-slate-900 text-white">
                        {suggestion}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  ref={topicInputRef}
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  rows={5}
                  placeholder="F.eks. nordisk mytologi, klima og bæredygtighed, vikingetiden eller en tværfaglig quiz om kroppen."
                  className="mt-8 w-full rounded-[1.8rem] border border-white/10 bg-slate-950/90 px-6 py-5 text-left text-lg text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                />

                <div className="mt-10 flex items-center justify-center gap-6">
                  <button
                    type="button"
                    onClick={goBack}
                    className="text-sm font-semibold text-slate-300 transition hover:text-white"
                  >
                    Tilbage
                  </button>
                  <button
                    type="button"
                    onClick={goToCountStep}
                    disabled={!canContinueTopic}
                    className="inline-flex min-w-55 items-center justify-center rounded-[1.4rem] border border-emerald-300/30 bg-emerald-500 px-8 py-4 text-lg font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Næste
                  </button>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-emerald-300 uppercase">Trin 3</p>
                <h2
                  id="manual-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvor mange poster skal quizløbet have?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg længden på løbet. Assistensen bygger derefter et komplet sæt multiple-choice poster med ét tydeligt korrekt svar pr. post.
                </p>

                <div className="mx-auto mt-8 grid w-full gap-4 rounded-[1.9rem] border border-white/10 bg-slate-950/55 p-5 text-left shadow-[0_22px_52px_rgba(0,0,0,0.24)] sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">Klassetrin</p>
                    <p className="mt-2 text-sm font-semibold text-white">{selectedGradeLevelLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/65 uppercase">Kategori</p>
                    <p className="mt-2 text-sm font-semibold text-white">{trimmedSubject || "Generel quiz"}</p>
                  </div>
                </div>

                <div className="mx-auto mt-10 grid w-full gap-4 md:grid-cols-3">
                  {QUESTION_COUNT_OPTIONS.map((countOption) => (
                    <button
                      key={countOption}
                      type="button"
                      onClick={() => {
                        void handleGenerate(countOption);
                      }}
                      className="w-full rounded-[1.6rem] border border-white/10 bg-white/4 px-6 py-5 text-lg font-semibold text-white transition hover:border-emerald-300/40 hover:bg-emerald-400/10"
                    >
                      {countOption} poster
                    </button>
                  ))}
                </div>

                <div className="mt-10">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={isGenerating}
                    className="text-sm font-semibold text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Tilbage
                  </button>
                </div>
              </>
            ) : null}

            {step === 4 ? (
              <div className="flex min-h-96 flex-col items-center justify-center">
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 p-6 text-emerald-300">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <p className="mt-8 text-sm font-semibold tracking-[0.28em] text-emerald-300 uppercase">Trin 4</p>
                <h2
                  id="manual-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Genererer dit quizløb...
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vi bygger nu {questionCount} quizposter til {selectedGradeLevelLabel}
                  {trimmedSubject ? ` i kategorien ${trimmedSubject}` : ""} om {trimmedTopic}.
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="mx-auto mt-8 w-full rounded-[1.4rem] border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
