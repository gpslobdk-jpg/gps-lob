import { NextRequest, NextResponse } from "next/server";

import type { ParticipantRequestContext } from "@/utils/supabase/participantServer";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "edge";

type LocationPayload = {
  sessionId?: unknown;
  participantId?: unknown;
  lat?: unknown;
  lng?: unknown;
  accuracy?: unknown;
};

type ActiveSessionRow = {
  id?: string | null;
};

type ParticipantIdRow = {
  id?: string | null;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

type ParticipantUpdateResult = {
  data: ParticipantIdRow[] | null;
  error: SupabaseLikeError | null;
};

const ACTIVE_PLAY_SESSION_STATUSES = ["waiting", "running", "active", "paused"] as const;

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isMissingColumnError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column/i.test(error.message ?? "");
}

async function updateParticipantById(
  sessionId: string,
  participantId: string,
  lat: number,
  lng: number,
  accuracy: number | null,
  timestamp: string,
  adminSupabase: ParticipantRequestContext["adminSupabase"]
): Promise<ParticipantUpdateResult> {
  const updateCandidates: Array<Record<string, number | string | null>> = [
    {
      lat,
      lng,
      accuracy,
      last_updated: timestamp,
    },
    {
      lat,
      lng,
      last_updated: timestamp,
    },
    {
      lat,
      lng,
      accuracy,
    },
    {
      lat,
      lng,
    },
  ];

  let lastResult: ParticipantUpdateResult | null = null;

  for (const candidate of updateCandidates) {
    const result = await adminSupabase
      .from("participants")
      .update(candidate)
      .eq("id", participantId)
      .eq("session_id", sessionId)
      .select("id");

    if (!result.error || !isMissingColumnError(result.error)) {
      return result;
    }

    lastResult = result;
  }

  return (
    lastResult ?? {
      data: null,
      error: {
        message: "Ingen gyldige opdateringskandidater til participant-position.",
      },
    }
  );
}

async function fetchActiveParticipant(
  sessionId: string,
  participantId: string,
  adminSupabase: ParticipantRequestContext["adminSupabase"]
) {
  const { data: sessionData, error: sessionError } = await adminSupabase
    .from("live_sessions")
    .select("id")
    .eq("id", sessionId)
    .in("status", [...ACTIVE_PLAY_SESSION_STATUSES])
    .maybeSingle<ActiveSessionRow>();

  if (sessionError) {
    return {
      ok: false as const,
      error: sessionError,
    };
  }

  const { data: participantData, error: participantError } = await adminSupabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .maybeSingle<ParticipantIdRow>();

  if (participantError) {
    return {
      ok: false as const,
      error: participantError,
    };
  }

  return {
    ok: true as const,
    data: {
      sessionId: sessionData?.id ?? null,
      participantId: participantData?.id ?? null,
    },
  };
}

export async function POST(request: NextRequest) {
  let payload: LocationPayload;
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    payload = (await request.json()) as LocationPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig foresporgsel." }, { status: 400 });
  }

  const lat = asFiniteNumber(payload.lat);
  const lng = asFiniteNumber(payload.lng);
  const accuracy = asFiniteNumber(payload.accuracy);

  if (lat === null || lng === null) {
    return NextResponse.json({ error: "Manglende positionsdata." }, { status: 400 });
  }

  const participantContext = await resolveParticipantRequestContext({
    claimedParticipantId: asTrimmedString(payload.participantId) || null,
    claimedSessionId: asTrimmedString(payload.sessionId) || null,
  });

  if (!participantContext.ok) {
    return NextResponse.json({ error: participantContext.error }, { status: participantContext.status });
  }

  const { adminSupabase, participantId, sessionId } = participantContext.data;
  const timestamp = new Date().toISOString();

  try {
    const validationResult = await fetchActiveParticipant(sessionId, participantId, adminSupabase);
    if (!validationResult.ok) {
      console.error(
        "Kunne ikke validere deltageren for positionsopdatering:",
        validationResult.error
      );
      await logHandledServerError({
        route: "/api/play/location",
        method: "POST",
        status: 500,
        error: validationResult.error,
        requestPath,
        routeType: "route",
        participantId,
        sessionId,
      });
      return NextResponse.json(
        { error: "Kunne ikke validere deltageren." },
        { status: 500 }
      );
    }

    if (!validationResult.data.sessionId || !validationResult.data.participantId) {
      return NextResponse.json(
        { error: "Deltageren findes ikke i den aktive session." },
        { status: 404 }
      );
    }

    const updateResult = await updateParticipantById(
      sessionId,
      participantId,
      lat,
      lng,
      accuracy,
      timestamp,
      adminSupabase
    );

    if (updateResult.error) {
      console.error("Kunne ikke opdatere participant via id:", updateResult.error);
      await logHandledServerError({
        route: "/api/play/location",
        method: "POST",
        status: 500,
        error: updateResult.error,
        requestPath,
        routeType: "route",
        participantId,
        sessionId,
      });
      return NextResponse.json({ error: "Kunne ikke gemme positionen." }, { status: 500 });
    }

    const updatedRows = Array.isArray(updateResult.data) ? updateResult.data : [];
    if (updatedRows.length === 0) {
      return NextResponse.json(
        { error: "Deltageren findes ikke laengere." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, participantId });
  } catch (error) {
    console.error("Kunne ikke synkronisere elevposition:", error);
    await logHandledServerError({
      route: "/api/play/location",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      participantId,
      sessionId,
    });
    return NextResponse.json({ error: "Kunne ikke gemme positionen." }, { status: 500 });
  }
}
