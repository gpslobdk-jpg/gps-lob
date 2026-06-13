import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Eye,
  KeyRound,
  ListChecks,
  RefreshCw,
  Trophy,
  UserCheck,
  UserSearch,
  Users,
} from "lucide-react";

import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import StartFindBedragerenGameButton from "./StartFindBedragerenGameButton";
import StartFindBedragerenDiscussionButton from "./StartFindBedragerenDiscussionButton";

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
    sessionId: string;
  }>;
};

type LiveSessionRow = {
  id: string;
  run_id: string | null;
  teacher_id: string | null;
  pin: string | null;
  status: string | null;
  created_at: string | null;
};

type RunRow = {
  id: string;
  user_id: string | null;
  title: string | null;
  subject: string | null;
  race_type?: unknown;
};

type FindBedragerenSessionRow = {
  live_session_id: string;
  gps_run_id: string;
  game_id: string;
  phase: string;
  secret_word_snapshot: string;
  impostor_count_snapshot: number;
  roles_assigned_at: string | null;
  created_at: string | null;
};

type FindBedragerenPlayerRow = {
  participant_id: string;
  student_name: string | null;
  has_seen_role: boolean | null;
  created_at: string | null;
};

type FindBedragerenResultPlayerRow = {
  participant_id: string;
  student_name: string | null;
  player_role: string | null;
};

type FindBedragerenVoteResultRow = {
  suspect_participant_id: string | null;
};

type FindBedragerenResultSuspect = {
  participantId: string;
  studentName: string;
  voteCount: number;
  isImpostor: boolean;
};

type FindBedragerenResult = {
  topSuspectParticipantId: string | null;
  topSuspectName: string | null;
  topSuspectIsImpostor: boolean | null;
  voteCount: number;
  totalVotes: number;
  tied: boolean;
  suspects: FindBedragerenResultSuspect[];
};

const phaseLabels: Record<string, string> = {
  lobby: "Lobby",
  reveal: "Rollevisning",
  discussion: "Diskussion",
  voting: "Afstemning",
  results: "Resultater",
  finished: "Afsluttet",
};

const phaseDescriptions: Record<string, string> = {
  lobby: "Eleverne joiner med koden og venter på, at rollerne bliver fordelt.",
  reveal: "Rollerne er fordelt. Eleverne kan privat se deres rolle på deres egen skærm.",
  discussion: "Diskussionen er i gang.",
  voting: "Eleverne stemmer på, hvem de tror er bedrageren.",
  results: "Resultatet kan gennemgås med klassen.",
  finished: "Spillet er afsluttet.",
};

const phaseOrder = ["lobby", "reveal", "discussion", "voting", "results", "finished"];

function asDisplayText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Ukendt tidspunkt";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukendt tidspunkt";

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isPlayerAssigned(playerCreatedAt: string | null | undefined, rolesAssignedAt: string | null) {
  if (!playerCreatedAt || !rolesAssignedAt) return false;

  const playerTimestamp = new Date(playerCreatedAt).getTime();
  const assignedTimestamp = new Date(rolesAssignedAt).getTime();

  if (Number.isNaN(playerTimestamp) || Number.isNaN(assignedTimestamp)) return false;

  return playerTimestamp <= assignedTimestamp;
}

function getPhaseIndex(phase: string) {
  const index = phaseOrder.indexOf(phase);
  return index >= 0 ? index : 0;
}

function buildResult(
  players: FindBedragerenResultPlayerRow[],
  votes: FindBedragerenVoteResultRow[]
): FindBedragerenResult {
  const voteCounts = new Map(players.map((player) => [player.participant_id, 0]));
  let totalVotes = 0;

  votes.forEach((vote) => {
    const suspectId = asDisplayText(vote.suspect_participant_id, "");
    if (voteCounts.has(suspectId)) {
      voteCounts.set(suspectId, (voteCounts.get(suspectId) ?? 0) + 1);
      totalVotes += 1;
    }
  });

  const suspects = players.map((player) => ({
    participantId: player.participant_id,
    studentName: asDisplayText(player.student_name, "Elev"),
    voteCount: voteCounts.get(player.participant_id) ?? 0,
    isImpostor: player.player_role === "impostor",
  }));
  if (totalVotes === 0 || suspects.length === 0) {
    return {
      topSuspectParticipantId: null,
      topSuspectName: null,
      topSuspectIsImpostor: null,
      voteCount: 0,
      totalVotes,
      tied: false,
      suspects,
    };
  }

  const topVoteCount = Math.max(...suspects.map((suspect) => suspect.voteCount));
  const topSuspects = suspects.filter((suspect) => suspect.voteCount === topVoteCount && topVoteCount > 0);
  const tied = topSuspects.length > 1;
  const topSuspect = tied ? null : topSuspects[0] ?? null;

  return {
    topSuspectParticipantId: topSuspect?.participantId ?? null,
    topSuspectName: topSuspect?.studentName ?? null,
    topSuspectIsImpostor: topSuspect ? topSuspect.isImpostor : null,
    voteCount: topVoteCount,
    totalVotes,
    tied,
    suspects,
  };
}

export default async function FindBedragerenLivePage({ params }: PageProps) {
  const { sessionId } = await params;
  const pagePath = `/dashboard/live/${sessionId}/find-bedrageren`;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(pagePath)}`);
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    throw new Error("Admin access missing");
  }

  const { data: liveSession, error: liveSessionError } = await adminSupabase
    .from("live_sessions")
    .select("id,run_id,teacher_id,pin,status,created_at")
    .eq("id", sessionId)
    .maybeSingle<LiveSessionRow>();

  if (liveSessionError) {
    throw new Error(liveSessionError.message);
  }

  if (!liveSession?.id || liveSession.teacher_id !== user.id || !liveSession.run_id) {
    notFound();
  }

  const { data: run, error: runError } = await adminSupabase
    .from("gps_runs")
    .select("id,user_id,title,subject,race_type")
    .eq("id", liveSession.run_id)
    .maybeSingle<RunRow>();

  if (runError) {
    throw new Error(runError.message);
  }

  if (!run || run.user_id !== user.id || normalizeRaceType(run.race_type) !== RACE_TYPES.FIND_BEDRAGEREN) {
    notFound();
  }

  const { data: findSession, error: findSessionError } = await adminSupabase
    .from("find_bedrageren_sessions")
    .select("live_session_id,gps_run_id,game_id,phase,secret_word_snapshot,impostor_count_snapshot,roles_assigned_at,created_at")
    .eq("live_session_id", liveSession.id)
    .maybeSingle<FindBedragerenSessionRow>();

  if (findSessionError) {
    throw new Error(findSessionError.message);
  }

  if (!findSession) {
    notFound();
  }

  const { data: playersData, error: playersError } = await adminSupabase
    .from("find_bedrageren_players")
    .select("participant_id,student_name,has_seen_role,created_at")
    .eq("live_session_id", liveSession.id)
    .order("created_at", { ascending: true });

  if (playersError) {
    throw new Error(playersError.message);
  }

  const players = (playersData ?? []) as FindBedragerenPlayerRow[];
  let result: FindBedragerenResult | null = null;

  if (findSession.phase === "results") {
    const { data: resultPlayersData, error: resultPlayersError } = await adminSupabase
      .from("find_bedrageren_players")
      .select("participant_id,student_name,player_role")
      .eq("live_session_id", liveSession.id)
      .order("created_at", { ascending: true });

    if (resultPlayersError) {
      throw new Error(resultPlayersError.message);
    }

    const { data: votesData, error: votesError } = await adminSupabase
      .from("find_bedrageren_votes")
      .select("suspect_participant_id")
      .eq("live_session_id", liveSession.id);

    if (votesError) {
      throw new Error(votesError.message);
    }

    result = buildResult(
      (resultPlayersData ?? []) as FindBedragerenResultPlayerRow[],
      (votesData ?? []) as FindBedragerenVoteResultRow[]
    );
  }

  const title = asDisplayText(run.title, "Find Bedrageren");
  const subject = asDisplayText(run.subject, "Generelt");
  const joinPin = asDisplayText(liveSession.pin, "Ingen kode");
  const phaseLabel = phaseLabels[findSession.phase] ?? "Lobby";
  const phaseDescription = phaseDescriptions[findSession.phase] ?? phaseDescriptions.lobby;
  const playerCount = players.length;
  const impostorCount = findSession.impostor_count_snapshot;
  const minimumPlayers = 3;
  const assignedPlayerCount = findSession.roles_assigned_at
    ? players.filter((player) => isPlayerAssigned(player.created_at, findSession.roles_assigned_at)).length
    : 0;
  const lateJoinCount = Math.max(playerCount - assignedPlayerCount, 0);
  const needsMorePlayers = playerCount < minimumPlayers;
  const hasTooManyImpostors = playerCount > 0 && impostorCount >= playerCount;
  const isReadyForRoles = !needsMorePlayers && !hasTooManyImpostors;
  const currentPhaseIndex = getPhaseIndex(findSession.phase);
  const missingPlayerCount = Math.max(minimumPlayers - playerCount, 0);
  const readinessLabel = needsMorePlayers
    ? "Mangler elever"
    : hasTooManyImpostors
      ? "Tjek antal bedragere"
      : findSession.roles_assigned_at && lateJoinCount > 0
        ? "Nye elever venter"
        : findSession.roles_assigned_at
          ? "Roller klar"
          : "Klar til rollefordeling";
  const readinessDescription = needsMorePlayers
    ? `Der mangler ${missingPlayerCount} elev${missingPlayerCount === 1 ? "" : "er"} for at kunne fordele roller.`
    : hasTooManyImpostors
      ? "Antallet af bedragere skal være lavere end antallet af elever."
      : findSession.roles_assigned_at && lateJoinCount > 0
        ? "Fordel roller igen, hvis de nye elever skal med i runden."
        : findSession.roles_assigned_at
          ? "Alle elever fra rollefordelingen har en rolle klar."
          : "Klassen er klar til at få fordelt roller.";

  return (
    <main className={`min-h-screen bg-[#f5f3ef] px-5 py-7 text-slate-950 sm:px-6 sm:py-8 ${poppins.className}`}>
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard/arkiv"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-400 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til arkiv
          </Link>

          <Link
            href={pagePath}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-violet-400 hover:text-slate-950"
          >
            <RefreshCw className="h-4 w-4" />
            Opdater
          </Link>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-slate-900 bg-slate-950 text-white shadow-xl">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
            <div>
              <div className="flex flex-wrap gap-2">
                {["Live spil", "Rollespil", "Klasseaktivitet"].map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-100"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <h1 className={`mt-6 text-4xl font-black leading-tight sm:text-5xl ${rubik.className}`}>
                Find Bedrageren
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-200 sm:text-lg">
                Styr lobby, roller og spillets faser fra lærerens skærm.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm font-bold text-slate-200">
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2">
                  Aktivitet: {title}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2">
                  Emne: {subject}
                </span>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-amber-300/40 bg-amber-300/10 p-6 text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100">
                Kode til eleverne
              </p>
              <p className="mt-4 font-mono text-6xl font-black tracking-[0.22em] text-white sm:text-7xl">
                {joinPin}
              </p>
              <p className="mx-auto mt-5 max-w-md text-base font-semibold leading-7 text-amber-50">
                Eleverne går til /find-bedrageren/join og indtaster koden.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Fase</p>
                <p className="mt-1 text-lg font-black text-slate-950">{phaseLabel}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{phaseDescription}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Elever</p>
                <p className="mt-1 text-lg font-black text-slate-950">{playerCount}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
              {needsMorePlayers ? "Der skal mindst være 3 elever." : "Der er nok elever til rollefordeling."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Roller fordelt
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {assignedPlayerCount}/{playerCount}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
              {findSession.roles_assigned_at
                ? `Senest fordelt ${formatDateTime(findSession.roles_assigned_at)}.`
                : "Roller er ikke fordelt endnu."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <UserSearch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Bedragere</p>
                <p className="mt-1 text-lg font-black text-slate-950">{impostorCount}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
              {hasTooManyImpostors
                ? "Der skal være færre bedragere end elever."
                : "Systemet vælger tilfældigt, når roller fordeles."}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-5 shadow-sm ${
              isReadyForRoles
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  isReadyForRoles ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                }`}
              >
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">Klar</p>
                <p className="mt-1 text-lg font-black text-slate-950">{readinessLabel}</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{readinessDescription}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                  Spillerliste
                </p>
                <h2 className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                  Elever i lobbyen
                </h2>
              </div>
              <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700">
                {playerCount} elev{playerCount === 1 ? "" : "er"}
              </span>
            </div>

            {players.length > 0 ? (
              <ul className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
                {players.map((player, index) => {
                  const hasAssignedRole = isPlayerAssigned(player.created_at, findSession.roles_assigned_at);
                  const statusLabel =
                    findSession.phase === "lobby"
                      ? "I lobby"
                      : hasAssignedRole
                        ? "Rolle klar"
                        : "Venter";
                  const detailText =
                    findSession.phase === "lobby"
                      ? "Venter på, at læreren fordeler roller."
                      : hasAssignedRole
                        ? player.has_seen_role
                          ? "Eleven har set sin rolle."
                          : "Eleven kan se sin rolle på egen skærm."
                        : "Joinet efter rollefordeling. Fordel roller igen, hvis eleven skal med.";

                  return (
                    <li
                      key={player.participant_id}
                      className="flex flex-col gap-3 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-slate-950">
                            {asDisplayText(player.student_name, `Spiller ${index + 1}`)}
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{detailText}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
                          {statusLabel}
                        </span>
                        {hasAssignedRole ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                            {player.has_seen_role ? "Set" : "Ikke set"}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="text-base font-black text-slate-950">Ingen elever er joinet endnu</p>
                <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-600">
                  Når eleverne indtaster koden, vises de her med navn og status.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <StartFindBedragerenGameButton
              sessionId={liveSession.id}
              phase={findSession.phase}
              playerCount={playerCount}
              impostorCount={impostorCount}
            />

            <StartFindBedragerenDiscussionButton
              sessionId={liveSession.id}
              phase={findSession.phase}
              rolesAssigned={Boolean(findSession.roles_assigned_at)}
            />

            {findSession.phase === "results" && result ? (
              <section className="overflow-hidden rounded-[1.5rem] border border-slate-900 bg-slate-950 text-white shadow-lg">
                <div className="border-b border-white/10 bg-white/5 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-100">
                        Resultat
                      </p>
                      <h2 className={`mt-2 text-3xl font-black leading-tight ${rubik.className}`}>
                        {result.totalVotes === 0
                          ? "Der er endnu ingen registrerede stemmer."
                          : result.tied
                            ? "Der er stemmelighed."
                            : `Flest stemmer gik til: ${result.topSuspectName ?? "Ukendt"}`}
                      </h2>
                      {!result.tied && result.totalVotes > 0 ? (
                        <p className="mt-3 text-base font-bold leading-7 text-slate-200">
                          {result.topSuspectIsImpostor
                            ? "Klassen fandt bedrageren."
                            : "Bedrageren slap igennem."}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {result.suspects.length > 0 ? (
                  <ul className="divide-y divide-white/10">
                    {result.suspects.map((suspect) => (
                      <li
                        key={suspect.participantId}
                        className="flex items-center justify-between gap-3 px-6 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{suspect.studentName}</p>
                          {suspect.isImpostor ? (
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                              Bedrager
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-white">
                          {suspect.voteCount} stemme{suspect.voteCount === 1 ? "" : "r"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-amber-300">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                    Hemmeligt ord
                  </p>
                  <p className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                    {findSession.secret_word_snapshot}
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                    Ordet vises kun her på lærerens beskyttede side og til civile elever, når de selv åbner
                    rollevisning.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                    Faseforløb
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Næste fase styres i senere versioner.
                  </p>
                </div>
              </div>

              <ol className="mt-5 space-y-3">
                {phaseOrder.map((phase, index) => {
                  const isCurrent = index === currentPhaseIndex;
                  const isPast = index < currentPhaseIndex;

                  return (
                    <li
                      key={phase}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                        isCurrent
                          ? "border-violet-200 bg-violet-50 text-violet-900"
                          : isPast
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black">
                        {index + 1}
                      </span>
                      <span className="text-sm font-black">{phaseLabels[phase]}</span>
                      {isCurrent ? (
                        <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-black">
                          Aktiv
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                    Rollevisning
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    Elever ser kun deres egen rolle. Bedragere får ikke vist det hemmelige ord.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
