import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { ArrowLeft, RefreshCw, Shield, UserSearch, Users } from "lucide-react";

import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import StartFindBedragerenGameButton from "./StartFindBedragerenGameButton";

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

const phaseLabels: Record<string, string> = {
  lobby: "Lobby",
  reveal: "Rollevisning",
  discussion: "Samtale",
  voting: "Afstemning",
  results: "Resultater",
  finished: "Afsluttet",
};

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
  const title = asDisplayText(run.title, "Find Bedrageren");
  const subject = asDisplayText(run.subject, "Generelt");
  const joinPin = asDisplayText(liveSession.pin, "Ingen kode");
  const phaseLabel = phaseLabels[findSession.phase] ?? "Lobby";
  const playerCount = players.length;

  return (
    <main className={`min-h-screen bg-slate-100 px-6 py-8 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard/arkiv"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-amber-400 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til arkiv
          </Link>

          <Link
            href={pagePath}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
          >
            <RefreshCw className="h-4 w-4" />
            Opdater
          </Link>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-800">
                  <UserSearch className="h-4 w-4" />
                  Find Bedrageren
                </div>
                <h1 className={`mt-4 text-4xl font-black leading-tight text-slate-950 ${rubik.className}`}>
                  {title}
                </h1>
                <p className="mt-3 text-base font-semibold text-slate-600">{subject}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                Status: {phaseLabel}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-800">
                Kode til klassen
              </p>
              <p className="mt-4 font-mono text-6xl font-black tracking-[0.22em] text-slate-950 sm:text-7xl">
                {joinPin}
              </p>
              <p className="mx-auto mt-5 max-w-xl text-base font-semibold leading-7 text-slate-700">
                Eleverne går til /find-bedrageren/join og indtaster koden.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Fase</p>
                <p className="mt-2 text-lg font-black text-slate-950">{phaseLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Bedragere</p>
                <p className="mt-2 text-lg font-black text-slate-950">
                  {findSession.impostor_count_snapshot}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Oprettet</p>
                <p className="mt-2 text-lg font-black text-slate-950">
                  {formatDateTime(liveSession.created_at)}
                </p>
              </div>
            </div>

            <StartFindBedragerenGameButton
              sessionId={liveSession.id}
              phase={findSession.phase}
              playerCount={playerCount}
              impostorCount={findSession.impostor_count_snapshot}
            />
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-amber-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                    Hemmeligt ord
                  </p>
                  <p className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                    {findSession.secret_word_snapshot}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                    Spillere
                  </p>
                  <h2 className={`mt-2 text-2xl font-black text-slate-950 ${rubik.className}`}>
                    {playerCount}
                  </h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                  <Users className="h-5 w-5" />
                </div>
              </div>

              {players.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {players.map((player, index) => (
                    <li
                      key={player.participant_id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-black text-slate-950">
                          {asDisplayText(player.student_name, `Spiller ${index + 1}`)}
                        </p>
                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                          {findSession.phase === "lobby"
                            ? "Klar"
                            : isPlayerAssigned(player.created_at, findSession.roles_assigned_at)
                              ? "Rolle klar"
                              : "Venter"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {findSession.phase === "lobby"
                          ? "Venter på spilstart"
                          : isPlayerAssigned(player.created_at, findSession.roles_assigned_at)
                            ? player.has_seen_role
                              ? "Har set sin rolle"
                              : "Venter på rollevisning"
                            : "Joinet efter start. Fordel roller igen, hvis eleven skal med."}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold leading-6 text-slate-600">
                  Ingen elever er joinet endnu. Når elevdelen er klar, vises de her.
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
