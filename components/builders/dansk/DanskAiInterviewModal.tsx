"use client";

import { Loader2 } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useRef, useState } from "react";

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

const GRADE_LEVEL_OPTIONS = [
  "1. klasse",
  "2. klasse",
  "3. klasse",
  "4. klasse",
  "5. klasse",
  "6. klasse",
  "7. klasse",
  "8. klasse",
  "9. klasse",
] as const;

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;
const DEFAULT_QUESTION_COUNT: (typeof QUESTION_COUNT_OPTIONS)[number] = 10;
const DANSK_AI_INTERVIEW_SESSION_KEY = "dansk_ai_interview_state";

type Step = 1 | 2 | 3 | 4;
type RestorableStep = 1 | 2 | 3;
type SessionDraftState = {
  step?: unknown;
  gradeLevel?: unknown;
  danishTopic?: unknown;
  questionCount?: unknown;
};

export type DanskAiInterviewQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
};

export type DanskAiInterviewDraft = {
  subject: string;
  title: string;
  questions: DanskAiInterviewQuestion[];
  gradeLevel: string;
  danishTopic: string;
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
  onComplete: (draft: DanskAiInterviewDraft) => void;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGradeLevel(value: unknown): (typeof GRADE_LEVEL_OPTIONS)[number] {
  return GRADE_LEVEL_OPTIONS.includes(value as (typeof GRADE_LEVEL_OPTIONS)[number])
    ? (value as (typeof GRADE_LEVEL_OPTIONS)[number])
    : "4. klasse";
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

export default function DanskAiInterviewModal({
  open,
  topicSuggestions,
  onClose,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [gradeLevel, setGradeLevel] = useState<(typeof GRADE_LEVEL_OPTIONS)[number]>("4. klasse");
  const [danishTopic, setDanishTopic] = useState("");
  const [questionCount, setQuestionCount] =
    useState<(typeof QUESTION_COUNT_OPTIONS)[number]>(DEFAULT_QUESTION_COUNT);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const topicInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const restoredDraft = readSessionDraft<SessionDraftState>(DANSK_AI_INTERVIEW_SESSION_KEY);

    setStep(normalizeStep(restoredDraft?.step));
    setGradeLevel(normalizeGradeLevel(restoredDraft?.gradeLevel));
    setDanishTopic(asTrimmedString(restoredDraft?.danishTopic));
    setQuestionCount(normalizeQuestionCount(restoredDraft?.questionCount));
    setError(null);
    setIsGenerating(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    writeSessionDraft(DANSK_AI_INTERVIEW_SESSION_KEY, {
      step: step === 4 ? 3 : step,
      gradeLevel,
      danishTopic,
      questionCount,
    } satisfies SessionDraftState);
  }, [danishTopic, gradeLevel, open, questionCount, step]);

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

  const trimmedDanishTopic = danishTopic.trim();
  const canContinueTopic = trimmedDanishTopic.length > 0;
  const progress = (step / 4) * 100;

  const handleClose = () => {
    if (isGenerating) return;
    setError(null);
    clearSessionDraft(DANSK_AI_INTERVIEW_SESSION_KEY);
    onClose();
  };

  const goBack = () => {
    if (isGenerating || step === 1) return;
    setError(null);
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  };

  const handleGradeLevelSelect = (selectedGradeLevel: (typeof GRADE_LEVEL_OPTIONS)[number]) => {
    if (isGenerating) return;

    setGradeLevel(selectedGradeLevel);
    setError(null);
    setStep(2);
  };

  const goToCountStep = () => {
    if (!canContinueTopic) {
      setError("Skriv forst hvilket danskfagligt emne lobet skal fokusere pa.");
      return;
    }

    setError(null);
    setStep(3);
  };

  const handleGenerate = async (selectedCount: (typeof QUESTION_COUNT_OPTIONS)[number]) => {
    if (!trimmedDanishTopic || isGenerating) return;

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
          builderType: "dansk",
          subject: "Dansk",
          gradeLevel,
          danishTopic: trimmedDanishTopic,
          count: selectedCount,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiSuccessResponse | { error?: string } | null;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "AI'en kunne ikke bygge dansk-lobet lige nu.";
        throw new Error(message);
      }

      if (!isInterviewDraftResponse(payload)) {
        throw new Error("AI'en returnerede et ugyldigt lobsformat.");
      }

      const draftQuestions = payload.questions.map((question) => ({
        question: question.question.trim(),
        options: question.options,
        correctAnswer: question.correctAnswer.trim(),
      }));

      const draft: DanskAiInterviewDraft = {
        subject: "Dansk",
        title: payload.title.trim(),
        questions: draftQuestions,
        gradeLevel,
        danishTopic: trimmedDanishTopic,
      };

      clearSessionDraft(DANSK_AI_INTERVIEW_SESSION_KEY);
      onComplete(draft);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }

      setStep(3);
      setError(requestError instanceof Error ? requestError.message : "Noget gik galt. Prov igen.");
    } finally {
      abortRef.current = null;
      setIsGenerating(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-1300 overflow-y-auto bg-slate-950/94 ${poppins.className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dansk-ai-interview-title"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.16),transparent_30%),radial-gradient(circle_at_bottom,rgba(225,29,72,0.12),transparent_34%)]" />

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
            <span className="inline-flex items-center gap-2 text-rose-200">
              <img src="/danskikon4.svg" alt="Dansk AI" className="h-5 w-5 object-contain" />
              Dansk-AI
            </span>
            <span>Trin {step}/4</span>
          </div>

          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-rose-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-10 rounded-4xl border border-white/10 bg-white/3 px-6 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10 sm:py-14">
            {step === 1 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-rose-300 uppercase">Trin 1</p>
                <h2
                  id="dansk-ai-interview-title"
                  className={`mt-5 flex items-center justify-center gap-3 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/10 text-rose-200 shadow-[0_14px_28px_rgba(244,63,94,0.18)] sm:h-14 sm:w-14">
                    <img src="/danskikon4.svg" alt="Dansk" className="h-12 w-12 object-contain" />
                  </span>
                  Hvilket klassetrin er lobet til?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vaelg det praecise klassetrin, sa bygger AI&apos;en opgaverne med det rette danskfaglige niveau.
                </p>

                <div className="mx-auto mt-10 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {GRADE_LEVEL_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleGradeLevelSelect(option)}
                      className="w-full rounded-[1.6rem] border border-white/10 bg-white/4 px-5 py-5 text-base font-semibold text-white transition hover:border-rose-300/40 hover:bg-rose-400/10"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-rose-300 uppercase">Trin 2</p>
                <h2
                  id="dansk-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvilket danskfagligt emne skal lobet fokusere pa?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Beskriv det konkrete emne, for eksempel laeseforstaelse, grammatik, stavning, H.C. Andersen eller analyse.
                </p>

                <textarea
                  ref={topicInputRef}
                  value={danishTopic}
                  onChange={(event) => setDanishTopic(event.target.value)}
                  rows={5}
                  placeholder="F.eks. laeseforstaelse i 4. klasse, nutids-r i 5. klasse eller H.C. Andersen og eventyr i 6. klasse."
                  className="mt-10 w-full rounded-[1.8rem] border border-white/10 bg-slate-950/90 px-6 py-5 text-left text-lg text-white placeholder:text-slate-500 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
                />

                {topicSuggestions.length > 0 ? (
                  <div className="mt-6 flex w-full flex-wrap justify-start gap-3">
                    {topicSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setDanishTopic(suggestion)}
                        className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-400/10"
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
                    className="inline-flex min-w-55 items-center justify-center rounded-[1.4rem] border border-rose-300/30 bg-rose-400 px-8 py-4 text-lg font-bold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Naeste
                  </button>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-rose-300 uppercase">Trin 3</p>
                <h2
                  id="dansk-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvor mange poster skal dansk-lobet have?
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vaelg laengden pa lobet. AI&apos;en bygger derefter et komplet saet danskfaglige opgaver med entydige svar.
                </p>

                <div className="mx-auto mt-10 grid w-full gap-4 md:grid-cols-3">
                  {QUESTION_COUNT_OPTIONS.map((countOption) => (
                    <button
                      key={countOption}
                      type="button"
                      onClick={() => {
                        void handleGenerate(countOption);
                      }}
                      className="w-full rounded-[1.6rem] border border-white/10 bg-white/4 px-6 py-5 text-lg font-semibold text-white transition hover:border-rose-300/40 hover:bg-rose-400/10"
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
                <div className="rounded-full border border-rose-400/20 bg-rose-400/10 p-6 text-rose-300">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <p className="mt-8 text-sm font-semibold tracking-[0.28em] text-rose-300 uppercase">Trin 4</p>
                <h2
                  id="dansk-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Genererer dit dansk-lob...
                </h2>
                <p className="mx-auto mt-5 w-full text-base leading-8 text-slate-300 sm:text-lg">
                  Vi bygger nu {questionCount} danskfaglige multiple-choice opgaver til {gradeLevel} om {danishTopic}.
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