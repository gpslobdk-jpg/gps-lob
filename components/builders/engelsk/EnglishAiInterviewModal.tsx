"use client";

import { Loader2 } from "lucide-react";
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
const ENGELSK_AI_INTERVIEW_SESSION_KEY = "engelsk_ai_interview_state";

type Step = 1 | 2 | 3 | 4;
type RestorableStep = 1 | 2 | 3;
type SessionDraftState = {
  step?: unknown;
  gradeLevels?: unknown;
  gradeLevel?: unknown;
  englishTopic?: unknown;
  questionCount?: unknown;
};

export type EnglishAiInterviewQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
};

export type EnglishAiInterviewDraft = {
  subject: string;
  title: string;
  questions: EnglishAiInterviewQuestion[];
  gradeLevels: string[];
  englishTopic: string;
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
  topicSuggestions: string[];
  onClose: () => void;
  onComplete: (draft: EnglishAiInterviewDraft) => void;
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

export default function EnglishAiInterviewModal({
  open,
  topicSuggestions,
  onClose,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>(DEFAULT_SELECTED_GRADE_LEVELS);
  const [englishTopic, setEnglishTopic] = useState("");
  const [questionCount, setQuestionCount] =
    useState<(typeof QUESTION_COUNT_OPTIONS)[number]>(DEFAULT_QUESTION_COUNT);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const topicInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const restoredDraft = readSessionDraft<SessionDraftState>(ENGELSK_AI_INTERVIEW_SESSION_KEY);
    const restoredGradeLevels = Array.isArray(restoredDraft?.gradeLevels)
      ? normalizeGradeLevels(restoredDraft.gradeLevels)
      : normalizeGradeLevels(restoredDraft?.gradeLevel);

    setStep(normalizeStep(restoredDraft?.step));
    setGradeLevels(
      restoredGradeLevels.length > 0 ? restoredGradeLevels : DEFAULT_SELECTED_GRADE_LEVELS
    );
    setEnglishTopic(asTrimmedString(restoredDraft?.englishTopic));
    setQuestionCount(normalizeQuestionCount(restoredDraft?.questionCount));
    setError(null);
    setIsGenerating(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    writeSessionDraft(ENGELSK_AI_INTERVIEW_SESSION_KEY, {
      step: step === 4 ? 3 : step,
      gradeLevels,
      englishTopic,
      questionCount,
    } satisfies SessionDraftState);
  }, [englishTopic, gradeLevels, open, questionCount, step]);

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

  const trimmedEnglishTopic = englishTopic.trim();
  const selectedGradeLevelLabel = formatGradeLevelsForPrompt(gradeLevels);
  const canContinueGradeLevels = gradeLevels.length > 0;
  const canContinueTopic = trimmedEnglishTopic.length > 0;
  const progress = (step / 4) * 100;

  const handleClose = () => {
    if (isGenerating) return;
    setError(null);
    clearSessionDraft(ENGELSK_AI_INTERVIEW_SESSION_KEY);
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
        setError("Skriv først hvilket engelskfagligt emne løbet skal fokusere på.");
      return;
    }

    setError(null);
    setStep(3);
  };

  const handleGenerate = async (selectedCount: (typeof QUESTION_COUNT_OPTIONS)[number]) => {
    if (!trimmedEnglishTopic || isGenerating) return;

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
          builderType: "engelsk",
          subject: "Engelsk",
          gradeLevels,
          englishTopic: trimmedEnglishTopic,
          count: selectedCount,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiSuccessResponse | { error?: string } | null;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "AI'en kunne ikke bygge engelsk-løbet lige nu.";
        throw new Error(message);
      }

      if (!isInterviewDraftResponse(payload)) {
        throw new Error("AI'en returnerede et ugyldigt løbsformat.");
      }

      const draftQuestions = payload.questions.map((question) => ({
        question: question.question.trim(),
        options: question.options,
        correctAnswer: question.correctAnswer.trim(),
      }));

      const draft: EnglishAiInterviewDraft = {
        subject: "Engelsk",
        title: payload.title.trim(),
        questions: draftQuestions,
        gradeLevels,
        englishTopic: trimmedEnglishTopic,
      };

      clearSessionDraft(ENGELSK_AI_INTERVIEW_SESSION_KEY);
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
      aria-labelledby="engelsk-ai-interview-title"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_30%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.14),transparent_34%)]" />

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
            <span className="inline-flex items-center gap-2 text-indigo-100">
              <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-[1.05rem] border border-white/85 bg-white p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),inset_0_-6px_12px_rgba(79,70,229,0.08),0_16px_34px_rgba(255,255,255,0.12),0_14px_28px_rgba(99,102,241,0.28)] ring-1 ring-indigo-200/45">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1.5 top-1 h-px rounded-full bg-white/95"
                />
                <img src="/engelskikon4.svg" alt="Engelsk AI" className="h-full w-full object-contain drop-shadow-[0_8px_14px_rgba(30,64,175,0.22)]" />
              </span>
              Engelsk-AI
            </span>
            <span>Trin {step}/4</span>
          </div>

          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-10 rounded-4xl border border-white/10 bg-white/3 px-6 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10 sm:py-14">
            {step === 1 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-indigo-300 uppercase">Trin 1</p>
                <h2
                  id="engelsk-ai-interview-title"
                  className={`mt-5 flex items-center justify-center gap-3 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  <span className="relative inline-flex h-[4.8rem] w-[4.8rem] items-center justify-center overflow-hidden rounded-[1.8rem] border border-white/90 bg-white p-2.5 text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-8px_16px_rgba(79,70,229,0.08),0_24px_52px_rgba(255,255,255,0.14),0_18px_42px_rgba(99,102,241,0.3)] ring-1 ring-indigo-200/55 sm:h-[5.3rem] sm:w-[5.3rem]">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-3 top-1.5 h-px rounded-full bg-white/95"
                    />
                    <img src="/engelskikon4.svg" alt="Engelsk" className="h-full w-full object-contain drop-shadow-[0_12px_20px_rgba(30,64,175,0.24)]" />
                  </span>
                  Hvilket klassetrin er løbet til?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg et eller flere klassetrin, så bygger AI&apos;en engelsk-opgaver i et niveau, der passer til hele gruppen.
                </p>

                <div className="mt-10">
                  <GradeLevelMultiSelect
                    selectedGradeLevels={gradeLevels}
                    onChange={setGradeLevels}
                    tone="indigo"
                    disabled={isGenerating}
                  />
                </div>

                <p className="mt-5 text-sm text-indigo-100/70">
                  Valgt: {selectedGradeLevelLabel}
                </p>

                <div className="mt-10 flex items-center justify-center gap-6">
                  <button
                    type="button"
                    onClick={goToTopicStep}
                    disabled={!canContinueGradeLevels}
                    className="inline-flex min-w-55 items-center justify-center rounded-[1.4rem] border border-indigo-300/30 bg-indigo-400 px-8 py-4 text-lg font-bold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Næste
                  </button>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-indigo-300 uppercase">Trin 2</p>
                <h2
                  id="engelsk-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvilket engelskfagligt emne skal løbet fokusere på?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Beskriv det konkrete emne, for eksempel grammar, vocabulary, reading comprehension eller British & American culture.
                </p>

                <textarea
                  ref={topicInputRef}
                  value={englishTopic}
                  onChange={(event) => setEnglishTopic(event.target.value)}
                  rows={5}
                  placeholder="F.eks. Grammar & Spelling i 5. klasse, Reading Comprehension i 6. klasse eller British & American Culture i 7. klasse."
                  className="mt-10 w-full rounded-[1.8rem] border border-white/10 bg-slate-950/90 px-6 py-5 text-left text-lg text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                />

                {topicSuggestions.length > 0 ? (
                  <div className="mt-6 flex w-full flex-wrap justify-start gap-3">
                    {topicSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setEnglishTopic(suggestion)}
                        className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-300/40 hover:bg-indigo-500/12"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}

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
                    className="inline-flex min-w-55 items-center justify-center rounded-[1.4rem] border border-indigo-300/30 bg-indigo-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Næste
                  </button>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-indigo-300 uppercase">Trin 3</p>
                <h2
                  id="engelsk-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvor mange poster skal engelsk-løbet have?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg længden på løbet. AI&apos;en bygger derefter et komplet sæt engelskfaglige opgaver med entydige svar.
                </p>

                <div className="mx-auto mt-10 grid w-full gap-4 md:grid-cols-3">
                  {QUESTION_COUNT_OPTIONS.map((countOption) => (
                    <button
                      key={countOption}
                      type="button"
                      onClick={() => {
                        void handleGenerate(countOption);
                      }}
                      className="w-full rounded-[1.6rem] border border-white/10 bg-white/4 px-6 py-5 text-lg font-semibold text-white transition hover:border-indigo-300/40 hover:bg-indigo-500/12"
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
                <div className="rounded-full border border-indigo-400/20 bg-indigo-500/12 p-6 text-indigo-300">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <p className="mt-8 text-sm font-semibold tracking-[0.28em] text-indigo-300 uppercase">Trin 4</p>
                <h2
                  id="engelsk-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Genererer dit engelsk-løb...
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vi bygger nu {questionCount} engelskfaglige multiple-choice opgaver til {selectedGradeLevelLabel} om {englishTopic}.
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="mx-auto mt-8 w-full rounded-[1.4rem] border border-indigo-400/20 bg-indigo-500/10 px-5 py-4 text-sm font-semibold text-indigo-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}


