import { NextRequest, NextResponse } from "next/server";

import {
  fetchParticipantStartState,
  fetchRunForSession,
  getAnsweredPostIndex,
  getFirstRoutePostIndexForParticipant,
  isZoneKrigRaceType,
} from "@/app/api/play/_shared";
import { getAwardedPoints } from "@/utils/questionPoints";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import type { ParticipantRequestContext } from "@/utils/supabase/participantServer";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "edge";
export const maxDuration = 60;

type SubmitAnswerPayload = {
  payloads?: unknown;
};

function isArrayOfRecords(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((v) => typeof v === "object" && v !== null && !Array.isArray(v));
}

function isCorrectAnswerPayload(payload: Record<string, unknown>) {
  return payload.is_correct === true;
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function collectDistinctPayloadStrings(
  payloads: Record<string, unknown>[],
  field: string
) {
  return [...new Set(payloads.map((payload) => asTrimmedString(payload[field])).filter(Boolean))];
}

function sanitizeAnswerPayload(
  payload: Record<string, unknown>,
  participantContext: ParticipantRequestContext
) {
  const sanitizedPayload: Record<string, unknown> = {
    ...payload,
    session_id: participantContext.sessionId,
    participant_id: participantContext.participantId,
    student_name: participantContext.studentName,
  };

  if (participantContext.teamId) {
    sanitizedPayload.zone_krig_team_id = participantContext.teamId;
  } else {
    delete sanitizedPayload.zone_krig_team_id;
  }

  return sanitizedPayload;
}

type ExistingAnswerRow = {
  id: string;
  awarded_points?: number | string | null;
  is_correct?: boolean | null;
};

async function findExistingAnswerRecord(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<ExistingAnswerRow | null> {
  const sessionId = asTrimmedString(payload.session_id);
  const studentName = asTrimmedString(payload.student_name);
  const participantId = asTrimmedString(payload.participant_id);
  const answeredPostIndex = getAnsweredPostIndex(payload);

  if (!sessionId || answeredPostIndex === null) {
    return null;
  }

  const lookupCandidates = [
    studentName ? { column: "student_name" as const, value: studentName } : null,
    !studentName && participantId ? { column: "participant_id" as const, value: participantId } : null,
  ].filter((candidate): candidate is { column: "student_name" | "participant_id"; value: string } =>
    candidate !== null
  );

  if (lookupCandidates.length === 0) {
    return null;
  }

  for (const lookup of lookupCandidates) {
    for (const column of ["question_index", "post_index"] as const) {
      const value = column === "question_index" ? answeredPostIndex : answeredPostIndex + 1;
      const { data, error } = await admin
        .from("answers")
        .select("id,is_correct,awarded_points")
        .eq("session_id", sessionId)
        .eq(lookup.column, lookup.value)
        .eq(column, value)
        .limit(1);

      if (error) {
        if (isMissingColumnError(error)) {
          continue;
        }

        throw new Error(error.message ?? "Kunne ikke tjekke eksisterende svar.");
      }

      const existingRow = Array.isArray(data) ? (data as ExistingAnswerRow[])[0] ?? null : null;
      if (existingRow) {
        return existingRow;
      }
    }
  }

  return null;
}

async function maybeStampRunStartedAt(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  // Stamp run_started_at on ANY answer to the first route post (correct or not),
  // so the race clock reflects when the team first interacted with post 1.
  const sessionId = asTrimmedString(payload.session_id);
  const participantId = asTrimmedString(payload.participant_id);
  const answeredPostIndex = getAnsweredPostIndex(payload);

  if (!sessionId || !participantId || answeredPostIndex === null) {
    return;
  }

  const run = await fetchRunForSession(sessionId);
  const questionCount = Array.isArray(run?.questions) ? run.questions.length : 0;
  if (questionCount <= 0) return;

  const participantState = await fetchParticipantStartState(sessionId, participantId, admin);
  if (!participantState || participantState.run_started_at) {
    return;
  }

  const firstRoutePostIndex = getFirstRoutePostIndexForParticipant(
    questionCount,
    participantState.start_offset ?? 0,
    run?.raceType ?? run?.race_type
  );

  if (firstRoutePostIndex === null || answeredPostIndex !== firstRoutePostIndex) {
    return;
  }

  const { error } = await admin
    .from("participants")
    .update({ run_started_at: new Date().toISOString() })
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .is("run_started_at", null);

  if (error && !isMissingColumnError(error)) {
    throw new Error(error.message ?? "Kunne ikke gemme run_started_at.");
  }
}

function isMissingColumnError(
  error:
    | {
        code?: unknown;
        message?: unknown;
        details?: unknown;
      }
    | null
    | undefined
) {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") return true;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("column");
}

type CaptureZoneRpcRow = {
  zone_id?: string | null;
  owner_team_id?: string | null;
  previous_owner_team_id?: string | null;
  captured?: boolean | null;
  owner_changed?: boolean | null;
  blocked_by_shield?: boolean | null;
  zone_missing?: boolean | null;
};

type ZoneKrigCaptureStatus =
  | "captured"
  | "blocked_by_shield"
  | "already_owned"
  | "zone_missing"
  | "game_over"
  | "capture_failed";

type ZoneKrigCaptureResponse = {
  status: ZoneKrigCaptureStatus;
  shieldRemainingSeconds?: number;
};

type ZoneKrigParticipantTeamRow = {
  zone_krig_team_id?: string | null;
};

type ZoneKrigSessionStateRow = {
  status?: string | null;
  ends_at?: string | null;
};

type RunCache = Map<string, Awaited<ReturnType<typeof fetchRunForSession>> | null>;

async function getRunForSessionCached(sessionId: string, runCache: RunCache) {
  if (!runCache.has(sessionId)) {
    const run = await fetchRunForSession(sessionId).catch(() => null);
    runCache.set(sessionId, run);
  }

  return runCache.get(sessionId) ?? null;
}

async function resolveAwardedPoints(payload: Record<string, unknown>, runCache: RunCache) {
  if (!isCorrectAnswerPayload(payload)) {
    return 0;
  }

  const sessionId = asTrimmedString(payload.session_id);
  if (!sessionId) {
    return getAwardedPoints(null, true);
  }

  const run = await getRunForSessionCached(sessionId, runCache);
  const questionIndex = getAnsweredPostIndex(payload);
  const rawQuestion =
    Array.isArray(run?.questions) && questionIndex !== null && questionIndex >= 0
      ? run.questions[questionIndex]
      : null;

  return getAwardedPoints(rawQuestion, true);
}

async function withAwardedPoints(payload: Record<string, unknown>, runCache: RunCache) {
  return {
    ...payload,
    awarded_points: await resolveAwardedPoints(payload, runCache),
  };
}

async function resolveZoneKrigTeamId(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const sessionId = asTrimmedString(payload.session_id);
  const participantId = asTrimmedString(payload.participant_id);

  if (!sessionId || !participantId) {
    return asTrimmedString(payload.zone_krig_team_id) || null;
  }

  const { data, error } = await admin
    .from("participants")
    .select("zone_krig_team_id")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .maybeSingle<ZoneKrigParticipantTeamRow>();

  if (error) {
    if (isMissingColumnError(error)) {
      return asTrimmedString(payload.zone_krig_team_id) || null;
    }

    throw new Error(error.message ?? "Kunne ikke hente spillerens hold.");
  }

  return asTrimmedString(data?.zone_krig_team_id) || null;
}

async function fetchZoneKrigSessionState(
  sessionId: string,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const { data, error } = await admin
    .from("live_sessions")
    .select("status,ends_at")
    .eq("id", sessionId)
    .maybeSingle<ZoneKrigSessionStateRow>();

  if (error) {
    if (isMissingColumnError(error)) {
      return {
        status: null,
        endsAt: null,
      };
    }

    throw new Error(error.message ?? "Kunne ikke hente kampens tidsstyring.");
  }

  return {
    status: asTrimmedString(data?.status) || null,
    endsAt: asTrimmedString(data?.ends_at) || null,
  };
}

async function maybeCaptureZone(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  awardedPoints: number,
  runCache: RunCache
): Promise<ZoneKrigCaptureResponse | null> {
  try {
    if (!isCorrectAnswerPayload(payload)) return null;

    const sessionId = asTrimmedString(payload.session_id);
    const run = sessionId ? await getRunForSessionCached(sessionId, runCache) : null;
    if (!isZoneKrigRaceType(run?.race_type ?? run?.raceType)) return null;
    if (!sessionId) return null;

    const zoneKrigSession = await fetchZoneKrigSessionState(sessionId, admin);
    const endsAtMs = zoneKrigSession.endsAt ? new Date(zoneKrigSession.endsAt).getTime() : Number.NaN;

    if (
      zoneKrigSession.status === "finished" ||
      (Number.isFinite(endsAtMs) && Date.now() > endsAtMs)
    ) {
      return { status: "game_over" };
    }

    const teamId = await resolveZoneKrigTeamId(payload, admin);
    if (!teamId) return null;

    const zoneIndex = getAnsweredPostIndex(payload);
    if (zoneIndex === null) return null;

    const shieldUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    const { data, error } = await admin.rpc("capture_zone_krig", {
      p_session_id: sessionId,
      p_zone_index: zoneIndex,
      p_team_id: teamId,
      p_shield_until: shieldUntil,
      p_points: awardedPoints,
    });

    if (error) {
      throw new Error(error.message ?? "Kunne ikke erobre zonen.");
    }

    const captureResult = (Array.isArray(data) ? data[0] : null) as CaptureZoneRpcRow | null;
    if (!captureResult) {
      return null;
    }

    if (captureResult.zone_missing) {
      console.warn(`[zone-krig] Zone ${zoneIndex} mangler for session ${sessionId}. Capture blev sprunget over.`);
      return { status: "zone_missing" };
    }

    if (captureResult.blocked_by_shield) {
      const { data: zoneRow } = await admin
        .from("game_zones")
        .select("shield_until")
        .eq("session_id", sessionId)
        .eq("zone_index", zoneIndex)
        .maybeSingle<{ shield_until?: string | null }>();

      const shieldUntilMs = zoneRow?.shield_until ? new Date(zoneRow.shield_until).getTime() : Number.NaN;
      const shieldRemainingSeconds = Number.isFinite(shieldUntilMs)
        ? Math.max(0, Math.ceil((shieldUntilMs - Date.now()) / 1000))
        : 0;

      return {
        status: "blocked_by_shield",
        shieldRemainingSeconds,
      };
    }

    if (captureResult.owner_changed) {
      return { status: "captured" };
    }

    if (captureResult.owner_team_id === teamId) {
      return { status: "already_owned" };
    }

    return { status: "captured" };
  } catch (err) {
    console.error("[zone-krig] maybeCaptureZone failed silently:", err);
    return { status: "capture_failed" };
  }
}

export async function POST(request: NextRequest) {
  let body: SubmitAnswerPayload;
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  try {
    body = (await request.json()) as SubmitAnswerPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const rawPayloads = body.payloads ?? null;
  if (!isArrayOfRecords(rawPayloads)) {
    return NextResponse.json({ error: "Manglende eller ugyldigt payload." }, { status: 400 });
  }

  const claimedSessionIds = collectDistinctPayloadStrings(rawPayloads, "session_id");
  if (claimedSessionIds.length > 1) {
    return NextResponse.json(
      { error: "Payloads matcher ikke den aktive deltager-session." },
      { status: 403 }
    );
  }

  const claimedParticipantIds = collectDistinctPayloadStrings(rawPayloads, "participant_id");
  if (claimedParticipantIds.length > 1) {
    return NextResponse.json(
      { error: "Payloads matcher ikke den aktive deltager." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  const runCache: RunCache = new Map();

  try {
    const participantContext = await resolveParticipantRequestContext({
      adminSupabase: admin,
      claimedParticipantId: claimedParticipantIds[0] ?? null,
      claimedSessionId: claimedSessionIds[0] ?? null,
    });
    if (!participantContext.ok) {
      return NextResponse.json({ error: participantContext.error }, { status: participantContext.status });
    }

    const sanitizedPayloads = rawPayloads.map((payload) =>
      sanitizeAnswerPayload(payload, participantContext.data)
    );

    for (const payload of sanitizedPayloads) {
      try {
        const enrichedPayload = await withAwardedPoints(payload, runCache);
        const awardedPoints = Number(enrichedPayload.awarded_points) || 0;
        const incomingIsCorrect = isCorrectAnswerPayload(enrichedPayload);
        const existingAnswer = await findExistingAnswerRecord(enrichedPayload, admin);
        if (existingAnswer) {
          await maybeStampRunStartedAt(enrichedPayload, admin);
          const existingAwardedPoints = Number(existingAnswer.awarded_points);
          const responseAwardedPoints =
            existingAnswer.is_correct === true && incomingIsCorrect && Number.isFinite(existingAwardedPoints)
              ? Math.max(0, Math.round(existingAwardedPoints))
              : existingAnswer.is_correct === true && incomingIsCorrect
                ? awardedPoints
                : 0;
          const zoneKrigCapture =
            existingAnswer.is_correct === true && incomingIsCorrect
              ? await maybeCaptureZone(enrichedPayload, admin, responseAwardedPoints, runCache)
              : null;
          return NextResponse.json({
            inserted: true,
            awardedPoints: responseAwardedPoints,
            zoneKrigCapture,
            isLocked: true,
          });
        }

        const { error } = await admin.from("answers").insert(enrichedPayload);
        if (!error) {
          await maybeStampRunStartedAt(enrichedPayload, admin);
          const zoneKrigCapture = await maybeCaptureZone(enrichedPayload, admin, awardedPoints, runCache);
          return NextResponse.json({ inserted: true, awardedPoints, zoneKrigCapture, isLocked: true });
        }

        if (isMissingColumnError(error)) {
          // Skip payloads that rely on missing columns and try next
          continue;
        }

        // If we hit a non-recoverable error, return it so the client can log it
        await logHandledServerError({
          route: "/api/play/submit-answer",
          method: "POST",
          status: 500,
          error,
          requestPath,
          routeType: "route",
          participantId: participantContext.data.participantId,
          sessionId: participantContext.data.sessionId,
        });
        return NextResponse.json({ error: error.message ?? "Kunne ikke gemme svar." }, { status: 500 });
      } catch (inner) {
        // Unexpected insert error for this payload, try next or return
        console.error("Fejl ved indsættelse af svar-payload:", inner);
        continue;
      }
    }

    return NextResponse.json({ error: "Kunne ikke gemme nogen af svarene." }, { status: 500 });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }
    console.error("Kunne ikke gemme svar via admin-klient:", error);
    await logHandledServerError({
      route: "/api/play/submit-answer",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      participantId: claimedParticipantIds[0] ?? null,
      sessionId: claimedSessionIds[0] ?? null,
    });
    return NextResponse.json({ error: "Kunne ikke gemme svar." }, { status: 500 });
  }
}
