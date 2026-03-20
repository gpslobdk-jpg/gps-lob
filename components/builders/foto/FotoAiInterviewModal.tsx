"use client";

import { Loader2 } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useRef, useState } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const AUDIENCE_OPTIONS = [
  { value: "Indskoling", label: "Indskoling" },
  { value: "Mellemtrin", label: "Mellemtrin" },
  { value: "Udskoling", label: "Udskoling" },
  { value: "Voksne", label: "Voksne" },
] as const;

const TONE_OPTIONS = [
  { value: "sjov", label: "Sjov" },
  { value: "faglig", label: "Faglig" },
  { value: "uhyggelig", label: "Uhyggelig" },
  { value: "action", label: "Action" },
] as const;

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;
const DEFAULT_QUESTION_COUNT: (typeof QUESTION_COUNT_OPTIONS)[number] = 10;

type Step = 1 | 2 | 3 | 4 | 5;

export type FotoAiInterviewDraft = {
  title: string;
  description: string;
  missions: string[];
};

type ApiSuccessResponse = {
  title?: unknown;
  description?: unknown;
  missions?: unknown;
};

type Props = {
  open: boolean;
  initialSubject?: string;
  onClose: () => void;
  onComplete: (draft: FotoAiInterviewDraft) => void;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isInterviewDraftResponse(value: unknown): value is FotoAiInterviewDraft {
  if (!value || typeof value !== "object") return false;

  const candidate = value as ApiSuccessResponse;
  if (!asTrimmedString(candidate.title) || !asTrimmedString(candidate.description)) {
    return false;
  }

  if (!Array.isArray(candidate.missions) || candidate.missions.length === 0) {
    return false;
  }

  return candidate.missions.every((mission) => asTrimmedString(mission).length > 0);
}

export default function FotoAiInterviewModal({
  open,
  initialSubject = "",
  onClose,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState<(typeof AUDIENCE_OPTIONS)[number]["value"]>("Mellemtrin");
  const [tone, setTone] = useState<(typeof TONE_OPTIONS)[number]["value"]>("sjov");
  const [missionCount, setMissionCount] =
    useState<(typeof QUESTION_COUNT_OPTIONS)[number]>(DEFAULT_QUESTION_COUNT);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const topicInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;

    setStep(1);
    setTopic("");
    setAudience("Mellemtrin");
    setTone("sjov");
    setMissionCount(DEFAULT_QUESTION_COUNT);
    setError(null);
    setIsGenerating(false);
  }, [open]);

  useEffect(() => {
    if (!open || step !== 1) return;

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
  const trimmedSubject = initialSubject.trim();
  const canContinue = trimmedTopic.length > 0;
  const progress = (step / 5) * 100;

  const handleClose = () => {
    if (isGenerating) return;
    setError(null);
    onClose();
  };

  const goBack = () => {
    if (isGenerating || step === 1) return;
    setError(null);
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  };

  const goNext = () => {
    if (!canContinue) {
      setError("Skriv først, hvad foto-løbet skal handle om.");
      return;
    }

    setError(null);
    setStep(2);
  };

  const handleAudienceSelect = (selectedAudience: (typeof AUDIENCE_OPTIONS)[number]["value"]) => {
    if (isGenerating) return;

    setAudience(selectedAudience);
    setError(null);
    setStep(3);
  };

  const handleToneSelect = (selectedTone: (typeof TONE_OPTIONS)[number]["value"]) => {
    if (isGenerating) return;

    setTone(selectedTone);
    setError(null);
    setStep(4);
  };

  const handleGenerate = async (selectedCount: (typeof QUESTION_COUNT_OPTIONS)[number]) => {
    if (!trimmedTopic || isGenerating) return;

    setMissionCount(selectedCount);
    setError(null);
    setStep(5);
    setIsGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/foto-mission-builder/interview", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: trimmedTopic,
          subject: trimmedSubject || undefined,
          audience,
          tone,
          count: selectedCount,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiSuccessResponse | { error?: string } | null;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "AI'en kunne ikke bygge foto-løbet lige nu.";
        throw new Error(message);
      }

      if (!isInterviewDraftResponse(payload)) {
        throw new Error("AI'en returnerede et ugyldigt foto-format.");
      }

      onComplete({
        title: asTrimmedString(payload.title),
        description: asTrimmedString(payload.description),
        missions: payload.missions.map((mission) => asTrimmedString(mission)),
      });
      onClose();
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }

      setStep(4);
      setError(requestError instanceof Error ? requestError.message : "Noget gik galt. Prøv igen.");
    } finally {
      abortRef.current = null;
      setIsGenerating(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[1300] overflow-y-auto bg-slate-950/94 ${poppins.className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="foto-ai-interview-title"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_bottom,rgba(56,189,248,0.08),transparent_32%)]" />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-2xl text-center">
          <div className="flex items-center justify-between gap-4 text-xs font-semibold tracking-[0.24em] text-slate-400 uppercase">
            <button
              type="button"
              onClick={handleClose}
              disabled={isGenerating}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Luk
            </button>
            <span>Interview-AI</span>
            <span>Trin {step}/5</span>
          </div>

          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-sky-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10 sm:py-14">
            {step === 1 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-sky-300 uppercase">Trin 1</p>
                <h2
                  id="foto-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvad skal foto-løbet handle om?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Beskriv temaet eller motivverdenen, så bygger AI&apos;en resten.
                </p>

                <textarea
                  ref={topicInputRef}
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  rows={5}
                  placeholder="F.eks. en faglig fotojagt om symmetri i byen eller et sjovt løb om naturfund i skolegården."
                  className="mt-10 w-full rounded-[1.8rem] border border-white/10 bg-slate-950/90 px-6 py-5 text-left text-lg text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                />

                <div className="mt-10">
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canContinue}
                    className="inline-flex min-w-[220px] items-center justify-center rounded-[1.4rem] border border-sky-300/30 bg-sky-400 px-8 py-4 text-lg font-bold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Næste
                  </button>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-sky-300 uppercase">Trin 2</p>
                <h2
                  id="foto-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvem er målgruppen?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg den gruppe, som missionerne skal passe til. Klik på en mulighed for at fortsætte.
                </p>

                <div className="mx-auto mt-10 flex max-w-xl flex-col gap-4">
                  {AUDIENCE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleAudienceSelect(option.value)}
                      className="w-full rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-6 py-5 text-lg font-semibold text-white transition hover:border-sky-300/40 hover:bg-sky-400/10"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="mt-10">
                  <button
                    type="button"
                    onClick={goBack}
                    className="text-sm font-semibold text-slate-300 transition hover:text-white"
                  >
                    Tilbage
                  </button>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-sky-300 uppercase">Trin 3</p>
                <h2
                  id="foto-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvilken stemning skal løbet have?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg en retning, så får foto-missionerne den rigtige energi.
                </p>

                <div className="mx-auto mt-10 flex max-w-xl flex-col gap-4">
                  {TONE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToneSelect(option.value)}
                      className="w-full rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-6 py-5 text-lg font-semibold text-white transition hover:border-sky-300/40 hover:bg-sky-400/10"
                    >
                      {option.label}
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
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-sky-300 uppercase">Trin 4</p>
                <h2
                  id="foto-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvor mange poster skal løbet have?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg længden på foto-løbet. Klik på en mulighed for at starte genereringen.
                </p>

                <div className="mx-auto mt-10 flex max-w-xl flex-col gap-4">
                  {QUESTION_COUNT_OPTIONS.map((countOption) => (
                    <button
                      key={countOption}
                      type="button"
                      onClick={() => {
                        void handleGenerate(countOption);
                      }}
                      className="w-full rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-6 py-5 text-lg font-semibold text-white transition hover:border-sky-300/40 hover:bg-sky-400/10"
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

            {step === 5 ? (
              <div className="flex min-h-[24rem] flex-col items-center justify-center">
                <div className="rounded-full border border-sky-400/20 bg-sky-400/10 p-6 text-sky-300">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <p className="mt-8 text-sm font-semibold tracking-[0.28em] text-sky-300 uppercase">Trin 5</p>
                <h2
                  id="foto-ai-interview-title"
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Genererer dit foto-løb...
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Vi samler nu titel, beskrivelse og {missionCount} skarpe foto-missioner.
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="mx-auto mt-8 max-w-xl rounded-[1.4rem] border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
