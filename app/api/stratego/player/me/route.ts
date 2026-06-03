import { NextRequest, NextResponse } from "next/server";

import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import {
  logHandledServerError,
  logServerResponseError,
} from "@/utils/telemetry/serverLogs";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "edge";

const PLAYABLE_SESSION_STATUSES = new Set([
  "waiting",
  "running",
  "paused",
  "active",
  "scheduled",
]);

type RequestBody = {
  sessionId?: unknown;
  participantId?: unknown;
};

type ErrorBody = {
  error: string;
  reason?: string;
};

type LiveSessionRow = {
  id?: string | null;
  status?: string | null;
  run_id?: string | null;
};

type RunRow = {
  race_type?: unknown;
  raceType?: unknown;
};

type StrategoPlayerSnapshotRow = {
  participant_id?: string | null;
  session_id?: string | null;
  team_code?: string | null;
  rank_key?: string | null;
  last_duel_at?: string | null;
  state?: string | null;
  updated_at?: string | null;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNoStoreJson(body: ErrorBody | Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function toPlayerSnapshot(row: StrategoPlayerSnapshotRow | null | undefined) {
  if (!row) {
    return null;
  }

  return {
    participant_id: asTrimmedString(row.participant_id) || null,
    session_id: asTrimmedString(row.session_id) || null,
    team_code: asTrimmedString(row.team_code) || null,
    rank_key: asTrimmedString(row.rank_key) || null,
    last_duel_at: typeof row.last_duel_at === "string" ? row.last_duel_at : null,
    state: asTrimmedString(row.state) || null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function POST(request: NextRequest) {
  let payload: RequestBody;
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    payload = (await request.json()) as RequestBody;
  } catch {
    return toNoStoreJson({ error: "Ugyldig forespørgsel." }, 400);
  }

  const claimedSessionId = asTrimmedString(payload.sessionId);
  const claimedParticipantId = asTrimmedString(payload.participantId);

  if (!claimedSessionId || !claimedParticipantId) {
    return toNoStoreJson({ error: "Session-id eller deltager-id mangler." }, 400);
  }

  const participantContext = await resolveParticipantRequestContext({
    claimedParticipantId,
    claimedSessionId,
  });

  if (!participantContext.ok) {
    if (participantContext.status >= 401) {
      await logServerResponseError({
        route: "/api/stratego/player/me",
        method: "POST",
        status: participantContext.status,
        error: participantContext.error,
        requestPath,
        participantId: claimedParticipantId || null,
        sessionId: claimedSessionId || null,
      });
    }

    return toNoStoreJson({ error: participantContext.error }, participantContext.status);
  }

  const { adminSupabase, participantId, sessionId } = participantContext.data;

  try {
    const { data: sessionRow, error: sessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,status,run_id")
      .eq("id", sessionId)
      .maybeSingle<LiveSessionRow>();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!sessionRow?.id) {
      await logServerResponseError({
        route: "/api/stratego/player/me",
        method: "POST",
        status: 404,
        error: "Sessionen findes ikke længere.",
        requestPath,
        participantId,
        sessionId,
      });
      return toNoStoreJson({ error: "Sessionen findes ikke længere." }, 404);
    }

    const sessionStatus = asTrimmedString(sessionRow.status);
    if (!PLAYABLE_SESSION_STATUSES.has(sessionStatus)) {
      await logServerResponseError({
        route: "/api/stratego/player/me",
        method: "POST",
        status: 410,
        error: "Sessionen er afsluttet eller ikke aktiv.",
        requestPath,
        participantId,
        sessionId,
      });
      return toNoStoreJson({ error: "Sessionen er afsluttet eller ikke aktiv." }, 410);
    }

    const runId = asTrimmedString(sessionRow.run_id);
    if (!runId) {
      await logServerResponseError({
        route: "/api/stratego/player/me",
        method: "POST",
        status: 404,
        error: "Stratego-løbet findes ikke længere.",
        requestPath,
        participantId,
        sessionId,
      });
      return toNoStoreJson({ error: "Stratego-løbet findes ikke længere." }, 404);
    }

    const { data: runRow, error: runError } = await adminSupabase
      .from("gps_runs")
      .select("race_type,raceType:race_type")
      .eq("id", runId)
      .maybeSingle<RunRow>();

    if (runError) {
      throw new Error(runError.message);
    }

    if (normalizeRaceType(runRow?.race_type ?? runRow?.raceType) !== RACE_TYPES.STRATEGO) {
      await logServerResponseError({
        route: "/api/stratego/player/me",
        method: "POST",
        status: 400,
        error: "Sessionen er ikke et Stratego-løb.",
        requestPath,
        participantId,
        sessionId,
      });
      return toNoStoreJson({ error: "Sessionen er ikke et Stratego-løb." }, 400);
    }

    const { data: playerRow, error: playerError } = await adminSupabase
      .from("stratego_players")
      .select("participant_id,session_id,team_code,rank_key,last_duel_at,state,updated_at")
      .eq("participant_id", participantId)
      .eq("session_id", sessionId)
      .maybeSingle<StrategoPlayerSnapshotRow>();

    if (playerError) {
      throw new Error(playerError.message);
    }

    if (!playerRow) {
      if (sessionStatus === "waiting" || sessionStatus === "scheduled") {
        await logServerResponseError({
          route: "/api/stratego/player/me",
          method: "POST",
          status: 425,
          error: "Stratego-identiteten er ikke klar endnu.",
          requestPath,
          participantId,
          sessionId,
        });
        return toNoStoreJson(
          {
            error: "Stratego-identiteten er ikke klar endnu.",
            reason: "stratego_player_not_ready",
          },
          425
        );
      }

      await logServerResponseError({
        route: "/api/stratego/player/me",
        method: "POST",
        status: 404,
        error: "Din Stratego-spiller findes ikke endnu.",
        requestPath,
        participantId,
        sessionId,
      });
      return toNoStoreJson({ error: "Din Stratego-spiller findes ikke endnu." }, 404);
    }

    return NextResponse.json(
      {
        player: toPlayerSnapshot(playerRow),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Kunne ikke hente elevens Stratego-spiller:", error);
    await logHandledServerError({
      route: "/api/stratego/player/me",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      participantId,
      sessionId,
    });
    return toNoStoreJson({ error: "Kunne ikke hente din Stratego-identitet." }, 500);
  }
}