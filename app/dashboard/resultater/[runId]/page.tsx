import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";

import ClearRunDataButton from "@/app/dashboard/resultater/[runId]/ClearRunDataButton";
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
      message: "Alle besvarelser, deltagerspor og live-sessioner for dette loeb er slettet.",
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
                            <div className="flex flex-wrap gap-2">
                              {participant.answers.map((answer) => (
                                <span
                                  key={answer.id}
                                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                                    answer.is_correct === false
                                      ? "border-rose-200 bg-rose-50 text-rose-800"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  }`}
                                >
                                  {getPostLabel(answer)} - {answer.is_correct === false ? "Forkert" : "Rigtig"}
                                </span>
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
    const [{ data: answersData, error: answersError }, { data: participantsData, error: participantsError }] =
      await Promise.all([
        supabase
          .from("answers")
          .select("id,session_id,student_name,post_index,question_index,is_correct,answered_at,created_at")
          .in("session_id", sessionIds)
          .order("answered_at", { ascending: true }),
        supabase
          .from("participants")
          .select("id,session_id,student_name,finished_at,last_updated")
          .in("session_id", sessionIds)
          .order("last_updated", { ascending: false }),
      ]);

    if (answersError) {
      throw new Error(answersError.message);
    }

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    answers = (answersData ?? []) as AnswerRecord[];
    participants = (participantsData ?? []) as ParticipantRecord[];
  }

  const sessionsWithSummaries: SessionSummary[] = liveSessions.map((session) => {
    const sessionAnswers = answers
      .filter((answer) => answer.session_id === session.id && normalizeName(answer.student_name).length > 0)
      .sort(byAnswerTime);
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
      answerCount: sessionAnswers.length,
    };
  });

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
