"use client";

import { ArrowLeft, BookOpen, Check, Loader2, Search, X } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useMemo, useState } from "react";

import { normalizeRaceType } from "@/utils/gpsRuns";
import { createClient } from "@/utils/supabase/client";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

export type ManualReuseQuestion = {
  id: number;
  type: "multiple_choice" | "ai_image";
  text: string;
  aiPrompt: string;
  mediaUrl: string;
  answers: [string, string, string, string];
  correctIndex: number;
  points: number;
  lat: number | null;
  lng: number | null;
};

type StoredRunLibraryRecord = {
  id: string;
  title: string | null;
  subject: string | null;
  race_type?: string | null;
  raceType?: string | null;
  created_at: string;
  questions: unknown;
};

type ReusableRun = {
  id: string;
  title: string;
  subject: string;
  raceType: string;
  createdAt: string;
  questions: ManualReuseQuestion[];
};

type Props = {
  open: boolean;
  currentRunId?: string;
  onClose: () => void;
  normalizeQuestions: (questions: unknown) => ManualReuseQuestion[];
  onImportQuestion: (question: ManualReuseQuestion) => Promise<void> | void;
};

function formatDanishDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Ukendt dato";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function describeRaceType(value: string) {
  switch (normalizeRaceType(value) ?? value) {
    case "manuel":
      return "Generel Quiz";
    case "dansk":
      return "Dansk";
    case "matematik":
      return "Matematik";
    case "engelsk":
      return "Engelsk";
    case "foto":
      return "Foto";
    case "selfie":
      return "Selfie";
    case "escape":
      return "Escape";
    case "rollespil":
      return "Rollespil";
    case "podcast":
      return "Podcast";
    case "scanner":
      return "Bog-Scanner";
    case "zone_krig":
      return "Zone-Krigen";
    default:
      return value || "Ukendt type";
  }
}

export default function ManualReuseModal({
  open,
  currentRunId,
  onClose,
  normalizeQuestions,
  onImportQuestion,
}: Props) {
  const [runs, setRuns] = useState<ReusableRun[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importingKey, setImportingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRuns([]);
      setSearchQuery("");
      setSelectedRunId(null);
      setError(null);
      setSuccessMessage(null);
      setImportingKey(null);
      return;
    }

    let isActive = true;

    const fetchRuns = async () => {
      setIsLoadingRuns(true);
      setError(null);

      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isActive) return;

        if (userError || !user) {
          setError("Du skal være logget ind for at hente spørgsmål fra arkivet.");
          return;
        }

        const { data, error: runsError } = await supabase
          .from("gps_runs")
          .select("id,title,subject,race_type,created_at,questions")
          .eq("user_id", user.id)
          .neq("id", currentRunId ?? "")
          .order("created_at", { ascending: false });

        if (!isActive) return;

        if (runsError) {
          throw runsError;
        }

        const nextRuns = ((data ?? []) as StoredRunLibraryRecord[])
          .map((run) => {
            const normalizedQuestions = normalizeQuestions(run.questions);

            return {
              id: run.id,
              title: run.title?.trim() || "Løb uden titel",
              subject: run.subject?.trim() || "Ukendt fag",
              raceType: run.race_type?.trim() || run.raceType?.trim() || "manuel",
              createdAt: run.created_at,
              questions: normalizedQuestions,
            } satisfies ReusableRun;
          })
          .filter((run) => run.questions.length > 0);

        setRuns(nextRuns);
      } catch (fetchError) {
        console.error("Kunne ikke hente genbrugsløb:", fetchError);
        setError("Vi kunne ikke hente dine tidligere løb lige nu.");
      } finally {
        if (isActive) {
          setIsLoadingRuns(false);
        }
      }
    };

    void fetchRuns();

    return () => {
      isActive = false;
    };
  }, [currentRunId, normalizeQuestions, open]);

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  const filteredRuns = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("da-DK");
    if (!normalizedQuery) return runs;

    return runs.filter((run) => {
      const haystack = `${run.title} ${run.subject} ${describeRaceType(run.raceType)}`.toLocaleLowerCase("da-DK");
      return haystack.includes(normalizedQuery);
    });
  }, [runs, searchQuery]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  if (!open) return null;

  const handleImport = async (question: ManualReuseQuestion, index: number) => {
    const key = `${selectedRun?.id ?? "run"}-${index}`;
    setImportingKey(key);
    setError(null);

    try {
      await onImportQuestion(question);
      setSuccessMessage("Kopieret! ✅");
    } catch (importError) {
      console.error("Kunne ikke importere spørgsmål:", importError);
      setError("Spørgsmålet kunne ikke kopieres ind i builderen.");
    } finally {
      setImportingKey(null);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-1300 overflow-y-auto bg-slate-950/94 print:hidden ${poppins.className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-reuse-modal-title"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.08),transparent_32%)]" />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-center justify-between gap-4 text-xs font-semibold tracking-[0.24em] text-slate-400 uppercase">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10"
            >
              Luk
            </button>
            <span>Genbrug fra tidligere løb</span>
            <span>{selectedRun ? "Trin 2/2" : "Trin 1/2"}</span>
          </div>

          <div className="mt-10 rounded-4xl border border-white/10 bg-white/3 px-6 py-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-8 sm:py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[0.28em] text-emerald-300 uppercase">
                  Spørgsmålsbibliotek
                </p>
                <h2
                  id="manual-reuse-modal-title"
                  className={`mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl ${rubik.className}`}
                >
                  {selectedRun ? selectedRun.title : "Hent spørgsmål fra dit arkiv"}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  {selectedRun
                    ? "Klik på en post for at kopiere den ind i det aktuelle løb. Vi nulstiller placeringen, så du aktivt vælger en ny pin på kortet."
                    : "Vælg et tidligere løb, og hent de bedste spørgsmål direkte ind i dit nuværende draft uden at forlade builderen."}
                </p>
              </div>

              {selectedRun ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRunId(null);
                    setSuccessMessage(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Tilbage til løb
                </button>
              ) : null}
            </div>

            {successMessage ? (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/12 px-4 py-2 text-sm font-bold text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.14)]">
                <Check className="h-4 w-4" />
                {successMessage}
              </div>
            ) : null}

            {error ? (
              <div className="mt-6 rounded-3xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
                {error}
              </div>
            ) : null}

            {!selectedRun ? (
              <>
                <div className="mt-8 max-w-xl">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Søg efter titel, fag eller løbstype..."
                      className="w-full rounded-[1.6rem] border border-white/10 bg-slate-950/90 py-4 pl-12 pr-5 text-base text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </div>
                </div>

                <div className="mt-8">
                  {isLoadingRuns ? (
                    <div className="flex min-h-80 flex-col items-center justify-center rounded-4xl border border-white/10 bg-slate-950/60 text-center text-white/80">
                      <Loader2 className="h-9 w-9 animate-spin text-emerald-300" />
                      <p className="mt-4 text-sm font-semibold tracking-[0.24em] uppercase text-emerald-200/80">
                        Henter dine løb...
                      </p>
                    </div>
                  ) : filteredRuns.length === 0 ? (
                    <div className="rounded-4xl border border-white/10 bg-slate-950/60 px-6 py-10 text-center text-slate-300">
                      <BookOpen className="mx-auto h-9 w-9 text-emerald-300/80" />
                      <p className="mt-4 text-lg font-semibold text-white">Ingen importbare løb fundet</p>
                      <p className="mt-2 text-sm leading-7 text-slate-400">
                        Prøv en anden søgning eller opret flere poster i dine eksisterende løb først.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {filteredRuns.map((run) => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => {
                            setSelectedRunId(run.id);
                            setSuccessMessage(null);
                            setError(null);
                          }}
                          className="text-left rounded-[1.8rem] border border-white/10 bg-slate-950/72 p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.26)] transition hover:border-emerald-300/25 hover:bg-slate-950/90"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-semibold tracking-[0.22em] text-emerald-300/85 uppercase">
                                {run.subject}
                              </p>
                              <h3 className={`mt-3 text-2xl font-black leading-tight ${rubik.className}`}>
                                {run.title}
                              </h3>
                            </div>
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-200 uppercase">
                              {describeRaceType(run.raceType)}
                            </span>
                          </div>

                          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold">
                              {run.questions.length} poster
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold">
                              {formatDanishDate(run.createdAt)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-8 grid gap-4 xl:grid-cols-2">
                {selectedRun.questions.map((question, index) => {
                  const isPhotoMission = question.type === "ai_image";
                  const importKey = `${selectedRun.id}-${index}`;
                  const isImporting = importingKey === importKey;

                  return (
                    <div
                      key={importKey}
                      className="rounded-[1.8rem] border border-white/10 bg-slate-950/72 p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.26)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.24em] text-emerald-300/80 uppercase">
                            Post {index + 1}
                          </p>
                          <h3 className={`mt-2 text-2xl font-black ${rubik.className}`}>
                            {isPhotoMission ? "Foto-post" : "Quiz-post"}
                          </h3>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-200 uppercase">
                          {isPhotoMission ? "AI foto" : "4 svar"}
                        </span>
                      </div>

                      {isPhotoMission ? (
                        <div className="mt-5 space-y-4 rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Motiv
                            </p>
                            <p className="mt-2 text-base font-bold text-white">
                              {question.aiPrompt.trim() || "Ikke angivet"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Instruktion
                            </p>
                            <p className="mt-2 text-sm leading-7 text-slate-200">
                              {question.text.trim() || "Ingen instruktion skrevet endnu."}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="mt-5 text-base leading-7 text-slate-100">
                            {question.text.trim() || "Ingen spørgsmålstekst skrevet endnu."}
                          </p>

                          <ol className="mt-5 space-y-2">
                            {question.answers.map((answer, answerIndex) => {
                              const isCorrect = question.correctIndex === answerIndex;
                              return (
                                <li
                                  key={`${importKey}-${answerIndex}`}
                                  className={`flex items-start gap-3 rounded-[1.2rem] border px-3 py-3 ${
                                    isCorrect
                                      ? "border-emerald-300/25 bg-emerald-400/10"
                                      : "border-white/10 bg-white/4"
                                  }`}
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-black text-white">
                                    {ANSWER_LABELS[answerIndex]}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm leading-6 ${isCorrect ? "font-bold text-white" : "text-slate-200"}`}>
                                      {answer.trim() || "Tom svarmulighed"}
                                    </p>
                                    {isCorrect ? (
                                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                                        Korrekt svar
                                      </p>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleImport(question, index)}
                        disabled={Boolean(importingKey)}
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-emerald-300/30 bg-emerald-400 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Kopierer...
                          </>
                        ) : (
                          "Kopiér ind i dette løb"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
            >
              <X className="h-4 w-4" />
              Luk biblioteket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}