import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";

import ClearRunDataButton from "@/app/dashboard/resultater/[runId]/ClearRunDataButton";
import StoredAnswerImage from "@/app/dashboard/resultater/[runId]/StoredAnswerImage";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    runId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RunRecord = {
  id: string;
  title: string | null;
  user_id: string | null;
};

type LiveSessionRecord = {
  id: string;
  pin: string | null;
  status: string | null;
  created_at: string | null;
};

type AnswerRecord = {
  id: string;
  session_id: string | null;
  student_name: string | null;
  post_index: number | null;
  question_index: number | null;
  is_correct: boolean | null;
  image_url?: string | null;
  analysis_message?: string | null;
  answered_at: string | null;
  created_at: string | null;
};

type ParticipantRecord = {
  id: string;
  session_id: string | null;
  student_name: string | null;
  finished_at: string | null;
  last_updated: string | null;
};

type ParticipantSummary = {
  name: string;
  finishedAt: string | null;
  answers: AnswerRecord[];
};

type SessionSummary = LiveSessionRecord & {
  participantRows: ParticipantSummary[];
  answerCount: number;
  correctAnswerCount: number;
  durationMs: number;
  leaderboardName: string;
};

type LeaderboardEntry = {
  sessionId: string;
  pin: string | null;
  status: string | null;
  teamName: string;
  participantCount: number;
  answerCount: number;
  correctAnswerCount: number;
  durationMs: number;
};

type DbErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

type PageFeedback = {
  tone: "success" | "error";
  title: string;
  message: string;
};

const ACTIVE_STATUSES = new Set(["waiting", "running"]);
const PARTICIPANT_UPLOADS_BUCKET = "participant-uploads";
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const STORAGE_URL_PREFIXES = [
  `/storage/v1/object/public/${PARTICIPANT_UPLOADS_BUCKET}/`,
  `/storage/v1/object/authenticated/${PARTICIPANT_UPLOADS_BUCKET}/`,
  `/storage/v1/object/sign/${PARTICIPANT_UPLOADS_BUCKET}/`,
];

const normalizeStoragePath = (value: string) => {
  let normalized = value.trim().replace(/^\/+/, "");
  const bucketPrefix = `${PARTICIPANT_UPLOADS_BUCKET}/`;

  if (normalized.startsWith(bucketPrefix)) {
    normalized = normalized.slice(bucketPrefix.length);
  }

  return normalized;
};

const extractParticipantUploadPath = (imageUrl: string | null | undefined) => {
  const rawValue = imageUrl?.trim();
  if (!rawValue) return null;

  if (!rawValue.includes("://")) {
    const normalized = normalizeStoragePath(rawValue);
    return normalized.length > 0 ? normalized : null;
  }

  try {
    const parsedUrl = new URL(rawValue);
    const matchingPrefix = STORAGE_URL_PREFIXES.find((prefix) => parsedUrl.pathname.startsWith(prefix));

    if (!matchingPrefix) return null;

    const normalized = normalizeStoragePath(decodeURIComponent(parsedUrl.pathname.slice(matchingPrefix.length)));
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

const normalizeName = (value: string | null | undefined) => value?.trim() ?? "";

const readFirstQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Ukendt tidspunkt";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukendt tidspunkt";

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const isSessionLive = (status: string | null | undefined) =>
  typeof status === "string" && ACTIVE_STATUSES.has(status);

const getStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case "waiting":
      return "Lobby";
    case "running":
      return "Live nu";
    case "finished":
      return "Afsluttet";
    default:
      return "Ukendt";
  }
};

const getStatusClassName = (status: string | null | undefined) => {
  switch (status) {
    case "waiting":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "running":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "finished":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

const getSessionHighlightLabel = (status: string | null | undefined) => {
  switch (status) {
    case "waiting":
      return "Lobby klar";
    case "running":
      return "Live nu";
    case "finished":
      return "Historik";
    default:
      return "Ukendt";
  }
};

const getSessionHighlightClassName = (status: string | null | undefined) => {
  switch (status) {
    case "waiting":
      return "border-amber-300 bg-amber-100 text-amber-900";
    case "running":
      return "border-sky-300 bg-sky-100 text-sky-900";
    case "finished":
      return "border-emerald-300 bg-emerald-100 text-emerald-900";
    default:
      return "border-slate-300 bg-slate-100 text-slate-800";
  }
};

const getSessionCardClassName = (status: string | null | undefined) =>
  isSessionLive(status)
    ? "overflow-hidden rounded-[2rem] border border-sky-200/70 bg-white/95 shadow-[0_20px_60px_rgba(14,165,233,0.12)] backdrop-blur-md"
    : "overflow-hidden rounded-[2rem] border border-white/50 bg-white/90 shadow-xl backdrop-blur-md";

const getParticipantStateLabel = (finishedAt: string | null) => (finishedAt ? "I maal" : "Aktiv");

const getPostLabel = (answer: AnswerRecord) => {
  const rawIndex = typeof answer.post_index === "number" ? answer.post_index : answer.question_index;
  if (typeof rawIndex !== "number" || Number.isNaN(rawIndex)) return "Ukendt post";
  return rawIndex >= 1 ? `Post ${rawIndex}` : `Post ${rawIndex + 1}`;
};

const byNewestSession = (a: LiveSessionRecord, b: LiveSessionRecord) => {
  const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bTime - aTime;
};

const byAnswerTime = (a: AnswerRecord, b: AnswerRecord) => {
  const aTime = a.answered_at ?? a.created_at ?? "";
  const bTime = b.answered_at ?? b.created_at ?? "";
  return new Date(aTime).getTime() - new Date(bTime).getTime();
};

const parseTimestamp = (value: string | null | undefined) => {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const getSessionDurationMs = (sessionCreatedAt: string | null, sessionAnswers: AnswerRecord[]) => {
  let startTime = parseTimestamp(sessionCreatedAt);
  let endTime: number | null = null;

  for (const answer of sessionAnswers) {
    const timestamp = parseTimestamp(answer.created_at ?? answer.answered_at);
    if (timestamp === null) continue;

    if (startTime === null || timestamp < startTime) {
      startTime = timestamp;
    }

    if (endTime === null || timestamp > endTime) {
      endTime = timestamp;
    }
  }

  if (startTime === null || endTime === null) {
    return 0;
  }

  return Math.max(0, endTime - startTime);
};

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes} min ${String(seconds).padStart(2, "0")} sek`;
};

const getLeaderboardTeamName = (participantRows: ParticipantSummary[], sessionPin: string | null) => {
  const names = participantRows.map((participant) => participant.name).filter((name) => name.length > 0);

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} og ${names[1]}`;
  }

  if (names.length > 2) {
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  }

  return sessionPin ? `PIN ${sessionPin}` : "Ukendt hold";
};

const getLeaderboardMedal = (index: number) => {
  switch (index) {
    case 0:
      return "🥇";
    case 1:
      return "🥈";
    case 2:
      return "🥉";
    default:
      return `#${index + 1}`;
  }
};

const getLeaderboardCardClassName = (index: number) => {
  switch (index) {
    case 0:
      return "overflow-hidden rounded-[1.9rem] border border-amber-300/70 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(254,243,199,0.88))] p-5 shadow-[0_24px_60px_rgba(245,158,11,0.18)] backdrop-blur-md";
    case 1:
      return "overflow-hidden rounded-[1.9rem] border border-slate-300/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.96),rgba(226,232,240,0.88))] p-5 shadow-[0_22px_55px_rgba(100,116,139,0.16)] backdrop-blur-md";
    case 2:
      return "overflow-hidden rounded-[1.9rem] border border-orange-300/75 bg-[linear-gradient(145deg,rgba(255,247,237,0.96),rgba(254,215,170,0.88))] p-5 shadow-[0_22px_55px_rgba(234,88,12,0.16)] backdrop-blur-md";
    default:
      return "overflow-hidden rounded-[1.9rem] border border-white/60 bg-white/90 p-5 shadow-lg backdrop-blur-md";
  }
};

const getLeaderboardBadgeClassName = (index: number) => {
  switch (index) {
    case 0:
      return "border-amber-300 bg-amber-100 text-amber-900";
    case 1:
      return "border-slate-300 bg-slate-100 text-slate-800";
    case 2:
      return "border-orange-300 bg-orange-100 text-orange-900";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
};

const isMissingRelationOrColumnError = (error: DbErrorLike | null | undefined) => {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") {
    return true;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("relation") || message.includes("column");
};

const getFeedbackFromQuery = (searchParams: Record<string, string | string[] | undefined>): PageFeedback | null => {
  const cleared = readFirstQueryValue(searchParams.cleared);
  const error = readFirstQueryValue(searchParams.error);

  if (cleared === "1") {
    return {
      tone: "success",
      title: "Data ryddet",
      message: "Alle gemte billeder, besvarelser, deltagerspor og live-sessioner for dette loeb er slettet.",
    };
  }

  switch (error) {
    case "permission":
      return {
        tone: "error",
        title: "Adgang afvist",
        message: "Du har ikke adgang til at rydde data for dette loeb.",
      };
    case "delete_failed":
      return {
        tone: "error",
        title: "Sletning fejlede",
        message: "Vi kunne ikke rydde alle data. Tjek RLS og proev igen.",
      };
    default:
      return null;
  }
};

async function clearRunDataAction(runId: string) {
  "use server";

  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/resultater/${runId}`)}`);
  }

  const { data: run, error: runError } = await supabase
    .from("gps_runs")
    .select("id")
    .eq("id", runId)
    .eq("user_id", user.id)
    .single();

  if (runError || !run) {
    redirect(`/dashboard/resultater/${runId}?error=permission`);
  }

  const { data: sessionsData, error: sessionsError } = await supabase
    .from("live_sessions")
    .select("id")
    .eq("run_id", runId)
    .eq("teacher_id", user.id);

  if (sessionsError) {
    console.error("Kunne ikke hente live-sessioner til rydning:", sessionsError);
    redirect(`/dashboard/resultater/${runId}?error=delete_failed`);
  }

  const sessionIds = (sessionsData ?? [])
    .map((session) => String((session as { id?: string | number | null }).id ?? ""))
    .filter((sessionId) => sessionId.length > 0);

  if (sessionIds.length > 0) {
    const answersClient = adminSupabase ?? supabase;
    const storageClient = adminSupabase ?? supabase;
    const { data: answerImageRows, error: answerImagesError } = await answersClient
      .from("answers")
      .select("image_url")
      .in("session_id", sessionIds)
      .not("image_url", "is", null);

    if (answerImagesError && !isMissingRelationOrColumnError(answerImagesError)) {
      console.error("Kunne ikke hente billedstier til rydning:", answerImagesError);
      redirect(`/dashboard/resultater/${runId}?error=delete_failed`);
    }

    const imagePaths = Array.from(
      new Set(
        (answerImageRows ?? [])
          .map((row) => extractParticipantUploadPath((row as { image_url?: string | null }).image_url ?? null))
          .filter((path): path is string => Boolean(path))
      )
    );

    for (let index = 0; index < imagePaths.length; index += STORAGE_REMOVE_CHUNK_SIZE) {
      const chunk = imagePaths.slice(index, index + STORAGE_REMOVE_CHUNK_SIZE);
      const { error: storageDeleteError } = await storageClient.storage
        .from(PARTICIPANT_UPLOADS_BUCKET)
        .remove(chunk);

      if (storageDeleteError) {
        console.warn("Kunne ikke slette et eller flere deltagerbilleder fra Storage. Fortsaetter med databasen.", {
          paths: chunk,
          error: storageDeleteError,
        });
      }
    }

    for (const tableName of ["answers", "participants", "session_students", "session_messages", "messages"] as const) {
      const { error } = await supabase.from(tableName).delete().in("session_id", sessionIds);
      if (error && !isMissingRelationOrColumnError(error)) {
        console.error(`Kunne ikke rydde ${tableName}:`, error);
        redirect(`/dashboard/resultater/${runId}?error=delete_failed`);
      }
    }

    const { error: deleteSessionsError } = await supabase
      .from("live_sessions")
      .delete()
      .in("id", sessionIds)
      .eq("teacher_id", user.id);

    if (deleteSessionsError) {
      console.error("Kunne ikke rydde live_sessions:", deleteSessionsError);
      redirect(`/dashboard/resultater/${runId}?error=delete_failed`);
    }
  }

  revalidatePath("/dashboard/arkiv");
  revalidatePath(`/dashboard/resultater/${runId}`);
  redirect(`/dashboard/resultater/${runId}?cleared=1`);
}

function SessionSection({
  title,
  description,
  sessions,
}: {
  title: string;
  description: string;
  sessions: SessionSummary[];
}) {
  if (sessions.length === 0) return null;

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-white/50 bg-white/85 px-6 py-5 shadow-lg backdrop-blur-md">
        <h2 className={`text-2xl font-black text-emerald-950 ${rubik.className}`}>{title}</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900/75">{description}</p>
      </div>

      <div className="space-y-6">
        {sessions.map((session, index) => (
          <section key={session.id} className={getSessionCardClassName(session.status)}>
            <div className="flex flex-col gap-4 border-b border-emerald-100 px-6 py-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold tracking-[0.26em] text-emerald-700 uppercase">
                    Session {sessions.length - index}
                  </p>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${getSessionHighlightClassName(session.status)}`}
                  >
                    {getSessionHighlightLabel(session.status)}
                  </span>
                </div>

                <h3 className={`mt-3 text-2xl font-black text-emerald-950 ${rubik.className}`}>
                  PIN {session.pin || "----"}
                </h3>
                <p className="mt-2 text-sm text-emerald-900/75">Oprettet {formatDateTime(session.created_at)}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClassName(session.status)}`}>
                  {getStatusLabel(session.status)}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {session.participantRows.length} deltagere
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                  {session.answerCount} besvarelser
                </span>
              </div>
            </div>

            {session.participantRows.length === 0 ? (
              <div className="px-6 py-8 text-sm text-emerald-900/75">
                Ingen deltagere eller besvarelser er registreret for denne session endnu.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-emerald-100">
                  <thead className="bg-emerald-50/70">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold tracking-[0.18em] text-emerald-800 uppercase">
                        Deltager
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold tracking-[0.18em] text-emerald-800 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold tracking-[0.18em] text-emerald-800 uppercase">
                        Besvarelser
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 bg-white/80">
                    {session.participantRows.map((participant) => (
                      <tr key={`${session.id}-${participant.name}`}>
                        <td className="px-6 py-5 align-top">
                          <div className="font-semibold text-emerald-950">{participant.name}</div>
                          <div className="mt-1 text-xs text-emerald-900/65">
                            {participant.answers.length} registrerede besvarelser
                          </div>
                        </td>
                        <td className="px-6 py-5 align-top">
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                            {getParticipantStateLabel(participant.finishedAt)}
                          </span>
                          {participant.finishedAt ? (
                            <div className="mt-2 text-xs text-emerald-900/65">
                              Faerdig {formatDateTime(participant.finishedAt)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-6 py-5 align-top">
                          {participant.answers.length === 0 ? (
                            <span className="text-sm text-emerald-900/65">Ingen registrerede besvarelser endnu.</span>
                          ) : (
                            <div className="space-y-3">
                              {participant.answers.map((answer) => (
                                <div key={answer.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                                        answer.is_correct === false
                                          ? "border-rose-200 bg-rose-50 text-rose-800"
                                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      }`}
                                    >
                                      {getPostLabel(answer)} - {answer.is_correct === false ? "Forkert" : "Rigtig"}
                                    </span>
                                  </div>
                                  <StoredAnswerImage imageUrl={answer.image_url} />
                                  {answer.analysis_message ? (
                                    <p className="mt-2 text-xs leading-5 text-emerald-900/75">
                                      AI-note: {answer.analysis_message}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

function LeaderboardSection({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <section className="rounded-[2rem] border border-white/50 bg-white/88 p-5 shadow-xl backdrop-blur-md sm:p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.28em] text-amber-700 uppercase">Rangliste</p>
          <h2 className={`mt-2 text-3xl font-black text-emerald-950 sm:text-4xl ${rubik.className}`}>
            Holdenes placering
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-900/75">
            Sessionerne er sorteret efter flest rigtige svar og derefter hurtigste tid fra foerste til sidste
            registrerede svar.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-emerald-800 uppercase">
          {entries.length} sessioner
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {entries.map((entry, index) => (
          <article key={entry.sessionId} className={getLeaderboardCardClassName(index)}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-2xl font-black shadow-sm sm:h-16 sm:w-16 sm:text-3xl ${getLeaderboardBadgeClassName(index)}`}
                >
                  {getLeaderboardMedal(index)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-emerald-800 uppercase">
                      Plads {index + 1}
                    </span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-sky-800 uppercase">
                      {entry.pin ? `PIN ${entry.pin}` : "PIN ukendt"}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${getStatusClassName(entry.status)}`}>
                      {getStatusLabel(entry.status)}
                    </span>
                  </div>

                  <h3 className={`mt-3 break-words text-xl font-black text-emerald-950 sm:text-2xl ${rubik.className}`}>
                    {entry.teamName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-900/75">
                    {entry.participantCount > 0
                      ? `${entry.participantCount} deltagere i sessionen`
                      : "Ingen deltagernavne er registreret endnu."}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[24rem]">
                <div className="rounded-[1.5rem] border border-emerald-200/80 bg-white/75 px-4 py-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">Point</p>
                  <p className={`mt-2 text-3xl font-black text-emerald-950 ${rubik.className}`}>
                    {entry.correctAnswerCount}
                  </p>
                  <p className="mt-1 text-sm text-emerald-900/70">
                    {entry.answerCount > 0
                      ? `af ${entry.answerCount} registrerede svar var rigtige`
                      : "Ingen svar er registreret endnu"}
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-sky-200/80 bg-sky-50/85 px-4 py-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase">Tid</p>
                  <p className={`mt-2 text-2xl font-black text-sky-950 ${rubik.className}`}>
                    {formatDuration(entry.durationMs)}
                  </p>
                  <p className="mt-1 text-sm text-sky-900/70">
                    {entry.answerCount > 0 ? "Fra foerste til sidste svar" : "0 min fordi sessionen endnu er tom"}
                  </p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function RunResultsPage({ params, searchParams }: PageProps) {
  const { runId } = await params;
  const query = await searchParams;
  const feedback = getFeedbackFromQuery(query);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/resultater/${runId}`)}`);
  }

  const { data: run, error: runError } = await supabase
    .from("gps_runs")
    .select("id,title,user_id")
    .eq("id", runId)
    .eq("user_id", user.id)
    .single<RunRecord>();

  if (runError || !run) {
    notFound();
  }

  const { data: liveSessionsData, error: liveSessionsError } = await supabase
    .from("live_sessions")
    .select("id,pin,status,created_at")
    .eq("run_id", runId)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (liveSessionsError) {
    throw new Error(liveSessionsError.message);
  }

  const liveSessions = ((liveSessionsData ?? []) as LiveSessionRecord[]).sort(byNewestSession);
  const sessionIds = liveSessions.map((session) => session.id);

  let answers: AnswerRecord[] = [];
  let participants: ParticipantRecord[] = [];

  if (sessionIds.length > 0) {
    const fetchAnswersWithFallback = async () => {
      const fullSelect = await supabase
        .from("answers")
        .select("id,session_id,student_name,post_index,question_index,is_correct,image_url,analysis_message,answered_at,created_at")
        .in("session_id", sessionIds)
        .order("answered_at", { ascending: true });

      if (!fullSelect.error) {
        return (fullSelect.data ?? []) as AnswerRecord[];
      }

      if (!isMissingRelationOrColumnError(fullSelect.error)) {
        throw new Error(fullSelect.error.message);
      }

      const fallbackSelect = await supabase
        .from("answers")
        .select("id,session_id,student_name,post_index,question_index,is_correct,answered_at,created_at")
        .in("session_id", sessionIds)
        .order("answered_at", { ascending: true });

      if (fallbackSelect.error) {
        throw new Error(fallbackSelect.error.message);
      }

      return (fallbackSelect.data ?? []) as AnswerRecord[];
    };

    const [answersData, { data: participantsData, error: participantsError }] = await Promise.all([
      fetchAnswersWithFallback(),
      supabase
        .from("participants")
        .select("id,session_id,student_name,finished_at,last_updated")
        .in("session_id", sessionIds)
        .order("last_updated", { ascending: false }),
    ]);

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    answers = answersData;
    participants = (participantsData ?? []) as ParticipantRecord[];
  }

  const sessionsWithSummaries: SessionSummary[] = liveSessions.map((session) => {
    const sessionAllAnswers = answers.filter((answer) => answer.session_id === session.id).sort(byAnswerTime);
    const sessionAnswers = sessionAllAnswers.filter((answer) => normalizeName(answer.student_name).length > 0);
    const sessionParticipants = participants.filter(
      (participant) => participant.session_id === session.id && normalizeName(participant.student_name).length > 0
    );

    const participantNames = Array.from(
      new Set(
        [
          ...sessionParticipants.map((participant) => normalizeName(participant.student_name)),
          ...sessionAnswers.map((answer) => normalizeName(answer.student_name)),
        ].filter((name) => name.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, "da"));

    const participantRows: ParticipantSummary[] = participantNames.map((name) => {
      const normalizedLower = name.toLocaleLowerCase("da-DK");
      const participantEntry = sessionParticipants.find(
        (participant) => normalizeName(participant.student_name).toLocaleLowerCase("da-DK") === normalizedLower
      );
      const participantAnswers = sessionAnswers.filter(
        (answer) => normalizeName(answer.student_name).toLocaleLowerCase("da-DK") === normalizedLower
      );

      return {
        name,
        finishedAt: participantEntry?.finished_at ?? null,
        answers: participantAnswers,
      };
    });

    return {
      ...session,
      participantRows,
      answerCount: sessionAllAnswers.length,
      correctAnswerCount: sessionAllAnswers.filter((answer) => answer.is_correct === true).length,
      durationMs: getSessionDurationMs(session.created_at, sessionAllAnswers),
      leaderboardName: getLeaderboardTeamName(participantRows, session.pin),
    };
  });

  const leaderboardEntries: LeaderboardEntry[] = [...sessionsWithSummaries]
    .sort((a, b) => {
      if (b.correctAnswerCount !== a.correctAnswerCount) {
        return b.correctAnswerCount - a.correctAnswerCount;
      }

      if (a.durationMs !== b.durationMs) {
        return a.durationMs - b.durationMs;
      }

      const aTime = parseTimestamp(a.created_at) ?? 0;
      const bTime = parseTimestamp(b.created_at) ?? 0;
      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.leaderboardName.localeCompare(b.leaderboardName, "da");
    })
    .map((session) => ({
      sessionId: session.id,
      pin: session.pin,
      status: session.status,
      teamName: session.leaderboardName,
      participantCount: session.participantRows.length,
      answerCount: session.answerCount,
      correctAnswerCount: session.correctAnswerCount,
      durationMs: session.durationMs,
    }));

  const activeSessions = sessionsWithSummaries.filter((session) => isSessionLive(session.status));
  const historicalSessions = sessionsWithSummaries.filter((session) => !isSessionLive(session.status));
  const hasStoredData = sessionsWithSummaries.length > 0;
  const clearAction = clearRunDataAction.bind(null, run.id);

  return (
    <main
      className={`relative min-h-screen bg-gradient-to-t from-emerald-100 via-sky-50 to-sky-300 p-6 text-slate-900 lg:bg-none lg:bg-transparent lg:p-12 ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 -z-20 hidden h-full w-full object-cover lg:block"
        src="/arkiv-bg.mp4"
      />
      <div className="fixed inset-0 -z-10 hidden bg-gradient-to-b from-sky-900/20 to-emerald-900/60 backdrop-blur-[3px] lg:block" />

      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.28em] text-white/85 uppercase drop-shadow-md">
              Resultater
            </p>
            <h1 className={`mt-3 text-4xl font-black text-white drop-shadow-xl sm:text-5xl ${rubik.className}`}>
              {run.title?.trim() || "Ukendt loeb"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/90 drop-shadow-md md:text-base">
              Oversigt over live-sessioner, deltagere og registrerede besvarelser for dette loeb.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard/arkiv"
              className="inline-flex items-center justify-center rounded-2xl border border-white/50 bg-white/85 px-5 py-3 text-sm font-bold text-emerald-950 shadow-lg backdrop-blur-md transition hover:bg-white"
            >
              Tilbage til Arkiv
            </Link>

            <ClearRunDataButton action={clearAction} disabled={!hasStoredData} />
          </div>
        </div>

        {feedback ? (
          <section
            className={`mt-8 rounded-[1.75rem] border px-5 py-4 shadow-lg backdrop-blur-md ${
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-950"
                : "border-rose-200 bg-rose-50/95 text-rose-950"
            }`}
          >
            <h2 className={`text-lg font-black ${rubik.className}`}>{feedback.title}</h2>
            <p className="mt-1 text-sm leading-6">{feedback.message}</p>
          </section>
        ) : null}

        {!hasStoredData ? (
          <section className="mt-10 rounded-[2rem] border border-white/50 bg-white/85 p-8 shadow-xl backdrop-blur-md">
            <h2 className={`text-2xl font-black text-emerald-950 ${rubik.className}`}>Ingen resultater endnu</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-900/80">
              Der er endnu ikke oprettet nogen live-sessioner for dette loeb, saa der findes ingen resultater at vise.
            </p>
          </section>
        ) : (
          <div className="mt-10 space-y-10">
            <LeaderboardSection entries={leaderboardEntries} />

            <SessionSection
              title="Aktive sessioner"
              description="Her ligger lobbyer og live-loeb, som stadig er aabne eller i gang lige nu."
              sessions={activeSessions}
            />

            <SessionSection
              title="Historiske sessioner"
              description="Her ligger afsluttede afviklinger, som kun bruges som historiske resultatdata."
              sessions={historicalSessions}
            />
          </div>
        )}

        <section className="mt-10 rounded-[2rem] border border-white/50 bg-white/85 px-6 py-5 shadow-lg backdrop-blur-md">
          <h2 className={`text-xl font-black text-emerald-950 ${rubik.className}`}>Privatliv</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-900/80">
            Privatlivs-indstilling: Besvarelser og billeder slettes automatisk efter 30 dage for at beskytte
            deltagernes data.
          </p>
        </section>
      </div>
    </main>
  );
}
