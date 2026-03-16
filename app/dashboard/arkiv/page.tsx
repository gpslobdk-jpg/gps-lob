"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BarChart, Calendar, Copy, Edit2, MapPin, Play, Search, Timer, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useState, type FormEvent } from "react";

import { getBuilderHrefForRaceType } from "@/utils/gpsRuns";
import { getRaceTypeTheme, normalizeRaceTypeThemeKey } from "@/utils/raceTypeTheme";
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
  isSelfie?: boolean;
  is_selfie?: boolean;
};

type Run = {
  id: string;
  title: string;
  subject: string;
  topic: string | null;
  description?: string | null;
  questions: RunQuestion[] | null;
  created_at: string;
  raceType?: string | null;
  race_type?: string | null;
  [key: string]: unknown;
};

type LiveSession = {
  id: string;
  pin: string | null;
  status: string | null;
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

const RACE_TYPE_FILTER_OPTIONS = [
  { value: "Alle", label: "Alle" },
  { value: "manuel", label: "Manuel / GPS" },
  { value: "foto", label: "Foto" },
  { value: "escape", label: "Escape Room" },
  { value: "rollespil", label: "Rollespil" },
  { value: "scanner", label: "Scanner" },
  { value: "selfie", label: "Selfie" },
] as const;

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

const generateJoinPin = () => Math.floor(100000 + Math.random() * 900000).toString();

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

const buildJoinLink = (pin: string) => {
  const path = `/join?pin=${encodeURIComponent(pin)}`;
  return typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
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
  const [selectedRaceType, setSelectedRaceType] = useState("Alle");
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingRunId, setStartingRunId] = useState<string | null>(null);
  const [scheduleRun, setScheduleRun] = useState<Run | null>(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleSharePin, setScheduleSharePin] = useState("");
  const [scheduleShareLink, setScheduleShareLink] = useState("");
  const [scheduleSessionSource, setScheduleSessionSource] = useState<"created" | "reused" | null>(null);
  const [didCopyScheduleAccess, setDidCopyScheduleAccess] = useState(false);

  const handleEditRun = (run: Run) => {
    const href = getBuilderHrefForRaceType(run.id, run.race_type ?? run.raceType);

    if (!href) {
      alert("Dette løb mangler en gyldig løbstype og kan ikke åbnes i redigering endnu.");
      return;
    }

    router.push(href);
  };

  useEffect(() => {
    const fetchRuns = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (userError) {
          console.error("Fejl ved hentning af bruger til arkivet:", userError);
        }
        setRuns([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("gps_runs")
        .select("*")
        .eq("user_id", user.id)
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

      const ensuredSession = await ensureLiveSessionForRun(runId, user.id);

      if (ensuredSession && ensuredSession.id) {
        router.push(`/dashboard/live/${ensuredSession.id}`);
      }
    } catch (err) {
      console.error("Kunne ikke oprette live session:", err);
      alert("Der skete en fejl. Prøv igen.");
    } finally {
      setStartingRunId(null);
    }
  };

  const resetScheduleAccessDetails = () => {
    setScheduleSharePin("");
    setScheduleShareLink("");
    setScheduleSessionSource(null);
    setDidCopyScheduleAccess(false);
  };

  const ensureLiveSessionForRun = async (runId: string, teacherId: string) => {
    const supabase = createClient();
    const { data: activeSessions, error: activeSessionsError } = await supabase
      .from("live_sessions")
      .select("id,pin,status")
      .eq("run_id", runId)
      .eq("teacher_id", teacherId)
      .in("status", ["waiting", "running"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (activeSessionsError) {
      throw activeSessionsError;
    }

    const existingSession = ((activeSessions ?? []) as LiveSession[])[0] ?? null;
    const existingPin = typeof existingSession?.pin === "string" ? existingSession.pin.trim() : "";

    if (existingSession?.id && existingPin) {
      return {
        id: existingSession.id,
        pin: existingPin,
        source: "reused" as const,
      };
    }

    // Try to generate a unique PIN up to N attempts before failing
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const generatedPin = generateJoinPin();

      // Check quickly if this PIN is already used for an active session
      const { data: pinMatches, error: pinCheckError } = await supabase
        .from("live_sessions")
        .select("id")
        .eq("pin", generatedPin)
        .in("status", ["waiting", "running"])
        .limit(1);

      if (pinCheckError) {
        console.error("Fejl ved PIN-tjek:", pinCheckError);
        // on error, fall through to try insert (it may still succeed)
      }

      if (Array.isArray(pinMatches) && pinMatches.length > 0) {
        // Collision — try again
        if (attempt === maxAttempts) break;
        continue;
      }

      // Attempt to create the session with this PIN
      try {
        const { data: createdSession, error: createdSessionError } = await supabase
          .from("live_sessions")
          .insert({
            run_id: runId,
            teacher_id: teacherId,
            pin: generatedPin,
            status: "waiting",
          })
          .select("id,pin,status")
          .single();

        if (createdSessionError) {
          // If insert failed due to a constraint, loop to retry
          console.warn("Fejl ved oprettelse af session (forsøg", attempt, "):", createdSessionError);
          if (attempt === maxAttempts) throw createdSessionError;
          continue;
        }

        const createdPin = typeof createdSession?.pin === "string" ? createdSession.pin.trim() : generatedPin;

        return {
          id: createdSession.id,
          pin: createdPin,
          source: "created" as const,
        };
      } catch (err) {
        console.error("Uventet fejl ved oprettelse af session:", err);
        if (attempt === maxAttempts) throw err;
        // otherwise retry
      }
    }

    throw new Error("Kunne ikke generere en unik PIN efter flere forsøg. Prøv igen.");
  };

  const openScheduleModal = (run: Run) => {
    const schedule = getRunSchedule(run);
    resetScheduleAccessDetails();
    setScheduleRun(run);
    setScheduleStart(toDateTimeLocalValue(schedule?.startAt));
    setScheduleEnd(toDateTimeLocalValue(schedule?.endAt));
  };

  const closeScheduleModal = () => {
    resetScheduleAccessDetails();
    setScheduleRun(null);
    setScheduleStart("");
    setScheduleEnd("");
  };

  const handleCopyScheduleAccess = async () => {
    if (!scheduleSharePin && !scheduleShareLink) return;

    const copyText = [scheduleSharePin ? `PIN: ${scheduleSharePin}` : "", scheduleShareLink ? `Link: ${scheduleShareLink}` : ""]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(copyText);
      setDidCopyScheduleAccess(true);
    } catch (error) {
      console.error("Kunne ikke kopiere adgangsoplysninger:", error);
      alert("Kunne ikke kopiere linket automatisk. Kopiér det manuelt fra boksen.");
    }
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
    const activeRun = scheduleRun;
    const update = buildRunScheduleUpdate(activeRun, {
      startAt: startDate?.toISOString() ?? null,
      endAt: endDate?.toISOString() ?? null,
    });

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("Du skal vÃ¦re logget ind for at planlÃ¦gge et lÃ¸b.");
        return;
      }

      const ensuredSession = await ensureLiveSessionForRun(activeRun.id, user.id);

      const { data: updatedRuns, error } = await supabase
        .from("gps_runs")
        .update(update.updates)
        .eq("id", activeRun.id)
        .eq("user_id", user.id)
        .select("id");

      if (error) {
        throw error;
      }

      if (!updatedRuns || updatedRuns.length === 0) {
        alert("Kunne ikke gemme tidsstyringen. Du er muligvis ikke ejer af løbet.");
        return;
      }

      setRuns((prev) =>
        prev.map((run) =>
          run.id === activeRun.id
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

      setScheduleSharePin(ensuredSession.pin);
      setScheduleShareLink(buildJoinLink(ensuredSession.pin));
      setScheduleSessionSource(ensuredSession.source);
      setDidCopyScheduleAccess(false);
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
    const normalizedRaceType = normalizeRaceTypeThemeKey(run.race_type ?? run.raceType);
    const matchesRaceType = selectedRaceType === "Alle" || normalizedRaceType === selectedRaceType;
    return matchesSearch && matchesSubject && matchesRaceType;
  });
  const scheduleTheme = getRaceTypeTheme(scheduleRun?.race_type ?? scheduleRun?.raceType);

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
        <div className="mt-8 mb-10 grid max-w-6xl grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-end">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <p className="sm:col-span-2 mb-1 px-1 text-[11px] text-white/85 drop-shadow-md">
              Er du underviser? Filtrér efter fag og løbstype
            </p>

            {/* KATEGORIER / FAG DROPDOWN */}
            <div className="w-full">
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

            <div className="w-full">
              <label
                htmlFor="race-type-filter"
                className="mb-2 block px-1 text-xs font-semibold tracking-wide text-white drop-shadow-md"
              >
                Løbstype
              </label>
              <div className="relative">
                <select
                  id="race-type-filter"
                  value={selectedRaceType}
                  onChange={(e) => setSelectedRaceType(e.target.value)}
                  className="w-full cursor-pointer appearance-none rounded-2xl border border-white/50 bg-white/80 py-4 pr-12 pl-6 font-medium text-emerald-950 shadow-lg backdrop-blur-md transition-colors hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                >
                  {RACE_TYPE_FILTER_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-white py-2 text-emerald-950"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
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
                const theme = getRaceTypeTheme(run.race_type ?? run.raceType);
                const runSchedule = getRunSchedule(run);
                const formattedStart = formatDanishDateTime(runSchedule?.startAt);
                const formattedEnd = formatDanishDateTime(runSchedule?.endAt);
                const isScheduled = hasRunSchedule(runSchedule);
                const scheduleStatusLabel = isScheduled ? "Planlagt" : "Åben adgang";

                return (
                  <motion.div
                    key={run.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className={`group relative overflow-hidden rounded-[2rem] border bg-white/92 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${theme.archiveCardClass}`}
                  >
                    <div className={`-mx-5 -mt-5 mb-5 border-b border-white/10 px-5 py-5 ${theme.archiveHeaderClass}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                          {run.subject}
                        </span>
                        <span className="text-xs font-medium text-white/80">
                          {formatDanishDate(run.created_at)}
                        </span>
                      </div>

                      <div className="mt-4 flex items-start justify-between gap-3">
                        <h2
                          className={`max-w-[18rem] text-xl font-bold leading-tight text-white ${rubik.className}`}
                        >
                          {run.title}
                        </h2>
                        <span className="shrink-0 rounded-full border border-white/15 bg-black/10 px-3 py-1 text-[11px] font-black tracking-[0.22em] text-white uppercase">
                          {theme.label}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${theme.archiveStatusBadgeClass}`}
                        >
                          {isScheduled ? <Timer className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          {scheduleStatusLabel}
                        </span>
                      </div>
                    </div>

                    <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <MapPin className={`h-4 w-4 ${theme.archiveAccentIconClass}`} />
                      {getQuestionCount(run.questions)} poster
                    </p>

                    {isScheduled ? (
                      <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-700">
                        <Timer className={`h-4 w-4 ${theme.archiveAccentIconClass}`} />
                        {runSchedule?.startAt && runSchedule?.endAt
                          ? `Planlagt fra ${formattedStart ?? "ukendt tidspunkt"} til ${formattedEnd ?? "ukendt tidspunkt"}`
                          : runSchedule?.startAt
                            ? `Starter ${formattedStart ?? "ukendt tidspunkt"}`
                            : `Slutter ${formattedEnd ?? "ukendt tidspunkt"}`}
                      </p>
                    ) : null}

                    <div className="mt-5 border-t border-slate-200/80 pt-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => void handleStartRun(run.id)}
                          disabled={startingRunId === run.id}
                          className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black tracking-[0.16em] uppercase transition disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:min-w-[11rem] ${theme.archivePrimaryButtonClass}`}
                        >
                          {startingRunId === run.id ? (
                            "STARTER..."
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              Sæt i gang
                            </>
                          )}
                        </button>

                        <div className="flex flex-wrap items-center gap-2 sm:flex-1 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => openScheduleModal(run)}
                            className={`inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition ${theme.archiveGhostButtonClass}`}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            Planlæg
                          </button>

                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/resultater/${run.id}`)}
                            className={`inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition ${theme.archiveGhostButtonClass}`}
                          >
                            <BarChart className="h-3.5 w-3.5" />
                            Resultater
                          </button>

                          <button
                            type="button"
                            aria-label="Rediger løb"
                            title="Rediger løb"
                            onClick={() => handleEditRun(run)}
                            className={`grid h-9 w-9 place-items-center rounded-full transition ${theme.archiveGhostIconButtonClass}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            aria-label="Slet løb"
                            title="Slet løb"
                            onClick={() => void handleDeleteRun(run.id)}
                            className={`grid h-9 w-9 place-items-center rounded-full transition ${theme.archiveDangerIconButtonClass}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
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
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/95 p-6 text-white shadow-[0_32px_80px_rgba(2,24,19,0.42)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(110,231,183,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_38%)]" />

              <div className="relative">
                <div className={`-mx-6 -mt-6 mb-6 flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5 ${scheduleTheme.archiveHeaderClass}`}>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.32em] text-white/70 uppercase">
                      Tidsstyring
                    </p>
                    <h2 className={`mt-3 text-2xl font-black text-white ${rubik.className}`}>
                      {scheduleRun.title}
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
                      Vælg hvornår løbet automatisk skal åbne og lukke for deltagere på
                      join-siden.
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Luk"
                    onClick={closeScheduleModal}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveSchedule} className="mt-8 space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="schedule-start"
                      className="text-sm font-semibold text-white"
                    >
                      Start-tidspunkt
                    </label>
                    <input
                      id="schedule-start"
                      type="datetime-local"
                      value={scheduleStart}
                      onChange={(event) => setScheduleStart(event.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/30 focus:ring-2 focus:ring-white/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="schedule-end"
                      className="text-sm font-semibold text-white"
                    >
                      Slut-tidspunkt
                    </label>
                    <input
                      id="schedule-end"
                      type="datetime-local"
                      value={scheduleEnd}
                      onChange={(event) => setScheduleEnd(event.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-white/30 focus:ring-2 focus:ring-white/10"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white/80">
                    Lad et felt stå tomt, hvis løbet kun skal have et automatisk start- eller
                    sluttidspunkt.
                  </div>

                  {scheduleSharePin ? (
                    <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.22)]">
                      <div>
                        <p className="text-[11px] font-semibold tracking-[0.28em] text-white/70 uppercase">
                          {scheduleSessionSource === "reused" ? "Eksisterende adgang genbrugt" : "Ny adgang klar"}
                        </p>
                        <h3 className={`mt-2 text-lg font-black text-white ${rubik.className}`}>
                          Del PIN eller link med deltagerne
                        </h3>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
                        <span className="text-xs font-semibold tracking-wide text-white/75 uppercase">
                          PIN-kode
                        </span>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-2xl font-black tracking-[0.35em] text-white">
                          {scheduleSharePin}
                        </div>

                        <span className="text-xs font-semibold tracking-wide text-white/75 uppercase">
                          Delbart link
                        </span>
                        <div className="break-all rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/90">
                          {scheduleShareLink}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-white/75">
                          Deltagerne kan bruge PIN-koden på join-siden eller åbne linket direkte.
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleCopyScheduleAccess()}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.12] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.18]"
                        >
                          <Copy className="h-4 w-4" />
                          {didCopyScheduleAccess ? "KOPIERET" : "KOPIER LINK / PIN"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleStart("");
                        setScheduleEnd("");
                      }}
                      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${scheduleTheme.archiveGhostButtonClass}`}
                    >
                      Ryd tider
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingSchedule}
                      className={`rounded-2xl px-5 py-3 text-sm font-black tracking-[0.2em] uppercase transition disabled:cursor-wait disabled:opacity-70 ${scheduleTheme.archivePrimaryButtonClass}`}
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
