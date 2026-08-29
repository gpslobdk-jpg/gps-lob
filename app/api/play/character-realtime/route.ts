import { NextRequest, NextResponse } from "next/server";

import {
  fetchAuthoritativeProgressSnapshot,
  fetchRunForSession,
  getLocationDistanceMeters,
  getServerPositionValidationRadius,
  getServerRouteOrder,
  supportsServerStaggeredStart,
} from "@/app/api/play/_shared";
import {
  buildPilenRealtimeSessionConfig,
  PILEN_REALTIME_MAX_SDP_BYTES,
  resolveCharacterRealtimeServerGate,
  validateCharacterRealtimeAccess,
} from "@/lib/characterRealtime";
import {
  createCharacterRealtimeRateLimitFingerprint,
  createCharacterRealtimeStopToken,
  readRealtimeCallId,
} from "@/lib/characterRealtimeServer";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "nodejs";
export const maxDuration = 30;

type LiveSessionRow = {
  status?: string | null;
  gps_override?: boolean | null;
};

type ParticipantLocationRow = {
  lat?: number | string | null;
  lng?: number | string | null;
  accuracy?: number | string | null;
  last_updated?: string | null;
  finished_at?: string | null;
};

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parsePostIndex(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function jsonError(code: string, status: number, retryAfter?: number) {
  return NextResponse.json(
    { error: "Pilen kan ikke starte samtalen lige nu.", code },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const gate = resolveCharacterRealtimeServerGate(process.env);
  if (!gate.available) {
    return jsonError(gate.code, 503);
  }

  if (!request.headers.get("content-type")?.startsWith("application/sdp")) {
    return jsonError("INVALID_SDP", 415);
  }

  const claimedSessionId = request.headers.get("x-pilen-session-id")?.trim() ?? "";
  const postIndex = parsePostIndex(request.headers.get("x-pilen-post-index"));
  if (!claimedSessionId || postIndex === null) {
    return jsonError("INVALID_REQUEST", 400);
  }

  const sdp = await request.text();
  if (!sdp || Buffer.byteLength(sdp, "utf8") > PILEN_REALTIME_MAX_SDP_BYTES) {
    return jsonError("INVALID_SDP", 413);
  }

  const participantContext = await resolveParticipantRequestContext({
    claimedSessionId,
  });
  if (!participantContext.ok) {
    return jsonError("PARTICIPANT_UNAUTHORIZED", participantContext.status);
  }

  const {
    adminSupabase,
    authUserId,
    participantId,
    sessionId,
    startOffset,
  } = participantContext.data;

  try {
    const [{ data: sessionRow, error: sessionError }, run] = await Promise.all([
      adminSupabase
        .from("live_sessions")
        .select("status,gps_override")
        .eq("id", sessionId)
        .maybeSingle<LiveSessionRow>(),
      fetchRunForSession(sessionId),
    ]);

    if (sessionError || !sessionRow || !run || !Array.isArray(run.questions)) {
      return jsonError("RUN_UNAVAILABLE", 503);
    }

    const routeOrder = getServerRouteOrder(
      run.questions.length,
      startOffset,
      supportsServerStaggeredStart(
        run.raceType ?? run.race_type,
        run.sessionPostOrderMode,
        run.routeVersion,
      ),
    );
    const progress = await fetchAuthoritativeProgressSnapshot({
      sessionId,
      participantId,
      routeOrder,
      adminSupabase,
    });
    if (!progress) {
      return jsonError("PROGRESS_UNAVAILABLE", 503);
    }

    const rawPost = run.questions[postIndex];
    let location: ParticipantLocationRow | null = null;
    let distanceMeters: number | null = null;
    if (sessionRow.gps_override !== true) {
      const { data, error } = await adminSupabase
        .from("participants")
        .select("lat,lng,accuracy,last_updated,finished_at")
        .eq("id", participantId)
        .eq("session_id", sessionId)
        .maybeSingle<ParticipantLocationRow>();
      if (error) return jsonError("LOCATION_UNAVAILABLE", 503);
      location = data ?? null;

      const participantLat = toFiniteNumber(location?.lat);
      const participantLng = toFiniteNumber(location?.lng);
      const postRecord =
        rawPost && typeof rawPost === "object" && !Array.isArray(rawPost)
          ? (rawPost as Record<string, unknown>)
          : null;
      const postLat = toFiniteNumber(postRecord?.lat);
      const postLng = toFiniteNumber(postRecord?.lng);
      if (
        participantLat !== null &&
        participantLng !== null &&
        postLat !== null &&
        postLng !== null
      ) {
        distanceMeters = getLocationDistanceMeters(
          participantLat,
          participantLng,
          postLat,
          postLng,
        );
      }
    }

    const access = validateCharacterRealtimeAccess({
      sessionStatus: sessionRow.status,
      raceType: run.raceType ?? run.race_type,
      postIndex,
      routeOrder,
      expectedPostIndex: progress.expectedPostIndex,
      rawPost,
      gpsOverride: sessionRow.gps_override === true,
      location: location
        ? {
            lat: location.lat,
            lng: location.lng,
            accuracy: location.accuracy,
            lastUpdated: location.last_updated,
            finishedAt: location.finished_at,
          }
        : null,
      distanceMeters,
      allowedDistanceMeters: getServerPositionValidationRadius(run),
    });
    if (!access.ok) {
      return jsonError(access.code, access.status);
    }

    const rateLimitSecret = process.env.PILEN_REALTIME_RATE_LIMIT_SECRET!.trim();
    const requestFingerprint = createCharacterRealtimeRateLimitFingerprint({
      secret: rateLimitSecret,
      authUserId,
      participantId,
      sessionId,
    });
    const { data: startAllowed, error: rateLimitError } = await adminSupabase.rpc(
      "consume_character_realtime_start_limit",
      {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_post_index: postIndex,
        p_request_fingerprint: requestFingerprint,
      },
    );
    if (rateLimitError) {
      return jsonError("RATE_LIMIT_UNAVAILABLE", 503);
    }
    if (startAllowed !== true) {
      return jsonError("RATE_LIMITED", 429, 60);
    }

    const formData = new FormData();
    formData.set("sdp", sdp);
    formData.set(
      "session",
      JSON.stringify(buildPilenRealtimeSessionConfig(access.config)),
    );

    const upstreamResponse = await fetch(gate.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gate.apiKey}`,
      },
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstreamResponse.ok) {
      return jsonError("REALTIME_PROVIDER_UNAVAILABLE", 502);
    }

    const answerSdp = await upstreamResponse.text();
    const callId = readRealtimeCallId(upstreamResponse.headers.get("location"));
    const stopToken = callId
      ? createCharacterRealtimeStopToken({
          secret: rateLimitSecret,
          callId,
          participantId,
          sessionId,
          postIndex,
          expiresAtMs: Date.now() + (access.config.maxDurationSeconds + 45) * 1000,
        })
      : null;
    if (!answerSdp || !stopToken) {
      return jsonError("REALTIME_PROVIDER_UNAVAILABLE", 502);
    }

    return new NextResponse(answerSdp, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Pilen-Stop-Token": stopToken,
      },
    });
  } catch {
    return jsonError("REALTIME_UNAVAILABLE", 503);
  }
}
