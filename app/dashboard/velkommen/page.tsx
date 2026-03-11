"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import { type FormEvent, useEffect, useRef, useState } from "react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type ChatMessage = {
  role: "ai" | "user";
  text: string;
};

type WizardAnswers = {
  topic: string;
  grade: string;
  postCount: string;
  specialWishes: string;
};

type WizardStep = 1 | 2 | 3 | 4;

const INITIAL_AI_MESSAGE =
  "Hej og velkommen til GPSløb.dk! 👋 Lad os bygge dit allerførste løb sammen. Hvad skal emnet være?";
const GENERATING_MESSAGE =
  "🪄 Fantastisk! Jeg designer løbet og placerer posterne...";
const MAGIC_DRAFT_STORAGE_KEY = "magicRunDraft";

const STEP_PLACEHOLDERS: Record<WizardStep, string> = {
  1: "Skriv emnet til løbet...",
  2: "Skriv klassetrin eller niveau...",
  3: "Skriv et tal mellem 3 og 10...",
  4: "Skriv eventuelle særlige ønsker...",
};

const STEP_QUESTIONS: Record<Exclude<WizardStep, 4>, string> = {
  1: "Fedt. Hvilket klassetrin skal løbet passe til?",
  2: "Perfekt. Hvor mange poster vil du have med? Skriv et tal mellem 3 og 10.",
  3: "Super. Har du særlige ønsker? (f.eks. mange foto-missioner eller korte quizzer)",
};

const QUICK_REPLIES: Record<WizardStep, readonly string[]> = {
  1: ["Romerriget", "Brøker", "Fotosyntese"],
  2: ["3. klasse", "5. klasse", "Udskoling"],
  3: ["4", "6", "8"],
  4: ["Mange foto-missioner", "Korte quizzer", "Ingen særlige ønsker"],
};

function buildCombinedPrompt(answers: WizardAnswers) {
  return [
    `Emne: ${answers.topic}.`,
    `Klassetrin: ${answers.grade}.`,
    `Antal poster: ${answers.postCount}.`,
    `Særlige ønsker: ${answers.specialWishes}.`,
    "Lav et varieret GPS-løb med quiz-spørgsmål og foto-missioner, hvor læreren selv placerer posterne på kortet bagefter.",
  ].join(" ");
}

export default function VelkommenPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: INITIAL_AI_MESSAGE },
  ]);
  const [prompt, setPrompt] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [answers, setAnswers] = useState<WizardAnswers>({
    topic: "",
    grade: "",
    postCount: "",
    specialWishes: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isWizardComplete, setIsWizardComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const statusRef = useRef<"idle" | "replying" | "generating">("idle");
  const fetchAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const activeStep = isWizardComplete ? 4 : currentStep;
  const isInputDisabled = isLoading || isAiResponding || isWizardComplete;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isAiResponding, isLoading]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current = [];
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
    };
  }, []);

  const queueTimeout = (callback: () => void, delay = 700) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);

    timeoutIdsRef.current.push(timeoutId);
  };

  const queueAiMessage = (text: string, onComplete?: () => void, delay = 700) => {
    statusRef.current = "replying";
    setIsAiResponding(true);
    queueTimeout(() => {
      if (!isMountedRef.current) return;
      setMessages((previous) => [...previous, { role: "ai", text }]);
      setIsAiResponding(false);
      statusRef.current = "idle";
      onComplete?.();
    }, delay);
  };

  const handleGenerate = async (promptOverride?: string) => {
    const trimmedPrompt = (promptOverride ?? prompt).trim();
    if (!trimmedPrompt || isLoading || statusRef.current === "generating") return;

    statusRef.current = "generating";
    setPrompt(trimmedPrompt);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(MAGIC_DRAFT_STORAGE_KEY);
      }

      const controller = new AbortController();
      fetchAbortRef.current = controller;

      const res = await fetch("/api/magi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
        signal: controller.signal,
      });

      let data: unknown = null;
      try {
        data = (await res.json()) as unknown;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const message =
          typeof data === "object" && data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Kunne ikke generere løbet lige nu.";
        throw new Error(message);
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("AI returnerede ingen poster.");
      }

      window.sessionStorage.setItem(MAGIC_DRAFT_STORAGE_KEY, JSON.stringify(data));
      router.push("/dashboard/opret/manuel");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Velkommen-side fejl:", error);
      const message =
        error instanceof Error ? error.message : "Noget gik galt. Prøv igen.";

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(MAGIC_DRAFT_STORAGE_KEY);
      }

      if (!isMountedRef.current) return;
      setErrorMessage(message);
      setMessages((previous) => [
        ...previous,
        {
          role: "ai",
          text: `Det glippede lige. ${message}`,
        },
      ]);
      setIsWizardComplete(false);
      setCurrentStep(4);
    } finally {
      fetchAbortRef.current = null;
      statusRef.current = "idle";
      if (!isMountedRef.current) return;
      setIsLoading(false);
    }
  };

  const submitWizardAnswer = (rawValue: string) => {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue || isAiResponding || isLoading || statusRef.current !== "idle") return;

    setInputValue("");
    setErrorMessage(null);
    setMessages((previous) => [...previous, { role: "user", text: trimmedValue }]);

    if (currentStep === 1) {
      setAnswers((previous) => ({ ...previous, topic: trimmedValue }));
      setCurrentStep(2);
      queueAiMessage(STEP_QUESTIONS[1]);
      return;
    }

    if (currentStep === 2) {
      setAnswers((previous) => ({ ...previous, grade: trimmedValue }));
      setCurrentStep(3);
      queueAiMessage(STEP_QUESTIONS[2]);
      return;
    }

    if (currentStep === 3) {
      const parsedCount = Number.parseInt(trimmedValue, 10);
      if (!Number.isInteger(parsedCount) || parsedCount < 3 || parsedCount > 10) {
        queueAiMessage(
          "Skriv gerne et tal mellem 3 og 10, så jeg ved hvor mange poster jeg skal bygge.",
          undefined,
          350
        );
        return;
      }

      const normalizedCount = String(parsedCount);
      setAnswers((previous) => ({ ...previous, postCount: normalizedCount }));
      setCurrentStep(4);
      queueAiMessage(STEP_QUESTIONS[3]);
      return;
    }

    const nextAnswers = {
      ...answers,
      specialWishes: trimmedValue,
    };

    const combinedPrompt = buildCombinedPrompt(nextAnswers);

    setAnswers(nextAnswers);
    setPrompt(combinedPrompt);
    setIsWizardComplete(true);

    queueAiMessage(GENERATING_MESSAGE, () => {
      void handleGenerate(combinedPrompt);
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitWizardAnswer(inputValue);
  };

  const handleQuickReply = (value: string) => {
    if (isInputDisabled) return;
    void submitWizardAnswer(value);
  };

  return (
    <>
      <style>{".global-ai-chat-button { display: none !important; }"}</style>
      <main
        className={`relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-6 text-white ${poppins.className}`}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover z-0"
        >
          <source src="/magibg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-slate-950/60 z-10" />

        <section className="relative z-20 flex h-[844px] max-h-[90vh] w-full max-w-[390px] flex-col overflow-hidden rounded-[3rem] border-[6px] border-slate-800 bg-slate-950/80 shadow-[0_0_50px_rgba(16,185,129,0.3)] backdrop-blur-xl">
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 h-6 w-36 -translate-x-1/2 rounded-full bg-black/70" />

          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 px-5 pb-4 pt-9 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
                  <span className="font-medium">Online</span>
                </div>
                <h1 className="mt-2 text-lg font-semibold tracking-tight text-white">
                  GPSløb AI Assistent
                </h1>
              </div>

              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/90">
                Trin {activeStep}/4
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <div className="space-y-3">
              {messages.map((message, index) => {
                const isGeneratingBubble =
                  message.role === "ai" && message.text === GENERATING_MESSAGE && isLoading;
                const isUser = message.role === "user";

                return (
                  <div
                    key={`${message.role}-${index}-${message.text}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[82%]">
                      <p
                        className={`mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.2em] ${
                          isUser ? "text-right text-emerald-300/80" : "text-slate-500"
                        }`}
                      >
                        {isUser ? "Dig" : "GPSløb AI"}
                      </p>
                      <div
                        className={`rounded-[1.6rem] px-4 py-3 text-[15px] leading-6 shadow-[0_16px_40px_rgba(2,6,23,0.24)] ${
                          isUser
                            ? "rounded-br-md bg-emerald-500 text-slate-950"
                            : "rounded-bl-md bg-slate-800 text-slate-200"
                        } ${isGeneratingBubble ? "animate-pulse" : ""}`}
                      >
                        <p>{message.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isAiResponding ? (
                <div className="flex justify-start">
                  <div className="max-w-[82%]">
                    <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      GPSløb AI
                    </p>
                    <div className="rounded-[1.6rem] rounded-bl-md bg-slate-800 px-4 py-3 text-slate-200 shadow-[0_16px_40px_rgba(2,6,23,0.24)]">
                      <div className="flex items-center gap-2">
                        <span className="size-2 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.2s]" />
                        <span className="size-2 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.1s]" />
                        <span className="size-2 animate-bounce rounded-full bg-emerald-300" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/95 px-4 pb-4 pt-3">
            {errorMessage ? (
              <div className="mb-3 rounded-[1.4rem] border border-red-400/35 bg-red-500/12 px-4 py-3 text-sm font-medium text-red-100">
                {errorMessage}
              </div>
            ) : null}

            {!isWizardComplete ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {QUICK_REPLIES[currentStep].map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => handleQuickReply(reply)}
                    disabled={isInputDisabled}
                    className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-400/40 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="flex items-end gap-3">
                <div className="flex-1 rounded-[1.9rem] border border-white/10 bg-slate-900/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <input
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    disabled={isInputDisabled}
                    placeholder={
                      isWizardComplete
                        ? "AI bygger løbet..."
                        : STEP_PLACEHOLDERS[currentStep]
                    }
                    className="h-6 w-full bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isInputDisabled || !inputValue.trim()}
                  className="inline-flex h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-slate-400"
                  aria-label="Send svar"
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Send"}
                </button>
              </div>
            </form>

            <p className="mt-3 text-center text-xs text-slate-500">
              Svar på næste spørgsmål eller brug forslagene ovenfor.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
