"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { BarChart, Calendar, Copy, Edit2, FolderOpen, MapPin, Play, Plus, Search, Share2, Shield, Timer, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { poppins, rubik } from "@/lib/fonts";
import { useEffect, useState, type FormEvent } from "react";

import { Switch } from "@/components/ui/switch";
import RunExecutionShareModal from "@/components/archive/RunExecutionShareModal";
import { isRunExecutionSharingEnabled } from "@/lib/runExecutionShare";
import { formatGradeLevelBadge, normalizeGradeLevels } from "@/utils/gradeLevels";
import {
  asTrimmedString,
  getArchiveEditCapability,
  getNormalizedRunRaceType,
  getStrategoBasePreset,
  RACE_TYPE_CAPABILITIES,
  RACE_TYPES,
  RACE_TYPE_VALUES,
  type RaceType,
  type RunQuestionRecord,
  type StoredRunRecord,
} from "@/utils/gpsRuns";
import { buildRunScheduleUpdate, getRunSchedule, hasRunSchedule } from "@/utils/runSchedule";
import { ARCHIVE_SUBJECT_FILTER_OPTIONS } from "@/utils/subjects";
import { createClient } from "@/utils/supabase/client";

type Run = Omit<StoredRunRecord, "title" | "subject" | "description" | "topic" | "questions" | "created_at"> & {
  id: string;
  title: string;
  subject: string;
  topic: string | null;
  description: string | null;
  questions: RunQuestionRecord[] | null;
  grade_levels?: string[] | null;
  created_at: string;
  raceType: RaceType | null;
  race_type: RaceType | null;
  liveSession?: LiveSession | null;
  [key: string]: unknown;
};

type ArchivedRunRow = StoredRunRecord & {
  created_at: string;
};

type LiveSession = {
  id: string;
  pin: string | null;
  status: string | null;
};

type LiveSessionRow = LiveSession & {
  run_id: string;
  created_at: string;
};

type RaceTypeFilterValue = "Alle" | RaceType;

const RACE_TYPE_FILTER_OPTIONS: ReadonlyArray<{ value: RaceTypeFilterValue; label: string }> = [
  { value: "Alle", label: "Alle" },
  ...RACE_TYPE_VALUES.map((raceType) => ({
    value: raceType,
    label: RACE_TYPE_CAPABILITIES[raceType].label,
  })),
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

const getArchiveContentSummary = (run: Run) => {
  const normalizedRaceType = getNormalizedRunRaceType(run);

  if (normalizedRaceType === RACE_TYPES.ZONE_KRIG) {
    const zoneCount = getQuestionCount(run.questions);
    return {
      label: `${zoneCount} ${zoneCount === 1 ? "zone" : "zoner"}`,
      Icon: MapPin,
    };
  }

  if (normalizedRaceType === RACE_TYPES.STRATEGO) {
    const preset = getStrategoBasePreset(run);
    const baseCount = Number(Boolean(preset.redBase)) + Number(Boolean(preset.blueBase));

    return {
      label:
        baseCount === 0
          ? "Ingen base gemt"
          : baseCount === 2
            ? "Base-preset gemt"
            : "1 base gemt",
      Icon: Shield,
    };
  }

  if (normalizedRaceType === RACE_TYPES.FIND_BEDRAGEREN) {
    return {
      label: "Hemmeligt ord gemt",
      Icon: Shield,
    };
  }

  const questionCount = getQuestionCount(run.questions);
  return {
    label: `${questionCount} poster`,
    Icon: MapPin,
  };
};

const QUICK_TOGGLE_EXCLUDED_RACE_TYPES = new Set<RaceType>(["zone_krig", "scanner", RACE_TYPES.FIND_BEDRAGEREN]);
const ARCHIVE_SCHEDULE_EXCLUDED_RACE_TYPES = new Set<RaceType>([RACE_TYPES.FIND_BEDRAGEREN]);

const normalizeArchivedRun = (run: ArchivedRunRow): Run => {
  const normalizedRaceType = getNormalizedRunRaceType(run);

  return {
    ...run,
    title: asTrimmedString(run.title) || "Løb uden titel",
    subject: asTrimmedString(run.subject) || "Ukendt fag",
    description: typeof run.description === "string" ? run.description : null,
    topic: typeof run.topic === "string" ? run.topic : null,
    questions: Array.isArray(run.questions) ? (run.questions as RunQuestionRecord[]) : null,
    race_type: normalizedRaceType,
    raceType: normalizedRaceType,
  };
};

const canQuickToggleRun = (run: Run) => {
  const raceType = getNormalizedRunRaceType(run);
  return Boolean(raceType && !QUICK_TOGGLE_EXCLUDED_RACE_TYPES.has(raceType));
};

const isFindBedragerenRun = (run: Run) => getNormalizedRunRaceType(run) === RACE_TYPES.FIND_BEDRAGEREN;

const canStartRunFromArchive = (run: Run) => {
  const raceType = getNormalizedRunRaceType(run);
  return Boolean(raceType);
};

const canScheduleRunFromArchive = (run: Run) => {
  const raceType = getNormalizedRunRaceType(run);
  return Boolean(raceType && !ARCHIVE_SCHEDULE_EXCLUDED_RACE_TYPES.has(raceType));
};

const isLobbyOpen = (run: Run) => {
  const status = run.liveSession?.status ?? null;
  return status === "waiting" || status === "running" || status === "active";
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

const buildJoinLink = (pin: string) => {
  const path = `/join?pin=${encodeURIComponent(pin)}`;
  return typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
};

type ArchiveLiveSessionMutationAction = "ensure" | "finish";

type ArchiveLiveSessionMutationResult = {
  session: LiveSession | null;
  source: "created" | "reused" | null;
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

async function requestArchiveLiveSessionMutation(
  runId: string,
  action: ArchiveLiveSessionMutationAction
): Promise<ArchiveLiveSessionMutationResult> {
  const response = await fetch("/api/archive/live-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ runId, action }),
  });

  let body: { error?: string; session?: LiveSession | null; source?: "created" | "reused" | null } | null = null;

  try {
    body = (await response.json()) as { error?: string; session?: LiveSession | null; source?: "created" | "reused" | null };
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error ?? "Kunne ikke opdatere løbets lobby-status.");
  }

  return {
    session: body?.session ?? null,
    source: body?.source ?? null,
  };
}

async function requestFindBedragerenSessionMutation(runId: string): Promise<ArchiveLiveSessionMutationResult> {
  const response = await fetch("/api/find-bedrageren/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ runId }),
  });

  let body: { error?: string; session?: LiveSession | null; source?: "created" | "reused" | null } | null = null;

  try {
    body = (await response.json()) as { error?: string; session?: LiveSession | null; source?: "created" | "reused" | null };
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error ?? "Kunne ikke åbne Find Bedrageren-lobbyen.");
  }

  return {
    session: body?.session ?? null,
    source: body?.source ?? null,
  };
}

type ArchivedRunCardProps = {
  run: Run;
  isStarting: boolean;
  onStartRun: (run: Run) => Promise<void>;
  onToggleLobby: (run: Run, nextEnabled: boolean) => Promise<void>;
  onOpenSchedule: (run: Run) => void;
  onOpenResults: (runId: string) => void;
  onOpenShare: (run: Run) => void;
  onEditRun: (run: Run) => void;
  onDeleteRun: (runId: string) => Promise<void>;
};

function ArchivedRunCard({
  run,
  isStarting,
  onStartRun,
  onToggleLobby,
  onOpenSchedule,
  onOpenResults,
  onOpenShare,
  onEditRun,
  onDeleteRun,
}: ArchivedRunCardProps) {
  const raceType = getNormalizedRunRaceType(run) ?? run.race_type ?? run.raceType;
  const raceTypeLabel = raceType ? RACE_TYPE_CAPABILITIES[raceType].label : "Løb";
  const gradeLevels = normalizeGradeLevels(run.grade_levels);
  const runSchedule = getRunSchedule(run);
  const contentSummary = getArchiveContentSummary(run);
  const formattedStart = formatDanishDateTime(runSchedule?.startAt);
  const formattedEnd = formatDanishDateTime(runSchedule?.endAt);
  const isScheduled = hasRunSchedule(runSchedule);
  const scheduleStatusLabel = isScheduled ? "Planlagt" : "Åben adgang";
  const [isToggling, setIsToggling] = useState(false);
  const [pendingChecked, setPendingChecked] = useState<boolean | null>(null);

  const showQuickToggle = canQuickToggleRun(run);
  const showLiveControls = canStartRunFromArchive(run);
  const showScheduleControls = canScheduleRunFromArchive(run);
  const isFindBedrageren = isFindBedragerenRun(run);
  const archiveEdit = getArchiveEditCapability(run.id, run.race_type ?? run.raceType);
  const lobbyIsOpen = isLobbyOpen(run);
  const switchChecked = pendingChecked ?? lobbyIsOpen;
  const quickToggleLabel = isToggling ? (switchChecked ? "Åbner..." : "Lukker...") : switchChecked ? "Åben" : "Lukket";
  const primaryButtonLabel = isFindBedrageren
    ? lobbyIsOpen
      ? run.liveSession?.pin
        ? `Åbn lobby · PIN ${run.liveSession.pin}`
        : "Åbn lobby"
      : "Start lobby"
    : showLiveControls
      ? lobbyIsOpen
        ? run.liveSession?.pin
          ? `Åbn lobby · PIN ${run.liveSession.pin}`
          : "Åbn lobby"
        : "Start løb"
      : "Kan startes senere";

  const handleToggle = async (nextEnabled: boolean) => {
    setPendingChecked(nextEnabled);
    setIsToggling(true);

    try {
      await onToggleLobby(run, nextEnabled);
    } finally {
      setPendingChecked(null);
      setIsToggling(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-3xl border border-sky-100 bg-white p-5 shadow-[0_12px_30px_rgba(7,26,58,0.08)] transition hover:border-sky-200 hover:shadow-[0_16px_36px_rgba(3,119,216,0.12)]"
    >
      <div className="-mx-5 -mt-5 mb-5 border-b border-sky-100 bg-sky-50 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <span className="max-w-[8rem] truncate rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-900">
            {run.subject}
          </span>

          <div className="flex items-center gap-3">
            {showQuickToggle ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-2.5 py-1.5">
                <span className="text-[10px] font-black tracking-[0.16em] text-slate-700 uppercase">
                  {quickToggleLabel}
                </span>
                <Switch
                  checked={switchChecked}
                  onCheckedChange={(checked) => void handleToggle(checked)}
                  disabled={isToggling || isStarting}
                  ariaLabel={`Skift lobby-status for ${run.title}`}
                />
              </div>
            ) : null}

            <span className="text-xs font-medium text-slate-500">
              {formatDanishDate(run.created_at)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <h2
            className={`line-clamp-2 max-w-[18rem] break-words text-xl font-bold leading-tight text-[var(--skolegps-deep-navy)] ${rubik.className}`}
          >
            {run.title}
          </h2>
          <span className="shrink-0 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-sky-800 uppercase">
            {raceTypeLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold text-sky-800">
            {isScheduled ? <Timer className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {scheduleStatusLabel}
          </span>

          {lobbyIsOpen ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
              <Play className="h-3 w-3" />
              Lobby åben
            </span>
          ) : null}

          {gradeLevels.map((gradeLevel) => (
            <span
              key={`${run.id}-${gradeLevel}`}
              className="inline-flex items-center whitespace-nowrap rounded-full border border-sky-100 bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-slate-600"
            >
              {formatGradeLevelBadge(gradeLevel)}
            </span>
          ))}
        </div>
      </div>

      <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <contentSummary.Icon className="h-4 w-4 text-sky-700" />
        {contentSummary.label}
      </p>

      {isScheduled ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-700">
          <Timer className="h-4 w-4 text-sky-700" />
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
            onClick={() => {
              if (showLiveControls) {
                void onStartRun(run);
              }
            }}
            disabled={!showLiveControls || isStarting || isToggling}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--skolegps-blue)] px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:min-w-44"
          >
            {isStarting ? (
              "ÅBNER..."
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                {primaryButtonLabel}
              </>
            )}
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:flex-1 sm:justify-end">
            {showScheduleControls ? (
              <button
                type="button"
                onClick={() => onOpenSchedule(run)}
                className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-sky-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <Calendar className="h-3.5 w-3.5" />
                Planlæg
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onOpenResults(run.id)}
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-sky-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
            >
              <BarChart className="h-3.5 w-3.5" />
              Resultater
            </button>

            {isRunExecutionSharingEnabled() ? (
              <button
                type="button"
                onClick={() => onOpenShare(run)}
                className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-sky-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <Share2 className="h-3.5 w-3.5" />
                Del til afvikling
              </button>
            ) : null}

            {archiveEdit.status === "supported" ? (
              <button
                type="button"
                aria-label="Rediger løb"
                title="Rediger løb"
                onClick={() => onEditRun(run)}
                className="grid h-9 w-9 place-items-center rounded-full border border-sky-200 bg-white text-sky-800 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            ) : (
              <p
                role="status"
                className="max-w-56 text-xs font-medium leading-5 text-slate-600"
              >
                {archiveEdit.reason}
              </p>
            )}

            <button
              type="button"
              aria-label="Slet løb"
              title="Slet løb"
              onClick={() => void onDeleteRun(run.id)}
              className="grid h-9 w-9 place-items-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CreateNewRunCard() {
  return (
    <Link href="/dashboard/opret/valg" className="flex h-full text-left">
      <div className="group flex h-full min-h-64 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sky-200 bg-white px-6 py-8 text-center shadow-[0_12px_30px_rgba(7,26,58,0.08)] transition hover:border-sky-300 hover:shadow-[0_16px_36px_rgba(3,119,216,0.12)]">
        <div className="flex flex-col items-center justify-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--skolegps-blue)] text-white shadow-[0_12px_24px_rgba(3,119,216,0.2)]">
            <Plus className="h-9 w-9" />
          </span>

          <div>
            <p className={`text-xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
              Opret et løb
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">Vælg en løbsbygger og kom i gang.</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ArkivPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Alle");
  const [selectedRaceType, setSelectedRaceType] = useState<RaceTypeFilterValue>("Alle");
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
  const [shareRun, setShareRun] = useState<Run | null>(null);

  const handleEditRun = (run: Run) => {
    const archiveEdit = getArchiveEditCapability(run.id, run.race_type ?? run.raceType);

    if (archiveEdit.status !== "supported") {
      alert(archiveEdit.reason);
      return;
    }

    router.push(archiveEdit.href);
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

      const { data: liveSessionData, error: liveSessionError } = await supabase
        .from("live_sessions")
        .select("id,run_id,pin,status,created_at")
        .eq("teacher_id", user.id)
        .in("status", ["waiting", "running", "active"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fejl ved hentning af løb:", error);
        alert("Kunne ikke hente løbsarkivet.");
      } else {
        if (liveSessionError) {
          console.error("Fejl ved hentning af aktive lobbysessioner:", liveSessionError);
        }

        const liveSessionMap = new Map<string, LiveSession>();
        for (const session of ((liveSessionData ?? []) as LiveSessionRow[])) {
          if (!liveSessionMap.has(session.run_id)) {
            liveSessionMap.set(session.run_id, {
              id: session.id,
              pin: typeof session.pin === "string" ? session.pin.trim() : null,
              status: session.status,
            });
          }
        }

        setRuns(
          ((((data ?? []) as ArchivedRunRow[]) ?? []).map(normalizeArchivedRun)).map((run) => ({
            ...run,
            liveSession: liveSessionMap.get(run.id) ?? null,
          }))
        );
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

  const updateRunLiveSession = (runId: string, nextSession: LiveSession | null) => {
    setRuns((previous) =>
      previous.map((run) =>
        run.id === runId
          ? {
              ...run,
              liveSession: nextSession,
            }
          : run
      )
    );
  };

  const resetScheduleAccessDetails = () => {
    setScheduleSharePin("");
    setScheduleShareLink("");
    setScheduleSessionSource(null);
    setDidCopyScheduleAccess(false);
  };

  const handleToggleLobby = async (run: Run, nextEnabled: boolean) => {
    const previousSession = run.liveSession ?? null;

    updateRunLiveSession(
      run.id,
      nextEnabled
        ? previousSession ?? { id: `pending-${run.id}`, pin: null, status: "waiting" }
        : null
    );

    try {
      const result = await requestArchiveLiveSessionMutation(run.id, nextEnabled ? "ensure" : "finish");
      updateRunLiveSession(run.id, result.session);
    } catch (error) {
      updateRunLiveSession(run.id, previousSession);
      console.error("Kunne ikke skifte lobby-status:", error);
      alert(error instanceof Error ? error.message : "Kunne ikke skifte løbets lobby-status.");
      throw error;
    }
  };

  const handleStartRun = async (run: Run) => {
    if (isFindBedragerenRun(run)) {
      if (run.liveSession?.id && isLobbyOpen(run)) {
        router.push(`/dashboard/live/${run.liveSession.id}/find-bedrageren`);
        return;
      }

      setStartingRunId(run.id);

      try {
        const result = await requestFindBedragerenSessionMutation(run.id);
        updateRunLiveSession(run.id, result.session);

        if (result.session?.id) {
          router.push(`/dashboard/live/${result.session.id}/find-bedrageren`);
        }
      } catch (error) {
        console.error("Kunne ikke åbne Find Bedrageren-lobbyen fra arkivet:", error);
        alert(error instanceof Error ? error.message : "Der skete en fejl. Prøv igen.");
      } finally {
        setStartingRunId(null);
      }

      return;
    }

    if (!canStartRunFromArchive(run)) {
      alert("Denne aktivitet kan ikke startes her.");
      return;
    }

    if (run.liveSession?.id && isLobbyOpen(run)) {
      router.push(`/dashboard/live/${run.liveSession.id}`);
      return;
    }

    setStartingRunId(run.id);

    try {
      const result = await requestArchiveLiveSessionMutation(run.id, "ensure");
      updateRunLiveSession(run.id, result.session);

      if (result.session?.id) {
        router.push(`/dashboard/live/${result.session.id}`);
      }
    } catch (error) {
      console.error("Kunne ikke åbne lobbyen fra arkivet:", error);
      alert(error instanceof Error ? error.message : "Der skete en fejl. Prøv igen.");
    } finally {
      setStartingRunId(null);
    }
  };

  const openScheduleModal = (run: Run) => {
    if (!canScheduleRunFromArchive(run)) {
      alert("Find Bedrageren kan planlægges senere.");
      return;
    }

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
        alert("Du skal vaere logget ind for at planlaegge et loeb.");
        return;
      }

      const ensuredSession = await requestArchiveLiveSessionMutation(activeRun.id, "ensure");
      updateRunLiveSession(activeRun.id, ensuredSession.session);

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

          const sharePin = ensuredSession.session?.pin ?? "";
          setScheduleSharePin(sharePin);
          setScheduleShareLink(sharePin ? buildJoinLink(sharePin) : "");
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
    const normalizedRaceType = getNormalizedRunRaceType(run);
    const matchesRaceType = selectedRaceType === "Alle" || normalizedRaceType === selectedRaceType;
    return matchesSearch && matchesSubject && matchesRaceType;
  });

  return (
    <main
      className={`min-h-screen bg-[#f4f9ff] p-5 text-slate-950 sm:p-6 lg:p-10 ${poppins.className}`}
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 max-w-3xl">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
            <FolderOpen className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold tracking-[0.18em] text-sky-800 uppercase">Løbsarkiv</p>
          <h1 className={`mt-2 text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-4xl ${rubik.className}`}>
            Dine gemte løb
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Åbn et tidligere løb, se resultater eller opret et nyt.
          </p>
        </header>

        <div className="mb-8 grid max-w-6xl grid-cols-1 gap-4 rounded-3xl border border-sky-100 bg-white p-4 shadow-[0_12px_30px_rgba(7,26,58,0.08)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-end">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sky-700/70">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Søg i løb..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-4 pr-4 pl-12 text-slate-950 shadow-sm transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <p className="sm:col-span-2 mb-1 px-1 text-sm font-black text-[var(--skolegps-deep-navy)]">
              Filtre
            </p>

            <div className="w-full">
              <label
                htmlFor="subject-filter"
                className="mb-2 block px-1 text-xs font-bold text-slate-600"
              >
                Fag
              </label>
              <div className="relative">
                <select
                  id="subject-filter"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-white py-4 pr-12 pl-6 font-semibold text-slate-900 shadow-sm transition-colors hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  {ARCHIVE_SUBJECT_FILTER_OPTIONS.map((subj) => (
                    <option key={subj} value={subj} className="bg-white py-2 text-slate-950">
                      {subj}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sky-700">
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
                className="mb-2 block px-1 text-xs font-bold text-slate-600"
              >
                Løbstype
              </label>
              <div className="relative">
                <select
                  id="race-type-filter"
                  value={selectedRaceType}
                  onChange={(e) => setSelectedRaceType(e.target.value as RaceTypeFilterValue)}
                  className="w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-white py-4 pr-12 pl-6 font-semibold text-slate-900 shadow-sm transition-colors hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  {RACE_TYPE_FILTER_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-white py-2 text-slate-950"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sky-700">
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
          <CreateNewRunCard />

          <AnimatePresence>
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full rounded-3xl border border-sky-100 bg-white p-8 text-center font-semibold text-slate-700 shadow-[0_12px_30px_rgba(7,26,58,0.08)]"
              >
                Henter løb fra arkivet...
              </motion.div>
            ) : filteredRuns.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full rounded-3xl border border-sky-100 bg-white p-8 text-center shadow-[0_12px_30px_rgba(7,26,58,0.08)]"
              >
                <div className="mx-auto max-w-md">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
                    {runs.length === 0 ? <Plus className="h-6 w-6" /> : <Search className="h-6 w-6" />}
                  </div>
                  <h2 className={`mt-4 text-xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
                    {runs.length === 0 ? "Ingen gemte løb endnu" : "Ingen løb fundet"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {runs.length === 0
                      ? "Når du har oprettet et løb, ligger det klar her."
                      : "Prøv en anden søgning eller ryd filtrene."}
                  </p>
                  {runs.length === 0 ? (
                    <Link
                      href="/dashboard/opret/valg"
                      className="mt-5 inline-flex items-center justify-center rounded-2xl bg-[var(--skolegps-blue)] px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
                    >
                      Opret dit første løb
                    </Link>
                  ) : null}
                </div>
              </motion.div>
            ) : (
              filteredRuns.map((run) => {
                return (
                  <ArchivedRunCard
                    key={run.id}
                    run={run}
                    isStarting={startingRunId === run.id}
                    onStartRun={handleStartRun}
                    onToggleLobby={handleToggleLobby}
                    onOpenSchedule={openScheduleModal}
                    onOpenResults={(runId) => router.push(`/dashboard/resultater/${runId}`)}
                    onOpenShare={setShareRun}
                    onEditRun={handleEditRun}
                    onDeleteRun={handleDeleteRun}
                  />
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
              className="absolute inset-0 bg-slate-950/45"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-sky-100 bg-white p-6 text-slate-950 shadow-[0_32px_80px_rgba(7,26,58,0.22)]"
            >
              <div>
                <div className="-mx-6 -mt-6 mb-6 flex items-start justify-between gap-4 border-b border-sky-100 bg-sky-50 px-6 py-5">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-sky-800 uppercase">
                      Tidsstyring
                    </p>
                    <h2 className={`mt-3 line-clamp-2 break-words text-2xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
                      {scheduleRun.title}
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                      Vælg hvornår løbet automatisk skal åbne og lukke for deltagere på
                      join-siden.
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Luk"
                    onClick={closeScheduleModal}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-sky-200 bg-white text-sky-800 transition hover:bg-sky-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveSchedule} className="mt-8 space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="schedule-start"
                      className="text-sm font-semibold text-slate-800"
                    >
                      Start-tidspunkt
                    </label>
                    <input
                      id="schedule-start"
                      type="datetime-local"
                      value={scheduleStart}
                      onChange={(event) => setScheduleStart(event.target.value)}
                      className="w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="schedule-end"
                      className="text-sm font-semibold text-slate-800"
                    >
                      Slut-tidspunkt
                    </label>
                    <input
                      id="schedule-end"
                      type="datetime-local"
                      value={scheduleEnd}
                      onChange={(event) => setScheduleEnd(event.target.value)}
                      className="w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    Lad et felt stå tomt, hvis løbet kun skal have et automatisk start- eller
                    sluttidspunkt.
                  </div>

                  {scheduleSharePin ? (
                    <div className="space-y-4 rounded-3xl border border-sky-100 bg-sky-50 p-4">
                      <div>
                        <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-800 uppercase">
                          {scheduleSessionSource === "reused" ? "Eksisterende adgang genbrugt" : "Ny adgang klar"}
                        </p>
                        <h3 className={`mt-2 text-lg font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
                          Del PIN eller link med deltagerne
                        </h3>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
                        <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                          PIN-kode
                        </span>
                        <div className="rounded-2xl border border-sky-200 bg-white px-4 py-3 text-2xl font-black tracking-[0.35em] text-[var(--skolegps-deep-navy)]">
                          {scheduleSharePin}
                        </div>

                        <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                          Delbart link
                        </span>
                        <div className="break-all rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                          {scheduleShareLink}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-slate-600">
                          Deltagerne kan bruge PIN-koden på join-siden eller åbne linket direkte.
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleCopyScheduleAccess()}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-bold text-sky-800 transition hover:bg-sky-100"
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
                      className="rounded-2xl border border-sky-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-sky-50"
                    >
                      Ryd tider
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingSchedule}
                      className="rounded-2xl bg-[var(--skolegps-blue)] px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-70"
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

      {shareRun ? (
        <RunExecutionShareModal
          run={{
            id: shareRun.id,
            title: shareRun.title,
            raceType: getNormalizedRunRaceType(shareRun),
          }}
          onClose={() => setShareRun(null)}
        />
      ) : null}
    </main>
  );
}
