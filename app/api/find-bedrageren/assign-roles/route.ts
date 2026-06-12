import { NextResponse } from "next/server";

import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type AssignRolesPayload = {
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
  impostor_count_snapshot: number;
};

type FindBedragerenPlayerRow = {
  participant_id: string;
  student_name: string | null;
};

type SupabaseErrorLike = {
  message?: unknown;
};

const MIN_PLAYERS_TO_START = 3;

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
    return new Error(message || "Find Bedrageren-roller kunne ikke fordeles.");
  }

  return new Error("Find Bedrageren-roller kunne ikke fordeles.");
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const swapIndex = Number(randomBuffer[0] ?? 0) % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export async function POST(request: Request) {
  const requestPath = new URL(request.url).pathname;
  let payload: AssignRolesPayload;

  try {
    payload = (await request.json()) as AssignRolesPayload;
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
      .select("live_session_id,gps_run_id,impostor_count_snapshot")
      .eq("live_session_id", liveSession.id)
      .eq("gps_run_id", run.id)
      .maybeSingle<FindBedragerenSessionRow>();

    if (findSessionError) {
      throw new Error(findSessionError.message);
    }

    if (!findSession) {
      return respond({ error: "Find Bedrageren-lobbyen blev ikke fundet." }, 404);
    }

    const { data: playersData, error: playersError } = await adminSupabase
      .from("find_bedrageren_players")
      .select("participant_id,student_name")
      .eq("live_session_id", liveSession.id)
      .order("created_at", { ascending: true });

    if (playersError) {
      throw new Error(playersError.message);
    }

    const players = (playersData ?? []) as FindBedragerenPlayerRow[];
    const playerCount = players.length;
    const impostorCount = findSession.impostor_count_snapshot;

    if (playerCount < MIN_PLAYERS_TO_START) {
      return respond({ error: "Der skal være mindst 3 spillere, før spillet kan starte." }, 409);
    }

    if (impostorCount >= playerCount) {
      return respond(
        { error: "Antallet af bedragere skal være lavere end antallet af spillere." },
        409
      );
    }

    if (impostorCount < 1) {
      return respond({ error: "Der skal være mindst 1 bedrager." }, 409);
    }

    const selectedImpostors = new Set(
      shuffle(players)
        .slice(0, impostorCount)
        .map((player) => player.participant_id)
    );
    const roleRows = players.map((player) => ({
      participant_id: player.participant_id,
      live_session_id: liveSession.id,
      student_name: asTrimmedString(player.student_name) || "Elev",
      player_role: selectedImpostors.has(player.participant_id) ? "impostor" : "civilian",
      has_seen_role: false,
      role_seen_at: null,
    }));

    const { error: roleUpdateError } = await adminSupabase
      .from("find_bedrageren_players")
      .upsert(roleRows, { onConflict: "participant_id" });

    if (roleUpdateError) {
      throw new Error(roleUpdateError.message);
    }

    const assignedAt = new Date().toISOString();
    const { error: phaseUpdateError } = await adminSupabase
      .from("find_bedrageren_sessions")
      .update({
        phase: "reveal",
        roles_assigned_at: assignedAt,
        started_at: assignedAt,
      })
      .eq("live_session_id", liveSession.id);

    if (phaseUpdateError) {
      throw new Error(phaseUpdateError.message);
    }

    return respond({
      phase: "reveal",
      playerCount,
      impostorCount,
    });
  } catch (error) {
    console.error("Find Bedrageren-rollefordeling fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/assign-roles",
      method: "POST",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return respond({ error: "Kunne ikke starte spillet lige nu." }, 500);
  }
}
