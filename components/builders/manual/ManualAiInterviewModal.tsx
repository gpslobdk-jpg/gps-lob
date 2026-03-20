"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookText,
  GraduationCap,
  Loader2,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";
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
  {
    value: "Indskoling",
    label: "Indskoling",
    helper: "Meget enkelt sprog, korte spørgsmål og legende tempo.",
  },
  {
    value: "Mellemtrin",
    label: "Mellemtrin",
    helper: "Bredt niveau med tydelig faglighed og energi.",
  },
  {
    value: "Udskoling",
    label: "Udskoling",
    helper: "Mere nuancerede spørgsmål og lidt skarpere svarmuligheder.",
  },
  {
    value: "Ungdomsuddannelse",
    label: "Ungdomsuddannelse",
    helper: "Avanceret tone med mere analytisk tyngde.",
  },
] as const;

const TONE_OPTIONS = [
  {
    value: "sjov",
    label: "Sjov",
    helper: "Let, energisk og motiverende.",
  },
  {
    value: "faglig",
    label: "Faglig",
    helper: "Klar, skarp og undervisningsnær.",
  },
  {
    value: "uhyggelig",
    label: "Uhyggelig",
    helper: "Spænding, mystik og dramatisk stemning.",
  },
  {
    value: "historisk",
    label: "Historisk",
    helper: "Fortællende, stemningsfuld og tidsforankret.",
  },
  {
    value: "eventyrlig",
    label: "Eventyrlig",
    helper: "Fantasi, opdagelse og små overraskelser.",
  },
] as const;

const QUESTION_COUNT_OPTIONS = [4, 6, 8, 10] as const;

type Step = 1 | 2 | 3 | 4;

export type ManualAiInterviewQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
};

export type ManualAiInterviewDraft = {
  subject: string;
  title: string;
  description: string;
  questions: ManualAiInterviewQuestion[];
};

type ApiSuccessResponse = {
  title?: unknown;
  description?: unknown;
  questions?: unknown;
};

type Props = {
  open: boolean;
  initialSubject?: string;
  subjectSuggestions: string[];
  onClose: () => void;
  onComplete: (draft: ManualAiInterviewDraft) => void;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toOptionsTuple(value: unknown): [string, string, string, string] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;

  const options = value.map((item) => asTrimmedString(item));
  if (options.some((option) => !option)) return null;

  return [options[0]!, options[1]!, options[2]!, options[3]!];
}

function isInterviewDraftResponse(value: unknown): value is ManualAiInterviewDraft {
  if (!value || typeof value !== "object") return false;

  const candidate = value as ApiSuccessResponse & { subject?: unknown };
  if (!asTrimmedString(candidate.title) || !asTrimmedString(candidate.description)) {
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
  subjectSuggestions,
  onClose,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [audience, setAudience] = useState<(typeof AUDIENCE_OPTIONS)[number]["value"]>("Mellemtrin");
  const [tone, setTone] = useState<(typeof TONE_OPTIONS)[number]["value"]>("sjov");
  const [questionCount, setQuestionCount] = useState<(typeof QUESTION_COUNT_OPTIONS)[number]>(6);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;

    setStep(1);
    setTopic("");
    setSubject(initialSubject);
    setAudience("Mellemtrin");
    setTone("sjov");
    setQuestionCount(6);
    setError(null);
    setIsGenerating(false);
  }, [initialSubject, open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  if (!open) return null;

  const selectedAudience = AUDIENCE_OPTIONS.find((option) => option.value === audience) ?? AUDIENCE_OPTIONS[1];
  const selectedTone = TONE_OPTIONS.find((option) => option.value === tone) ?? TONE_OPTIONS[0];
  const trimmedTopic = topic.trim();
  const trimmedSubject = subject.trim();

  const goBack = () => {
    if (isGenerating || step === 1) return;
    setError(null);
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  };

  const goNext = () => {
    if (step !== 1 && step !== 2) return;

    if (step === 1 && !trimmedTopic) {
      setError("Skriv først, hvad løbet skal handle om.");
      return;
    }

    setError(null);
    setStep((current) => (current < 3 ? ((current + 1) as Step) : current));
  };

  const handleClose = () => {
    if (isGenerating) return;
    setError(null);
    onClose();
  };

  const handleGenerate = async () => {
    if (!trimmedTopic || isGenerating) return;

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
          topic: trimmedTopic,
          subject: trimmedSubject || undefined,
          audience,
          tone,
          count: questionCount,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiSuccessResponse | { error?: string } | null;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "AI'en kunne ikke bygge løbet lige nu.";
        throw new Error(message);
      }

      if (!isInterviewDraftResponse(payload)) {
        throw new Error("AI'en returnerede et ugyldigt løbsformat.");
      }

      const draft: ManualAiInterviewDraft = {
        subject: trimmedSubject,
        title: asTrimmedString(payload.title),
        description: asTrimmedString(payload.description),
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
      };

      onComplete(draft);
      onClose();
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

  const progress = ((step - 1) / 3) * 100;
  const featuredSubjects = subjectSuggestions.slice(0, 8);

  return (
    <div
      className={`fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-2xl ${poppins.className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-ai-interview-title"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_24%)]" />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-slate-950/92 shadow-[0_32px_120px_rgba(0,0,0,0.65)] lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative border-b border-emerald-400/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),transparent_40%,rgba(15,23,42,0.4))]" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-[0.32em] text-emerald-300/70 uppercase">
                  Interview-AI
                </p>
                <h2
                  id="manual-ai-interview-title"
                  className={`mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl ${rubik.className}`}
                >
                  Lad os bygge et helt løb sammen
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/78 sm:text-base">
                  Du svarer på tre hurtige spørgsmål. Derefter bygger AI&apos;en titel, beskrivelse og et
                  komplet sæt quiz-poster klar til kortet.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={isGenerating}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Luk
              </button>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold tracking-[0.24em] text-emerald-100/60 uppercase">
                <span>Trin {step} af 4</span>
                <span>{step === 4 ? "Genererer løbet" : "Interview i gang"}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-lime-300 to-cyan-300 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-8 min-h-[27rem]">
              {step === 1 ? (
                <div className="space-y-6">
                  <div className="rounded-[1.75rem] border border-emerald-400/15 bg-white/5 p-5">
                    <div className="flex items-center gap-3 text-emerald-200">
                      <BookText className="h-5 w-5" />
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-100/70">
                        Trin 1 · Tema og fag
                      </p>
                    </div>

                    <label className="mt-5 block text-sm font-semibold text-white">
                      Hvad skal løbet handle om?
                    </label>
                    <textarea
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      rows={5}
                      placeholder="F.eks. nordisk mytologi, brøker i 5. klasse eller en historisk tur gennem vikingetiden."
                      className="mt-3 w-full rounded-[1.4rem] border border-emerald-400/15 bg-slate-950/65 px-4 py-4 text-base text-white placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />

                    <label className="mt-5 block text-sm font-semibold text-white">
                      Fag eller kategori
                    </label>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      list="manual-ai-subject-suggestions"
                      placeholder="F.eks. Dansk, Historie eller Natur/Teknologi"
                      className="mt-3 w-full rounded-[1.4rem] border border-emerald-400/15 bg-slate-950/65 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                    />
                    <datalist id="manual-ai-subject-suggestions">
                      {subjectSuggestions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/60 uppercase">
                      Hurtige forslag
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {featuredSubjects.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSubject(option)}
                          className="rounded-full border border-emerald-300/15 bg-emerald-400/8 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:border-emerald-300/35 hover:bg-emerald-400/16"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div className="rounded-[1.75rem] border border-emerald-400/15 bg-white/5 p-5">
                    <div className="flex items-center gap-3 text-emerald-200">
                      <GraduationCap className="h-5 w-5" />
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-100/70">
                        Trin 2 · Målgruppe
                      </p>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-emerald-50/78">
                      Vælg det niveau, som spørgsmålene skal ramme. AI&apos;en tilpasser sprog, sværhedsgrad
                      og tempo derefter.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {AUDIENCE_OPTIONS.map((option) => {
                      const isActive = option.value === audience;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAudience(option.value)}
                          className={`rounded-[1.5rem] border p-4 text-left transition ${
                            isActive
                              ? "border-emerald-300/50 bg-emerald-400/15 shadow-[0_18px_40px_rgba(16,185,129,0.12)]"
                              : "border-white/10 bg-white/5 hover:border-emerald-300/25 hover:bg-white/8"
                          }`}
                        >
                          <p className="text-base font-bold text-white">{option.label}</p>
                          <p className="mt-2 text-sm leading-6 text-emerald-50/72">{option.helper}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-6">
                  <div className="rounded-[1.75rem] border border-emerald-400/15 bg-white/5 p-5">
                    <div className="flex items-center gap-3 text-emerald-200">
                      <Sparkles className="h-5 w-5" />
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-100/70">
                        Trin 3 · Tone og længde
                      </p>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-emerald-50/78">
                      Giv løbet en tydelig stemning. Du kan også vælge, hvor mange spørgsmål AI&apos;en skal
                      bygge.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {TONE_OPTIONS.map((option) => {
                      const isActive = option.value === tone;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTone(option.value)}
                          className={`rounded-[1.5rem] border p-4 text-left transition ${
                            isActive
                              ? "border-emerald-300/50 bg-emerald-400/15 shadow-[0_18px_40px_rgba(16,185,129,0.12)]"
                              : "border-white/10 bg-white/5 hover:border-emerald-300/25 hover:bg-white/8"
                          }`}
                        >
                          <p className="text-base font-bold text-white">{option.label}</p>
                          <p className="mt-2 text-sm leading-6 text-emerald-50/72">{option.helper}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-3 text-emerald-200">
                      <Target className="h-5 w-5" />
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-100/70">
                        Antal spørgsmål
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {QUESTION_COUNT_OPTIONS.map((value) => {
                        const isActive = value === questionCount;

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setQuestionCount(value)}
                            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                              isActive
                                ? "border-emerald-300/50 bg-emerald-300 text-slate-950"
                                : "border-white/10 bg-white/5 text-emerald-50 hover:border-emerald-300/25 hover:bg-white/8"
                            }`}
                          >
                            {value} spørgsmål
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="flex h-full min-h-[27rem] flex-col items-center justify-center rounded-[1.75rem] border border-emerald-400/15 bg-white/5 px-6 py-10 text-center">
                  <div className="rounded-full border border-emerald-300/25 bg-emerald-400/10 p-5 text-emerald-200 shadow-[0_0_60px_rgba(16,185,129,0.18)]">
                    <Loader2 className="h-10 w-10 animate-spin" />
                  </div>
                  <p className="mt-6 text-xs font-semibold tracking-[0.32em] text-emerald-100/55 uppercase">
                    Trin 4 · Genererer
                  </p>
                  <h3 className={`mt-3 text-3xl font-black text-white ${rubik.className}`}>
                    AI&apos;en bygger dit løb
                  </h3>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/78 sm:text-base">
                    Vi samler nu en fængende titel, en god beskrivelse og {questionCount} gennemarbejdede
                    multiple-choice spørgsmål i en {selectedTone.label.toLowerCase()} tone til {audience.toLowerCase()}.
                  </p>

                  <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/55 p-4">
                      <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/55 uppercase">
                        Tema
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">{trimmedTopic}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/55 p-4">
                      <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/55 uppercase">
                        Målgruppe
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">{selectedAudience.label}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/55 p-4">
                      <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/55 uppercase">
                        Tone
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">{selectedTone.label}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="mt-6 rounded-[1.4rem] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                {error}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={step === 1 ? handleClose : goBack}
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-[1.3rem] border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {step === 1 ? null : <ArrowLeft className="h-4 w-4" />}
                {step === 1 ? "Luk" : "Tilbage"}
              </button>

              <button
                type="button"
                onClick={step === 3 ? handleGenerate : goNext}
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-[1.3rem] border border-emerald-300/30 bg-emerald-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_40px_rgba(110,231,183,0.16)] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {step === 3 ? (
                  <>
                    <WandSparkles className="h-4 w-4" />
                    Byg løbet
                  </>
                ) : (
                  <>
                    Næste
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        <aside className="relative hidden p-8 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(110,231,183,0.12),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.6),rgba(2,6,23,0.95))]" />

          <div className="relative flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.28em] text-emerald-100/55 uppercase">
                Live brief
              </p>
              <h3 className={`mt-4 text-2xl font-black text-white ${rubik.className}`}>
                AI&apos;en bygger efter dine svar
              </h3>
              <p className="mt-4 text-sm leading-7 text-emerald-50/75">
                Resultatet lander direkte i builderen, så du kan finpudse titel, beskrivelse og svarmuligheder
                med det samme.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/55 uppercase">
                  Tema
                </p>
                <p className="mt-2 text-lg font-bold text-white">
                  {trimmedTopic || "Venter på dit emne..."}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/55 uppercase">
                  Fag
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {trimmedSubject || "Valgfrit"}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/55 uppercase">
                  Målgruppe og tone
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {selectedAudience.label} · {selectedTone.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/72">
                  {selectedTone.helper}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-emerald-300/15 bg-emerald-400/10 p-5">
                <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/55 uppercase">
                  Output
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  Titel, beskrivelse og {questionCount} quiz-spørgsmål
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
