"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

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
  "Hej og velkommen til GPSl\u00f8b.dk! \u{1F44B} Lad os bygge dit allerf\u00f8rste l\u00f8b sammen. Hvad skal emnet v\u00e6re?";
const GENERATING_MESSAGE =
  "\u{1FA84} Fantastisk! Jeg designer l\u00f8bet og placerer posterne...";

const STEP_TITLES: Record<WizardStep, string> = {
  1: "Emne",
  2: "Klassetrin",
  3: "Antal poster",
  4: "S\u00e6rlige \u00f8nsker",
};

const STEP_PLACEHOLDERS: Record<WizardStep, string> = {
  1: "Skriv emnet til l\u00f8bet...",
  2: "Skriv klassetrin eller niveau...",
  3: "Skriv et tal mellem 3 og 10...",
  4: "Skriv eventuelle s\u00e6rlige \u00f8nsker...",
};

const STEP_QUESTIONS: Record<Exclude<WizardStep, 4>, string> = {
  1: "Fedt. Hvilket klassetrin skal l\u00f8bet passe til?",
  2: "Perfekt. Hvor mange poster vil du have med? Skriv et tal mellem 3 og 10.",
  3: "Super. Har du s\u00e6rlige \u00f8nsker? (f.eks. mange foto-missioner eller korte quizzer)",
};

const QUICK_REPLIES: Record<WizardStep, readonly string[]> = {
  1: ["Romerriget", "Br\u00f8ker", "Fotosyntese"],
  2: ["3. klasse", "5. klasse", "Udskoling"],
  3: ["4", "6", "8"],
  4: ["Mange foto-missioner", "Korte quizzer", "Ingen s\u00e6rlige \u00f8nsker"],
};

function buildCombinedPrompt(answers: WizardAnswers) {
  return [
    `Emne: ${answers.topic}.`,
    `Klassetrin: ${answers.grade}.`,
    `Antal poster: ${answers.postCount}.`,
    `S\u00e6rlige \u00f8nsker: ${answers.specialWishes}.`,
    "Lav et varieret GPS-l\u00f8b med quiz-sp\u00f8rgsm\u00e5l og foto-missioner, hvor l\u00e6reren selv placerer posterne p\u00e5 kortet bagefter.",
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

  const activeStep = isWizardComplete ? 4 : currentStep;
  const isInputDisabled = isLoading || isAiResponding || isWizardComplete;

  const briefPreview = useMemo(
    () => [
      { label: "Emne", value: answers.topic || "Afventer svar" },
      { label: "Klassetrin", value: answers.grade || "Afventer svar" },
      { label: "Poster", value: answers.postCount || "Afventer svar" },
      {
        label: "S\u00e6rlige \u00f8nsker",
        value: answers.specialWishes || "Afventer svar",
      },
    ],
    [answers]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isAiResponding, isLoading]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current = [];
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
    setIsAiResponding(true);
    queueTimeout(() => {
      setMessages((previous) => [...previous, { role: "ai", text }]);
      setIsAiResponding(false);
      onComplete?.();
    }, delay);
  };

  const handleGenerate = async (promptOverride?: string) => {
    const trimmedPrompt = (promptOverride ?? prompt).trim();
    if (!trimmedPrompt || isLoading) return;

    setPrompt(trimmedPrompt);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/magi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const message =
          typeof data === "object" && data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Kunne ikke generere l\u00f8bet lige nu.";
        throw new Error(message);
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("AI returnerede ingen poster.");
      }

      window.sessionStorage.setItem("magicRunDraft", JSON.stringify(data));
      router.push("/dashboard/opret/manuel");
    } catch (error) {
      console.error("Velkommen-side fejl:", error);
      const message =
        error instanceof Error ? error.message : "Noget gik galt. Pr\u00f8v igen.";
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
      setIsLoading(false);
    }
  };

  const submitWizardAnswer = (rawValue: string) => {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue || isAiResponding || isLoading) return;

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
          "Skriv gerne et tal mellem 3 og 10, s\u00e5 jeg ved hvor mange poster jeg skal bygge.",
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
    <main
      className={`relative min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-white md:px-10 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 z-0 h-full w-full object-cover"
        src="/magibg.mp4"
      />
      <div className="fixed inset-0 z-[1] bg-slate-950/72 backdrop-blur-md" />
      <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.08),rgba(2,6,23,0.7))]" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <section className="flex min-h-[760px] flex-col rounded-[2.5rem] border border-emerald-500/15 bg-slate-900/80 p-8 shadow-[0_32px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl md:p-10">
          <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/80">
            Velkomstflow
          </div>

          <div className="mt-6 max-w-3xl">
            <h1
              className={`text-4xl font-black tracking-tight text-white sm:text-5xl ${rubik.className}`}
            >
              Byg dit f\u00f8rste l\u00f8b
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-300 sm:text-lg">
              Svar p\u00e5 fire hurtige sp\u00f8rgsm\u00e5l. S\u00e5 samler vi et skarpt brief og
              bygger dit f\u00f8rste l\u00f8bsudkast sammen.
            </p>
          </div>

          <div className="mt-8 flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-100/60">
                  Samtale
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Step {activeStep} af 4
                </p>
              </div>
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                {isLoading ? "Designer" : isAiResponding ? "Svarer" : "Klar"}
              </div>
            </div>

            <div className="h-[460px] overflow-y-auto px-5 py-6 md:h-[520px]">
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isGeneratingBubble =
                    message.role === "ai" && message.text === GENERATING_MESSAGE && isLoading;

                  return (
                    <div
                      key={`${message.role}-${index}-${message.text}`}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[84%] rounded-[1.7rem] px-5 py-4 text-sm leading-7 shadow-[0_16px_40px_rgba(2,6,23,0.18)] ${
                          message.role === "ai"
                            ? "border border-emerald-500/18 bg-emerald-500/10 text-emerald-50"
                            : "border border-white/10 bg-slate-900 text-slate-100"
                        } ${isGeneratingBubble ? "animate-pulse" : ""}`}
                      >
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                          {message.role === "ai" ? "GPSl\u00f8b AI" : "Dig"}
                        </p>
                        <p>{message.text}</p>
                      </div>
                    </div>
                  );
                })}

                {isAiResponding ? (
                  <div className="flex justify-start">
                    <div className="rounded-[1.7rem] border border-emerald-500/18 bg-emerald-500/10 px-5 py-4 text-emerald-50 shadow-[0_16px_40px_rgba(2,6,23,0.18)]">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                        GPSl\u00f8b AI
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="size-2 animate-bounce rounded-full bg-emerald-200 [animation-delay:-0.2s]" />
                        <span className="size-2 animate-bounce rounded-full bg-emerald-200 [animation-delay:-0.1s]" />
                        <span className="size-2 animate-bounce rounded-full bg-emerald-200" />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-[1.5rem] border border-red-400/35 bg-red-500/12 px-4 py-4 text-sm font-semibold text-red-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6 rounded-[2rem] border border-emerald-500/18 bg-slate-950/68 p-4 shadow-[0_26px_70px_rgba(16,185,129,0.14)]">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-10 -bottom-6 h-16 rounded-full bg-emerald-500/14 blur-3xl" />
                <input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  disabled={isInputDisabled}
                  placeholder={
                    isWizardComplete
                      ? "AI bygger l\u00f8bet..."
                      : STEP_PLACEHOLDERS[currentStep]
                  }
                  className="relative h-16 w-full rounded-[1.4rem] border border-emerald-500/22 bg-slate-900/80 px-5 text-base text-emerald-50 outline-none transition placeholder:text-emerald-100/35 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-900/55 disabled:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {QUICK_REPLIES[currentStep].map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => handleQuickReply(reply)}
                    disabled={isInputDisabled}
                    className="rounded-full border border-emerald-500/18 bg-emerald-500/8 px-4 py-2 text-sm font-medium text-emerald-100/85 transition hover:border-emerald-400/35 hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={isInputDisabled || !inputValue.trim()}
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-emerald-600 px-8 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-white shadow-[0_18px_45px_rgba(16,185,129,0.38)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/60 disabled:text-white/60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Designer l\u00f8bet
                    </>
                  ) : (
                    "Send svar"
                  )}
                </button>

                <p className="text-sm text-slate-400">
                  Tryk Enter for at sende dit svar og f\u00e5 n\u00e6ste sp\u00f8rgsm\u00e5l.
                </p>
              </div>
            </form>
          </div>
        </section>

        <aside className="rounded-[2.5rem] border border-white/10 bg-slate-900/72 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <div className="rounded-[1.9rem] border border-emerald-500/15 bg-slate-950/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/65">
              Velkomststatus
            </p>
            <h2 className={`mt-3 text-2xl font-black text-white ${rubik.className}`}>
              Fire trin til dit f\u00f8rste l\u00f8b
            </h2>
            <div className="mt-6 space-y-3">
              {(Object.entries(STEP_TITLES) as Array<[`${WizardStep}`, string]>).map(
                ([stepKey, title]) => {
                  const stepNumber = Number(stepKey) as WizardStep;
                  const isCurrent = stepNumber === activeStep;
                  const isCompleted = Boolean(
                    (stepNumber === 1 && answers.topic) ||
                      (stepNumber === 2 && answers.grade) ||
                      (stepNumber === 3 && answers.postCount) ||
                      (stepNumber === 4 && answers.specialWishes)
                  );

                  return (
                    <div
                      key={stepKey}
                      className={`rounded-[1.4rem] border px-4 py-4 text-sm transition ${
                        isCurrent
                          ? "border-emerald-400/28 bg-emerald-500/10 text-emerald-50"
                          : isCompleted
                            ? "border-white/10 bg-white/6 text-slate-200"
                            : "border-white/8 bg-slate-900/55 text-slate-400"
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                        Step {stepKey}
                      </p>
                      <p className="mt-1 font-semibold">{title}</p>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          <div className="mt-6 rounded-[1.9rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Brief indtil nu
            </p>
            <div className="mt-4 space-y-4">
              {briefPreview.map((item) => (
                <div key={item.label} className="rounded-[1.2rem] border border-white/10 bg-slate-950/55 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[1.9rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Output
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
              <li>Quiz-poster og foto-missioner med dummy-koordinater.</li>
              <li>Briefet sendes direkte videre til manuel redigering.</li>
              <li>Laereren placerer selv posterne paa kortet bagefter.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
