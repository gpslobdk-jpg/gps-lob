import { NextResponse } from "next/server";

import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type ReplayPayload = {
  sessionId?: unknown;
};

type LiveSessionRow = {
  id: string;
  run_id: string | null;
  teacher_id: string | null;
};

type RunRow = {
  id: string;
  user_id: string | null;
  race_type?: unknown;
};

type FindBedragerenSessionRow = {
  live_session_id: string;
  gps_run_id: string;
  phase: string;
};

type SupabaseErrorLike = {
  message?: unknown;
};

const REPLAY_ALLOWED_PHASES = new Set(["results", "finished"]);

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function toSafeLogError(error: unknown) {
  if (error instanceof Error) {
    return new Error(error.message);
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = asTrimmedString((error as SupabaseErrorLike).message);
    return new Error(message || "Find Bedrageren-spillet kunne ikke gøres klar igen.");
  }

  return new Error("Find Bedrageren-spillet kunne ikke gøres klar igen.");
}

export async function POST(request: Request) {
  const requestPath = new URL(request.url).pathname;
  let payload: ReplayPayload;

  try {
    payload = (await request.json()) as ReplayPayload;
  } catch {
    return respond({ error: "Ugyldig forespørgsel." }, 400);
  }

  const sessionId = asTrimmedString(payload.sessionId);
  if (!sessionId) {
    return respond({ error: "Lobbyen mangler." }, 400);
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: ADMIN_ACCESS_MISSING_MESSAGE }, 503);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return respond({ error: "Du skal være logget ind." }, 401);
    }

    const { data: liveSession, error: liveSessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,run_id,teacher_id")
      .eq("id", sessionId)
      .maybeSingle<LiveSessionRow>();

    if (liveSessionError) {
      throw new Error(liveSessionError.message);
    }

    if (!liveSession?.id || liveSession.teacher_id !== user.id || !liveSession.run_id) {
      return respond({ error: "Lobbyen blev ikke fundet." }, 404);
    }

    const { data: run, error: runError } = await adminSupabase
      .from("gps_runs")
      .select("id,user_id,race_type")
      .eq("id", liveSession.run_id)
      .maybeSingle<RunRow>();

    if (runError) {
      throw new Error(runError.message);
    }

    if (!run || run.user_id !== user.id) {
      return respond({ error: "Aktiviteten blev ikke fundet." }, 404);
    }

    if (normalizeRaceType(run.race_type) !== RACE_TYPES.FIND_BEDRAGEREN) {
      return respond({ error: "Lobbyen er ikke et Find Bedrageren-spil." }, 400);
    }

    const { data: findSession, error: findSessionError } = await adminSupabase
      .from("find_bedrageren_sessions")
      .select("live_session_id,gps_run_id,phase")
      .eq("live_session_id", liveSession.id)
      .eq("gps_run_id", run.id)
      .maybeSingle<FindBedragerenSessionRow>();

    if (findSessionError) {
      throw new Error(findSessionError.message);
    }

    if (!findSession) {
      return respond({ error: "Find Bedrageren-lobbyen blev ikke fundet." }, 404);
    }

    if (!REPLAY_ALLOWED_PHASES.has(findSession.phase)) {
      return respond({ error: "Spillet kan først gøres klar igen, når resultatet er vist." }, 409);
    }

    const { error: votesDeleteError } = await adminSupabase
      .from("find_bedrageren_votes")
      .delete()
      .eq("live_session_id", liveSession.id);

    if (votesDeleteError) {
      throw new Error(votesDeleteError.message);
    }

    const { error: playersResetError } = await adminSupabase
      .from("find_bedrageren_players")
      .update({
        player_role: "civilian",
        has_seen_role: false,
        role_seen_at: null,
      })
      .eq("live_session_id", liveSession.id);

    if (playersResetError) {
      throw new Error(playersResetError.message);
    }

    const { error: sessionResetError } = await adminSupabase
      .from("find_bedrageren_sessions")
      .update({
        phase: "lobby",
        roles_assigned_at: null,
        started_at: null,
        finished_at: null,
      })
      .eq("live_session_id", liveSession.id)
      .eq("gps_run_id", run.id);

    if (sessionResetError) {
      throw new Error(sessionResetError.message);
    }

    return respond({
      ok: true,
      phase: "lobby",
    });
  } catch (error) {
    console.error("Find Bedrageren-spil igen fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/replay",
      method: "POST",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return respond({ error: "Kunne ikke gøre spillet klar igen lige nu." }, 500);
  }
}
