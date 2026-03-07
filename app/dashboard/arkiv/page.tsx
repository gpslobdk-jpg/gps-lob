"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Edit2, MapPin, Play, Search, Timer, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useState, type FormEvent } from "react";

import { buildRunScheduleUpdate, getRunSchedule, hasRunSchedule } from "@/utils/runSchedule";
import { createClient } from "@/utils/supabase/client";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type RunQuestion = {
  id?: number;
  type?: "multiple_choice" | "ai_image";
  text?: string;
  aiPrompt?: string;
  ai_prompt?: string;
  answers?: string[];
  correctIndex?: number;
  lat?: number | null;
  lng?: number | null;
  mediaUrl?: string;
};

type Run = {
  id: string;
  title: string;
  subject: string;
  topic: string | null;
  questions: RunQuestion[] | null;
  created_at: string;
  [key: string]: unknown;
};

const ALL_SUBJECTS = [
  "Alle",
  "Dansk",
  "Matematik",
  "Engelsk",
  "Natur/Teknologi",
  "Historie",
  "Idræt",
  "Kristendomskundskab",
  "Tysk",
  "Fransk",
  "Geografi",
  "Biologi",
  "Fysik/Kemi",
  "Samfundsfag",
  "Håndværk/Design",
  "Billedkunst",
  "Madkundskab",
  "Musik",
];

const formatDanishDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Ukendt dato";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getQuestionCount = (questions: Run["questions"]) => {
  return Array.isArray(questions) ? questions.length : 0;
};

const padNumber = (value: number) => value.toString().padStart(2, "0");

const toDateTimeLocalValue = (value: string | null | undefined) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
};

const formatDanishDateTime = (value: string | null | undefined) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const isMissingRelationOrColumnError = (error: SupabaseLikeError | null | undefined) => {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") {
    return true;
  }
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("column")
  );
};

const getDeleteErrorMessage = (error: unknown) => {
  const base = "Kunne ikke slette løbet.";

  if (!error) return base;
  if (error instanceof TypeError) {
    return `${base} Netværksfejl - tjek internetforbindelsen og prøv igen.`;
  }

  const dbError = error as SupabaseLikeError;

  if (dbError.code === "42501") {
    return `${base} Mangler rettigheder (RLS). Tjek DELETE-policy for løb.`;
  }
  if (dbError.code === "23503") {
    const detailSource = `${dbError.details ?? ""} ${dbError.message ?? ""}`;
    const tableMatch = detailSource.match(/table\s+"([^"]+)"/i);
    const tableName = tableMatch?.[1];
    if (tableName) {
      return `${base} Der er stadig tilknyttede data i tabellen "${tableName}" (foreign key-restriktion).`;
    }
    return `${base} Der er stadig tilknyttede data (foreign key-restriktion).`;
  }
  if (dbError.code === "PGRST301") {
    return `${base} Din session er udløbet. Log ind igen og prøv på ny.`;
  }
  if (dbError.code === "PGRST116") {
    return `${base} Løbet blev ikke fundet eller du har ikke adgang til at slette det.`;
  }

  if (dbError.message) {
    return `${base} ${dbError.message}`;
  }

  return base;
};

export default function ArkivPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Alle");
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingRunId, setStartingRunId] = useState<string | null>(null);
  const [scheduleRun, setScheduleRun] = useState<Run | null>(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  useEffect(() => {
    const fetchRuns = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("gps_runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fejl ved hentning af løb:", error);
        alert("Kunne ikke hente løbsarkivet.");
      } else {
        setRuns((data ?? []) as Run[]);
      }
      setIsLoading(false);
    };

    void fetchRuns();
  }, []);

  const handleDeleteRun = async (runId: string) => {
    const shouldDelete = window.confirm("Vil du slette dette løb fra arkivet?");
    if (!shouldDelete) return;

    const supabase = createClient();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("Du skal være logget ind for at slette et løb.");
        return;
      }

      // Oprydning i evt. separate post-tabeller, hvis de findes i databasen.
      for (const tableName of ["questions", "poster"] as const) {
        const { error } = await supabase.from(tableName).delete().eq("run_id", runId);
        if (error && !isMissingRelationOrColumnError(error)) {
          throw error;
        }
      }

      // Hent alle live-sessioner for løbet, så vi kan rydde relaterede records først.
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("live_sessions")
        .select("id")
        .eq("run_id", runId);

      if (sessionsError && !isMissingRelationOrColumnError(sessionsError)) {
        throw sessionsError;
      }

      const sessionIds = (sessionsData ?? [])
        .map((session) => String((session as { id?: string | number | null }).id ?? ""))
        .filter((id) => id.length > 0);

      if (sessionIds.length > 0) {
        // Ryd op i både nye og ældre live-tabeller, før live_sessions slettes.
        for (const tableName of [
          "participants",
          "answers",
          "session_students",
          "session_messages",
          "messages",
        ] as const) {
          const { error } = await supabase.from(tableName).delete().in("session_id", sessionIds);
          if (error && !isMissingRelationOrColumnError(error)) {
            throw error;
          }
        }
      }

      const { error: deleteSessionsError } = await supabase
        .from("live_sessions")
        .delete()
        .eq("run_id", runId);

      if (deleteSessionsError && !isMissingRelationOrColumnError(deleteSessionsError)) {
        throw deleteSessionsError;
      }

      // Slet selve løbet. Ejer-tjek via user_id gør fejlen tydeligere ved manglende adgang.
      const { data: deletedRunRows, error: deleteRunError } = await supabase
        .from("gps_runs")
        .delete()
        .eq("id", runId)
        .eq("user_id", user.id)
        .select("id");

      if (deleteRunError) {
        throw deleteRunError;
      }

      if (!deletedRunRows || deletedRunRows.length === 0) {
        alert("Kunne ikke slette løbet. Du er muligvis ikke ejer af løbet.");
        return;
      }

      setRuns((prev) => prev.filter((run) => run.id !== runId));
    } catch (error) {
      console.error("Fejl ved sletning af løb:", error);
      alert(getDeleteErrorMessage(error));
    }
  };

  const handleStartRun = async (runId: string) => {
    setStartingRunId(runId);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Du skal være logget ind!");
        return;
      }

      const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

      const { data, error } = await supabase
        .from("live_sessions")
        .insert({
          run_id: runId,
          teacher_id: user.id,
          pin: generatedPin,
          status: "waiting",
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        router.push(`/dashboard/live/${data.id}`);
      }
    } catch (err) {
      console.error("Kunne ikke oprette live session:", err);
      alert("Der skete en fejl. Prøv igen.");
    } finally {
      setStartingRunId(null);
    }
  };

  const openScheduleModal = (run: Run) => {
    const schedule = getRunSchedule(run);
    setScheduleRun(run);
    setScheduleStart(toDateTimeLocalValue(schedule?.startAt));
    setScheduleEnd(toDateTimeLocalValue(schedule?.endAt));
  };

  const closeScheduleModal = () => {
    setScheduleRun(null);
    setScheduleStart("");
    setScheduleEnd("");
  };

  const handleSaveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!scheduleRun) return;

    const startDate = scheduleStart ? new Date(scheduleStart) : null;
    const endDate = scheduleEnd ? new Date(scheduleEnd) : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      alert("Start-tidspunktet er ugyldigt.");
      return;
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      alert("Slut-tidspunktet er ugyldigt.");
      return;
    }

    if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
      alert("Slut-tidspunktet skal ligge efter start-tidspunktet.");
      return;
    }

    setIsSavingSchedule(true);
    const supabase = createClient();
    const update = buildRunScheduleUpdate(scheduleRun, {
      startAt: startDate?.toISOString() ?? null,
      endAt: endDate?.toISOString() ?? null,
    });

    try {
      const { error } = await supabase
        .from("gps_runs")
        .update(update.updates)
        .eq("id", scheduleRun.id);

      if (error) {
        throw error;
      }

      setRuns((prev) =>
        prev.map((run) =>
          run.id === scheduleRun.id
            ? {
                ...run,
                ...update.updates,
              }
            : run
        )
      );

      setScheduleRun((prev) =>
        prev
          ? {
              ...prev,
              ...update.updates,
            }
          : prev
      );

      closeScheduleModal();
    } catch (error) {
      console.error("Fejl ved gemning af tidsstyring:", error);
      alert("Kunne ikke gemme tidsstyringen. Prøv igen.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const filteredRuns = runs.filter((run) => {
    const matchesSearch = run.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === "Alle" || run.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <main
      className={`relative min-h-screen bg-gradient-to-t from-emerald-100 via-sky-50 to-sky-300 p-6 text-white lg:bg-none lg:bg-transparent lg:p-12 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
        src="/arkiv-bg.mp4"
      />
      <div className="fixed inset-0 hidden bg-gradient-to-b from-sky-900/20 to-emerald-900/60 backdrop-blur-[3px] -z-10 lg:block" />

      <div className="mx-auto max-w-7xl">
        <h1
          className={`text-4xl font-black text-white drop-shadow-xl sm:text-5xl ${rubik.className}`}
        >
          MIT LØBSARKIV
        </h1>

        {/* TOP PANEL: SØGNING OG FILTER */}
        <div className="mt-8 mb-10 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_17rem] md:items-end">
          {/* SØGEFELT */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-emerald-700/70">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Søg i dine løb..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/50 bg-white/80 py-4 pr-4 pl-12 text-emerald-950 shadow-lg backdrop-blur-md transition-all placeholder:text-emerald-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          {/* KATEGORIER / FAG DROPDOWN */}
          <div className="w-full">
            <p className="mb-1 px-1 text-[11px] text-white/85 drop-shadow-md">
              Er du underviser? Filtrér efter fag
            </p>
            <label
              htmlFor="subject-filter"
              className="mb-2 block px-1 text-xs font-semibold tracking-wide text-white drop-shadow-md"
            >
              Kategorier / Fag
            </label>
            <div className="relative">
              <select
                id="subject-filter"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-white/50 bg-white/80 py-4 pr-12 pl-6 font-medium text-emerald-950 shadow-lg backdrop-blur-md transition-colors hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {ALL_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj} className="bg-white py-2 text-emerald-950">
                    {subj}
                  </option>
                ))}
              </select>
              {/* Custom pil for at fjerne browserens standard-pil */}
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-emerald-700">
                <svg
                  width="14"
                  height="8"
                  viewBox="0 0 14 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 1L7 7L13 1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full rounded-2xl border border-white/50 bg-white/80 p-8 text-center text-emerald-800 shadow-lg backdrop-blur-md"
              >
                Henter løb fra arkivet...
              </motion.div>
            ) : filteredRuns.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full rounded-2xl border border-white/50 bg-white/80 p-8 text-center text-emerald-800 shadow-lg backdrop-blur-md"
              >
                Ingen løb matcher din søgning.
              </motion.div>
            ) : (
              filteredRuns.map((run) => {
                const runSchedule = getRunSchedule(run);
                const formattedStart = formatDanishDateTime(runSchedule?.startAt);
                const formattedEnd = formatDanishDateTime(runSchedule?.endAt);

                return (
                  <motion.div
                    key={run.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="group relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/85 p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {run.subject}
                      </span>
                      <span className="text-xs text-emerald-700">
                        {formatDanishDate(run.created_at)}
                      </span>
                    </div>

                    <h2
                      className={`mt-5 text-2xl font-bold leading-tight text-emerald-950 ${rubik.className}`}
                    >
                      {run.title}
                    </h2>

                    <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      {getQuestionCount(run.questions)} poster
                    </p>

                    {hasRunSchedule(runSchedule) ? (
                      <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
                        <Timer className="h-4 w-4 text-emerald-600" />
                        {runSchedule?.startAt && runSchedule?.endAt
                          ? `Planlagt fra ${formattedStart ?? "ukendt tidspunkt"} til ${formattedEnd ?? "ukendt tidspunkt"}`
                          : runSchedule?.startAt
                            ? `Starter ${formattedStart ?? "ukendt tidspunkt"}`
                            : `Slutter ${formattedEnd ?? "ukendt tidspunkt"}`}
                      </p>
                    ) : null}

                    <div className="mt-7 grid grid-cols-[1fr_auto_auto_auto] gap-2">
                      <button
                        type="button"
                        onClick={() => void handleStartRun(run.id)}
                        disabled={startingRunId === run.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700"
                      >
                        <Play className="h-4 w-4" />
                        {startingRunId === run.id ? "STARTER..." : "START LØB"}
                      </button>

                      <button
                        type="button"
                        aria-label="Planlæg løb"
                        onClick={() => openScheduleModal(run)}
                        className={`grid h-11 w-11 place-items-center rounded-xl border transition hover:bg-white ${
                          hasRunSchedule(runSchedule)
                            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                            : "border-emerald-200 bg-white/50 text-emerald-700"
                        }`}
                      >
                        <Timer className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        aria-label="Rediger løb"
                        className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-200 bg-white/50 text-emerald-700 transition hover:bg-white"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        aria-label="Slet løb"
                        onClick={() => void handleDeleteRun(run.id)}
                        className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-200 bg-white/50 text-emerald-700 transition hover:bg-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {scheduleRun ? (
          <motion.div
            key="schedule-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Luk tidsstyring"
              onClick={closeScheduleModal}
              className="absolute inset-0 bg-emerald-950/45 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(160deg,rgba(6,33,24,0.96),rgba(12,74,60,0.9))] p-6 text-white shadow-[0_32px_80px_rgba(2,24,19,0.42)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(110,231,183,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_38%)]" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.32em] text-emerald-100/70 uppercase">
                      Tidsstyring
                    </p>
                    <h2 className={`mt-3 text-2xl font-black text-white ${rubik.className}`}>
                      {scheduleRun.title}
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-emerald-50/80">
                      Vælg hvornår løbet automatisk skal åbne og lukke for deltagere på
                      join-siden.
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Luk"
                    onClick={closeScheduleModal}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-emerald-50 transition hover:bg-white/15"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveSchedule} className="mt-8 space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="schedule-start"
                      className="text-sm font-semibold text-emerald-50"
                    >
                      Start-tidspunkt
                    </label>
                    <input
                      id="schedule-start"
                      type="datetime-local"
                      value={scheduleStart}
                      onChange={(event) => setScheduleStart(event.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="schedule-end"
                      className="text-sm font-semibold text-emerald-50"
                    >
                      Slut-tidspunkt
                    </label>
                    <input
                      id="schedule-end"
                      type="datetime-local"
                      value={scheduleEnd}
                      onChange={(event) => setScheduleEnd(event.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-emerald-50/80">
                    Lad et felt stå tomt, hvis løbet kun skal have et automatisk start- eller
                    sluttidspunkt.
                  </div>

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleStart("");
                        setScheduleEnd("");
                      }}
                      className="rounded-2xl border border-white/15 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-white/[0.14]"
                    >
                      Ryd tider
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingSchedule}
                      className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black tracking-[0.2em] text-emerald-950 uppercase transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
                    >
                      {isSavingSchedule ? "GEMMER..." : "GEM TIDER"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
