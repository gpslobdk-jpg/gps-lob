import { NextResponse } from "next/server";

import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type UpdatePhasePayload = {
  sessionId?: unknown;
  phase?: unknown;
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
  roles_assigned_at: string | null;
};

type SupabaseErrorLike = {
  message?: unknown;
};

const ALLOWED_NEXT_PHASES = new Set(["discussion", "voting", "results"]);

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
    return new Error(message || "Find Bedrageren-fasen kunne ikke skiftes.");
  }

  return new Error("Find Bedrageren-fasen kunne ikke skiftes.");
}

export async function POST(request: Request) {
  const requestPath = new URL(request.url).pathname;
  let payload: UpdatePhasePayload;

  try {
    payload = (await request.json()) as UpdatePhasePayload;
  } catch {
    return respond({ error: "Ugyldig forespørgsel." }, 400);
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const nextPhase = asTrimmedString(payload.phase);

  if (!sessionId) {
    return respond({ error: "Lobbyen mangler." }, 400);
  }

  if (!ALLOWED_NEXT_PHASES.has(nextPhase)) {
    return respond({ error: "Denne fase kan ikke startes endnu." }, 400);
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
      .select("live_session_id,gps_run_id,phase,roles_assigned_at")
      .eq("live_session_id", liveSession.id)
      .eq("gps_run_id", run.id)
      .maybeSingle<FindBedragerenSessionRow>();

    if (findSessionError) {
      throw new Error(findSessionError.message);
    }

    if (!findSession) {
      return respond({ error: "Find Bedrageren-lobbyen blev ikke fundet." }, 404);
    }

    if (nextPhase === "discussion" && !findSession.roles_assigned_at) {
      return respond({ error: "Roller skal fordeles, før diskussionen kan starte." }, 409);
    }

    if (findSession.phase === nextPhase) {
      return respond({ ok: true, phase: nextPhase });
    }

    if (nextPhase === "discussion" && findSession.phase !== "reveal") {
      return respond({ error: "Diskussionen kan først startes efter rollevisning." }, 409);
    }

    if (nextPhase === "voting" && findSession.phase !== "discussion") {
      return respond({ error: "Afstemningen kan først startes efter diskussionen." }, 409);
    }

    if (nextPhase === "results" && findSession.phase !== "voting") {
      return respond({ error: "Resultatet kan først vises efter afstemningen." }, 409);
    }

    const { error: phaseUpdateError } = await adminSupabase
      .from("find_bedrageren_sessions")
      .update({ phase: nextPhase })
      .eq("live_session_id", liveSession.id)
      .eq("gps_run_id", run.id);

    if (phaseUpdateError) {
      throw new Error(phaseUpdateError.message);
    }

    return respond({ ok: true, phase: nextPhase });
  } catch (error) {
    console.error("Find Bedrageren-faseskift fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/phase",
      method: "POST",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return respond({ error: "Kunne ikke skifte fase lige nu." }, 500);
  }
}
