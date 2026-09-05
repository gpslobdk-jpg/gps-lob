"use client";

import { ArrowLeft, CheckCircle2, Loader2, LocateFixed, MapPinOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import FocusModeSetting from "@/components/focus/FocusModeSetting";

import {
  buildLynbyggerManualDraft,
  parseLynbyggerApiResponse,
  validateLynbyggerInput,
  type LynbyggerApiResponse,
  type LynbyggerCenter,
} from "@/lib/lynbygger";
import { poppins, rubik } from "@/lib/fonts";
import { GRADE_LEVEL_OPTIONS, isGradeLevel } from "@/utils/gradeLevels";
import { markDraftForAutoload, readRunDraft, writeRunDraft } from "@/utils/runDrafts";

const MANUEL_DRAFT_STORAGE_KEY = "draft_run_manuel";

function getGenerationErrorMessage(status: number) {
  if (status === 401) {
    return "Din session er udløbet. Log ind igen, og prøv på ny.";
  }

  if (status === 429) {
    return "Der er mange, der laver løb lige nu. Vent et øjeblik, og prøv igen.";
  }

  if (status === 422) {
    return "Løbet kunne ikke laves sikkert lige nu. Prøv igen.";
  }

  if (status === 504) {
    return "Det tog for lang tid at lave løbet. Prøv igen.";
  }

  return "Løbet kunne ikke laves lige nu. Prøv igen.";
}

export default function LynbyggerPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [generatedRun, setGeneratedRun] = useState<LynbyggerApiResponse | null>(null);
  const [hasTeacherApproved, setHasTeacherApproved] = useState(false);
  const [focusEnabled, setFocusEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isOpeningBuilder, setIsOpeningBuilder] = useState(false);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => generationAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating || isLocating || isOpeningBuilder) return;

    const validation = validateLynbyggerInput(topic, gradeLevel);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError(null);
    setGeneratedRun(null);
    setHasTeacherApproved(false);
    setIsGenerating(true);

    const controller = new AbortController();
    generationAbortRef.current = controller;

    try {
      const response = await fetch("/api/manual-builder/interview", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.request),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(getGenerationErrorMessage(response.status));
        return;
      }

      const parsedRun = parseLynbyggerApiResponse(payload);
      if (!parsedRun) {
        setError("Løbet kunne ikke laves lige nu. Prøv igen.");
        return;
      }

      setGeneratedRun(parsedRun);
      setHasTeacherApproved(false);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }

      setError("Løbet kunne ikke laves lige nu. Tjek forbindelsen, og prøv igen.");
    } finally {
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null;
        setIsGenerating(false);
      }
    }
  };

  const updateGeneratedQuestion = (
    questionIndex: number,
    update: (question: LynbyggerApiResponse["questions"][number]) =>
      LynbyggerApiResponse["questions"][number],
  ) => {
    setGeneratedRun((current) => {
      if (!current) return current;
      return {
        ...current,
        questions: current.questions.map((question, index) =>
          index === questionIndex ? update(question) : question,
        ),
      };
    });
    setHasTeacherApproved(false);
    setError(null);
  };

  const openBuilder = (center: LynbyggerCenter | null) => {
    if (
      !generatedRun ||
      !hasTeacherApproved ||
      !parseLynbyggerApiResponse(generatedRun) ||
      !isGradeLevel(gradeLevel) ||
      isOpeningBuilder
    ) {
      return;
    }

    setError(null);
    setIsOpeningBuilder(true);

    try {
      const draft = { ...buildLynbyggerManualDraft(generatedRun, gradeLevel, center), focusEnabled };
      writeRunDraft(MANUEL_DRAFT_STORAGE_KEY, null, draft);

      const storedDraft = readRunDraft<typeof draft>(MANUEL_DRAFT_STORAGE_KEY, null);
      if (!storedDraft || storedDraft.questions.length !== generatedRun.questions.length) {
        throw new Error("draft_not_available");
      }

      markDraftForAutoload(MANUEL_DRAFT_STORAGE_KEY);
      router.push("/dashboard/opret/manuel");
    } catch {
      setError("Løbet er lavet, men kunne ikke åbnes i editoren. Prøv igen.");
      setIsOpeningBuilder(false);
    }
  };

  const handleAutomaticPlacement = () => {
    if (isLocating || isOpeningBuilder) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      openBuilder(null);
      return;
    }

    setError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        openBuilder({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setIsLocating(false);
        openBuilder(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  };

  const isBusy = isGenerating || isLocating || isOpeningBuilder;
  const isDraftStructurallyValid = Boolean(
    generatedRun && parseLynbyggerApiResponse(generatedRun),
  );

  return (
    <main
      data-testid="lynbygger-page"
      className={`min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_36%),linear-gradient(145deg,#082f49,#0f172a_52%,#083344)] px-4 py-5 text-white sm:px-6 sm:py-7 lg:px-10 ${poppins.className}`}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link
          href="/dashboard/opret/valg"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-semibold text-white/88 transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Tilbage
        </Link>
        <span className="inline-flex items-center gap-2 text-sm font-bold text-cyan-100/78">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Lynbygger
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col justify-center py-10 sm:py-14 lg:min-h-[calc(100vh-6.5rem)] lg:py-12">
        <div className="mx-auto w-full max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-100/66">
              Fem færdige poster på få øjeblikke
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl ${rubik.className}`}>
              Hvad skal eleverne arbejde med?
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-cyan-50/72 sm:text-base">
              Skriv emnet, vælg klassen, og få et løb du kan tilpasse bagefter.
            </p>
          </div>

          <div className="mt-7 rounded-[2rem] border border-white/13 bg-white/9 p-4 shadow-[0_28px_80px_rgba(2,6,23,0.34)] backdrop-blur-2xl sm:p-6 lg:p-7">
            {!generatedRun ? (
              <form
                onSubmit={handleGenerate}
                aria-busy={isGenerating}
                className="grid gap-4 lg:grid-cols-[auto_minmax(16rem,1fr)_auto_minmax(12rem,0.65fr)_auto] lg:items-end"
              >
                <span className="hidden pb-3 text-base font-bold text-cyan-50/82 lg:block">
                  Lav et GPS-løb om
                </span>

                <div>
                  <label htmlFor="lynbygger-topic" className="mb-2 block text-sm font-bold text-cyan-50 lg:sr-only">
                    Emne
                  </label>
                  <input
                    id="lynbygger-topic"
                    data-testid="lynbygger-topic-input"
                    value={topic}
                    onChange={(event) => {
                      setTopic(event.target.value);
                      setError(null);
                    }}
                    disabled={isBusy}
                    maxLength={180}
                    autoComplete="off"
                    placeholder="Fx Den Kolde Krig, brøker, eventyr eller vulkaner"
                    className="min-h-13 w-full rounded-2xl border border-cyan-100/24 bg-slate-950/45 px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-white/38 hover:border-cyan-100/36 focus:border-cyan-200 focus:ring-4 focus:ring-cyan-300/14 disabled:cursor-wait disabled:opacity-70"
                  />
                </div>

                <span className="hidden pb-3 text-base font-bold text-cyan-50/82 lg:block">til</span>

                <div>
                  <label htmlFor="lynbygger-grade" className="mb-2 block text-sm font-bold text-cyan-50 lg:sr-only">
                    Klassetrin
                  </label>
                  <select
                    id="lynbygger-grade"
                    data-testid="lynbygger-grade-input"
                    value={gradeLevel}
                    onChange={(event) => {
                      setGradeLevel(event.target.value);
                      setError(null);
                    }}
                    disabled={isBusy}
                    className="min-h-13 w-full rounded-2xl border border-cyan-100/24 bg-slate-950/45 px-4 py-3 text-base font-semibold text-white outline-none transition hover:border-cyan-100/36 focus:border-cyan-200 focus:ring-4 focus:ring-cyan-300/14 disabled:cursor-wait disabled:opacity-70"
                  >
                    <option value="" className="bg-slate-950 text-white">
                      Vælg klassetrin
                    </option>
                    {GRADE_LEVEL_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-950 text-white">
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  data-testid="lynbygger-generate"
                  disabled={isBusy}
                  className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-100/45 bg-cyan-300 px-5 py-3 text-base font-black text-slate-950 shadow-[0_18px_42px_rgba(34,211,238,0.24)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100/40 disabled:cursor-wait disabled:opacity-70 lg:w-auto lg:whitespace-nowrap"
                >
                  {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
                  {isGenerating ? `Laver dit løb om ${topic.trim()}…` : error ? "Prøv igen" : "⚡ Lav mit løb"}
                </button>

                {isGenerating ? (
                  <p role="status" aria-live="polite" className="text-center text-sm font-semibold text-cyan-50/74 lg:col-span-5">
                    Vi skriver fem spørgsmål, der passer til klassetrinnet.
                  </p>
                ) : null}
              </form>
            ) : (
              <div data-testid="lynbygger-placement-step" className="mx-auto max-w-4xl">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300 text-emerald-950 shadow-[0_14px_34px_rgba(110,231,183,0.24)]">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className={`mt-4 text-center text-2xl font-black text-white sm:text-3xl ${rubik.className}`}>
                  AI-udkast – gennemgå spørgsmål og facit
                </h2>
                <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-cyan-50/76 sm:text-base">
                  Lynbyggeren sparer dig tid, men AI kan tage fejl. Gennemgå derfor alle spørgsmål,
                  svarmuligheder og facit, og ret det nødvendige.
                </p>

                <div data-testid="lynbygger-draft-review" className="mt-6 grid gap-4 text-left">
                  {generatedRun.questions.map((question, questionIndex) => {
                    const correctIndex = question.options.indexOf(question.correctAnswer);
                    return (
                      <fieldset
                        key={questionIndex}
                        data-testid={`lynbygger-draft-question-${questionIndex}`}
                        className="rounded-2xl border border-white/14 bg-slate-950/34 p-4 sm:p-5"
                      >
                        <legend className="px-2 text-sm font-black text-cyan-100">
                          Spørgsmål {questionIndex + 1}
                        </legend>
                        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-cyan-50/68">
                          Spørgsmålstekst
                          <textarea
                            value={question.question}
                            data-testid={`lynbygger-question-text-${questionIndex}`}
                            onChange={(event) =>
                              updateGeneratedQuestion(questionIndex, (current) => ({
                                ...current,
                                question: event.target.value,
                              }))
                            }
                            disabled={isBusy}
                            rows={2}
                            className="mt-2 w-full resize-y rounded-xl border border-white/16 bg-slate-950/54 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/20 disabled:opacity-70"
                          />
                        </label>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {question.options.map((option, optionIndex) => (
                            <div
                              key={optionIndex}
                              className="flex min-w-0 items-center gap-2 rounded-xl border border-white/12 bg-white/5 p-2"
                            >
                              <input
                                type="radio"
                                name={`lynbygger-correct-${questionIndex}`}
                                aria-label={`Markér svar ${optionIndex + 1} som facit i spørgsmål ${questionIndex + 1}`}
                                checked={correctIndex === optionIndex}
                                onChange={() =>
                                  updateGeneratedQuestion(questionIndex, (current) => ({
                                    ...current,
                                    correctAnswer: current.options[optionIndex],
                                  }))
                                }
                                disabled={isBusy}
                                className="h-5 w-5 shrink-0 accent-cyan-300"
                              />
                              <label className="min-w-0 flex-1 text-xs font-bold text-cyan-50/68">
                                Svar {optionIndex + 1}
                                <input
                                  value={option}
                                  data-testid={`lynbygger-option-${questionIndex}-${optionIndex}`}
                                  onChange={(event) =>
                                    updateGeneratedQuestion(questionIndex, (current) => {
                                      const options = [...current.options] as [string, string, string, string];
                                      const wasCorrect = current.correctAnswer === current.options[optionIndex];
                                      options[optionIndex] = event.target.value;
                                      return {
                                        ...current,
                                        options,
                                        correctAnswer: wasCorrect
                                          ? event.target.value
                                          : current.correctAnswer,
                                      };
                                    })
                                  }
                                  disabled={isBusy}
                                  className="mt-1 w-full rounded-lg border border-white/14 bg-slate-950/54 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/20 disabled:opacity-70"
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-cyan-100/22 bg-cyan-300/8 p-4 text-left">
                  <input
                    type="checkbox"
                    data-testid="lynbygger-teacher-approval"
                    checked={hasTeacherApproved}
                    onChange={(event) => setHasTeacherApproved(event.target.checked)}
                    disabled={isBusy || !isDraftStructurallyValid}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-300"
                  />
                  <span className="text-sm font-bold leading-6 text-cyan-50">
                    Jeg har gennemgået alle spørgsmål, svarmuligheder og facit
                  </span>
                </label>
                {!isDraftStructurallyValid ? (
                  <p role="alert" className="mt-2 text-sm font-semibold text-amber-200">
                    Udfyld alle spørgsmål og fire forskellige svar, og vælg ét facit til hvert spørgsmål.
                  </p>
                ) : null}
                <p className="mt-4 text-center text-sm leading-6 text-cyan-50/72 sm:text-base">
                  Når du har godkendt udkastet, kan du placere de fem poster omkring dig eller selv på kortet.
                </p>
                <FocusModeSetting enabled={focusEnabled} onChange={setFocusEnabled} disabled={isBusy} compact />
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="lynbygger-place-current"
                    onClick={handleAutomaticPlacement}
                    disabled={isBusy || !hasTeacherApproved}
                    className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100/40 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isLocating || isOpeningBuilder ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <LocateFixed className="h-5 w-5" aria-hidden="true" />
                    )}
                    {isLocating ? "Finder din placering…" : "Placér omkring min placering"}
                  </button>
                  <button
                    type="button"
                    data-testid="lynbygger-place-manually"
                    onClick={() => openBuilder(null)}
                    disabled={isBusy || !hasTeacherApproved}
                    className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-white/18 bg-slate-950/34 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100/24 disabled:cursor-wait disabled:opacity-70"
                  >
                    <MapPinOff className="h-5 w-5" aria-hidden="true" />
                    Placér dem selv i editoren
                  </button>
                </div>
              </div>
            )}

            {error ? (
              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                data-testid="lynbygger-error"
                className="mt-4 rounded-2xl border border-rose-300/28 bg-rose-500/12 px-4 py-3 text-center text-sm font-semibold text-rose-50 outline-none focus:ring-2 focus:ring-rose-200/50"
              >
                {error}
              </div>
            ) : null}
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-cyan-50/52 sm:text-sm">
            Du gennemser, placerer og gemmer løbet i den almindelige builder.
          </p>
        </div>
      </section>
    </main>
  );
}
