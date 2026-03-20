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

export type RollespilAiInterviewPost = {
  characterName: string;
  avatar: string;
  message: string;
  answer?: string;
};

export type RollespilAiInterviewDraft = {
  title: string;
  description: string;
  posts: RollespilAiInterviewPost[];
};

type ApiSuccessResponse = {
  title?: unknown;
  description?: unknown;
  posts?: unknown;
};

type Props = {
  open: boolean;
  initialSubject?: string;
  onClose: () => void;
  onComplete: (draft: RollespilAiInterviewDraft) => void;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isInterviewDraftResponse(value: unknown): value is RollespilAiInterviewDraft {
  if (!value || typeof value !== "object") return false;

  const candidate = value as ApiSuccessResponse;
  if (!asTrimmedString(candidate.title) || !asTrimmedString(candidate.description)) {
    return false;
  }

  if (!Array.isArray(candidate.posts) || candidate.posts.length === 0) {
    return false;
  }

  return candidate.posts.every((post, index) => {
    if (!post || typeof post !== "object") return false;

    const candidatePost = post as {
      characterName?: unknown;
      avatar?: unknown;
      message?: unknown;
      answer?: unknown;
    };

    const characterName = asTrimmedString(candidatePost.characterName);
    const avatar = asTrimmedString(candidatePost.avatar);
    const message = asTrimmedString(candidatePost.message);
    const answer = asTrimmedString(candidatePost.answer);

    if (!characterName || !avatar || !message) return false;
    if (index === 0) return !answer;
    return Boolean(answer);
  });
}

export default function RollespilAiInterviewModal({
  open,
  initialSubject = "",
  onClose,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState<(typeof AUDIENCE_OPTIONS)[number]["value"]>("Mellemtrin");
  const [tone, setTone] = useState<(typeof TONE_OPTIONS)[number]["value"]>("sjov");
  const [postCount, setPostCount] =
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
    setPostCount(DEFAULT_QUESTION_COUNT);
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
      setError("Skriv først, hvad rollespillet skal handle om.");
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

    setPostCount(selectedCount);
    setError(null);
    setStep(5);
    setIsGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/rollespil-builder/interview", {
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

      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "AI'en kunne ikke bygge rollespillet lige nu.";
        throw new Error(message);
      }

      if (!isInterviewDraftResponse(payload)) {
        throw new Error("AI'en returnerede et ugyldigt rollespilsformat.");
      }

      onComplete({
        title: asTrimmedString(payload.title),
        description: asTrimmedString(payload.description),
        posts: payload.posts.map((post) => {
          const candidatePost = post as {
            characterName?: unknown;
            avatar?: unknown;
            message?: unknown;
            answer?: unknown;
          };

          const answer = asTrimmedString(candidatePost.answer);

          return {
            characterName: asTrimmedString(candidatePost.characterName),
            avatar: asTrimmedString(candidatePost.avatar),
            message: asTrimmedString(candidatePost.message),
            ...(answer ? { answer } : {}),
          };
        }),
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
      aria-labelledby="rollespil-ai-interview-title"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_30%),radial-gradient(circle_at_bottom,rgba(139,92,246,0.08),transparent_32%)]" />

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
              className="h-full rounded-full bg-violet-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-10 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10 sm:py-14">
            {step === 1 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-violet-300 uppercase">Trin 1</p>

                <div className="mx-auto mt-6 max-w-xl rounded-[1.8rem] border border-violet-300/20 bg-violet-400/10 px-6 py-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                  <p className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">
                    Sådan virker det
                  </p>
                  <p className="mt-3 text-base leading-8 text-violet-50/90">
                    Velkommen til Rollespils-byggeren! Her møder eleverne historiske eller fiktive
                    karakterer på deres rute. Den første post er altid en ren intro, hvor
                    historien sættes i gang. På de næste poster stiller karaktererne gåder, hvor
                    svaret er ét simpelt ord for at undgå tastefejl på mobilen.
                  </p>
                </div>

                <h2
                  id="rollespil-ai-interview-title"
                  className={`mt-8 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvad skal rollespillet handle om?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Beskriv kort temaet, den historiske person eller den fiktive verden, så bygger
                  AI&apos;en resten.
                </p>

                <textarea
                  ref={topicInputRef}
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  rows={5}
                  placeholder="F.eks. en rejse til middelalderen, et møde med H.C. Andersen eller et fantasy-løb med en gammel troldmand."
                  className="mt-10 w-full rounded-[1.8rem] border border-white/10 bg-slate-950/90 px-6 py-5 text-left text-lg text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                />

                <div className="mt-10">
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex min-h-[60px] w-full items-center justify-center rounded-full bg-violet-500 px-6 py-4 text-base font-black uppercase tracking-widest text-slate-950 shadow-lg shadow-violet-500/20 transition hover:bg-violet-400"
                  >
                    Næste
                  </button>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-violet-300 uppercase">Trin 2</p>
                <h2
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvem er målgruppen?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Vælg det niveau, som karakterernes sprog og gåder skal ramme.
                </p>

                <div className="mt-12 grid gap-4">
                  {AUDIENCE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleAudienceSelect(option.value)}
                      className="flex min-h-[88px] w-full items-center justify-center rounded-[1.75rem] border border-violet-300/20 bg-violet-400/10 px-6 py-5 text-center text-xl font-bold text-white transition hover:border-violet-300/40 hover:bg-violet-400/15"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-violet-300 uppercase">Trin 3</p>
                <h2
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvilken stemning skal løbet have?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Tonen farver karaktererne og historien, men løbet forbliver let at spille på
                  mobilen.
                </p>

                <div className="mt-12 grid gap-4">
                  {TONE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToneSelect(option.value)}
                      className="flex min-h-[88px] w-full items-center justify-center rounded-[1.75rem] border border-violet-300/20 bg-violet-400/10 px-6 py-5 text-center text-xl font-bold text-white transition hover:border-violet-300/40 hover:bg-violet-400/15"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-violet-300 uppercase">Trin 4</p>
                <h2
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Hvor mange poster skal løbet have?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  Den første post bliver introen, og resten bliver karakterdrevne gåder.
                </p>

                <div className="mt-12 grid gap-4">
                  {QUESTION_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => void handleGenerate(count)}
                      className="flex min-h-[88px] w-full items-center justify-center rounded-[1.75rem] border border-violet-300/20 bg-violet-400/10 px-6 py-5 text-center text-xl font-bold text-white transition hover:border-violet-300/40 hover:bg-violet-400/15"
                    >
                      {count} poster
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <p className="text-sm font-semibold tracking-[0.28em] text-violet-300 uppercase">Trin 5</p>
                <h2
                  className={`mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl ${rubik.className}`}
                >
                  Genererer dit rollespil...
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                  AI&apos;en skriver nu en intro-post, finder på karakterer og bygger resten af
                  ruten med korte, mobilvenlige svar.
                </p>

                <div className="mt-12 flex justify-center">
                  <div className="rounded-[1.8rem] border border-violet-300/20 bg-violet-400/10 px-10 py-10 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-100" />
                  </div>
                </div>
              </>
            ) : null}

            {error ? (
              <div className="mt-8 rounded-[1.5rem] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="mt-8 flex justify-between gap-4">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1 || isGenerating}
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tilbage
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isGenerating}
                className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Luk
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
