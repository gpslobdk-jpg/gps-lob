import { NextRequest, NextResponse } from "next/server";

import {
  fetchAuthoritativeProgressSnapshot,
  fetchParticipantStartState,
  fetchRunForSession,
  getAnsweredPostIndex,
  getCorrectIndex,
  getFirstRoutePostIndexForParticipant,
  getServerRouteOrder,
  isZoneKrigRaceType,
  resolveQuestionVariant,
  supportsServerStaggeredStart,
} from "@/app/api/play/_shared";
import { usesStandardStudentLocationExperience } from "@/lib/location/studentLocationState";
import { buildCharacterCompletionMetadataPayload } from "@/lib/characterCompletion";
import { getAwardedPoints } from "@/utils/questionPoints";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import type { ParticipantRequestContext } from "@/utils/supabase/participantServer";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "edge";
export const maxDuration = 60;

type SubmitAnswerPayload = {
  payloads?: unknown;
  operationId?: unknown;
};

const STANDARD_SUBMISSION_SESSION_STATUSES = new Set(["running", "active", "paused"]);
const CLIENT_OPERATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseClientOperationId(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return {
      provided: false,
      valid: true,
      value: null as string | null,
    };
  }

  if (typeof value !== "string") {
    return {
      provided: true,
      valid: false,
      value: null as string | null,
    };
  }

  const normalized = value.trim().toLowerCase();
  return {
    provided: true,
    valid: CLIENT_OPERATION_ID_PATTERN.test(normalized),
    value: CLIENT_OPERATION_ID_PATTERN.test(normalized) ? normalized : null,
  };
}

type StandardPayloadPostIndex =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; postIndex: number };

function hasPayloadIndexValue(value: unknown) {
  return !(
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function parsePayloadIndexValue(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function getStrictStandardPayloadPostIndex(
  payload: Record<string, unknown>
): StandardPayloadPostIndex {
  const hasQuestionIndex = hasPayloadIndexValue(payload.question_index);
  const hasPostIndex = hasPayloadIndexValue(payload.post_index);

  if (!hasQuestionIndex && !hasPostIndex) {
    return { kind: "missing" };
  }

  const questionIndex = hasQuestionIndex
    ? parsePayloadIndexValue(payload.question_index)
    : null;
  const rawPostIndex = hasPostIndex
    ? parsePayloadIndexValue(payload.post_index)
    : null;

  if (
    (hasQuestionIndex && questionIndex === null) ||
    (hasPostIndex && rawPostIndex === null)
  ) {
    return { kind: "invalid" };
  }

  const normalizedPostIndex =
    rawPostIndex === null
      ? null
      : rawPostIndex >= 1
        ? rawPostIndex - 1
        : rawPostIndex;

  if (
    questionIndex !== null &&
    normalizedPostIndex !== null &&
    questionIndex !== normalizedPostIndex
  ) {
    return { kind: "invalid" };
  }

  return {
    kind: "valid",
    postIndex: questionIndex ?? normalizedPostIndex ?? 0,
  };
}

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

  delete sanitizedPayload.zone_krig_team_id;
  delete sanitizedPayload.lat;
  delete sanitizedPayload.lng;
  delete sanitizedPayload.latitude;
  delete sanitizedPayload.longitude;
  delete sanitizedPayload.accuracy;

  return sanitizedPayload;
}

type ExistingAnswerRow = {
  id: string;
  awarded_points?: number | string | null;
  is_correct?: boolean | null;
  post_index?: number | string | null;
  question_index?: number | string | null;
  client_operation_id?: string | null;
};

type InsertedAnswerRow = {
  id: string;
  awarded_points?: number | string | null;
  is_correct?: boolean | null;
};

type ServerCorrectnessResult =
  | {
      checked: true;
      isCorrect: boolean;
    }
  | undefined;

async function findExistingAnswerRecord(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  lookupPolicy: "legacy" | "standard" = "legacy"
): Promise<ExistingAnswerRow | null> {
  const sessionId = asTrimmedString(payload.session_id);
  const studentName = asTrimmedString(payload.student_name);
  const participantId = asTrimmedString(payload.participant_id);
  const answeredPostIndex = getAnsweredPostIndex(payload);

  if (!sessionId || answeredPostIndex === null) {
    return null;
  }

  const lookupCandidates = (
    lookupPolicy === "standard"
      ? [
          participantId
            ? {
                column: "participant_id" as const,
                value: participantId,
                legacyOnly: false,
              }
            : null,
          studentName
            ? {
                column: "student_name" as const,
                value: studentName,
                legacyOnly: Boolean(participantId),
              }
            : null,
        ]
      : [
          studentName
            ? {
                column: "student_name" as const,
                value: studentName,
                legacyOnly: false,
              }
            : null,
          !studentName && participantId
            ? {
                column: "participant_id" as const,
                value: participantId,
                legacyOnly: false,
              }
            : null,
        ]
  ).filter(
    (
      candidate
    ): candidate is {
      column: "student_name" | "participant_id";
      value: string;
      legacyOnly: boolean;
    } => candidate !== null
  );

  if (lookupCandidates.length === 0) {
    return null;
  }

  for (const lookup of lookupCandidates) {
    for (const column of ["question_index", "post_index"] as const) {
      const value = column === "question_index" ? answeredPostIndex : answeredPostIndex + 1;
      let query = admin
        .from("answers")
        .select("id,is_correct,awarded_points")
        .eq("session_id", sessionId)
        .eq(lookup.column, lookup.value)
        .eq(column, value);

      if (lookup.legacyOnly) {
        query = query.is("participant_id", null);
      }

      const { data, error } = await query.limit(1);

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

async function findExistingAnswerByOperationId(
  sessionId: string,
  participantId: string,
  operationId: string,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<ExistingAnswerRow | null> {
  const { data, error } = await admin
    .from("answers")
    .select(
      "id,is_correct,awarded_points,post_index,question_index,client_operation_id"
    )
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .eq("client_operation_id", operationId)
    .limit(1);

  if (error) {
    if (isMissingColumnError(error)) {
      return null;
    }

    throw new Error(error.message ?? "Kunne ikke tjekke eksisterende operation.");
  }

  return Array.isArray(data) ? (data as ExistingAnswerRow[])[0] ?? null : null;
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
    run?.raceType ?? run?.race_type,
    run?.sessionPostOrderMode,
    run?.routeVersion
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

function isUniqueViolationError(
  error:
    | {
        code?: unknown;
      }
    | null
    | undefined
) {
  return error?.code === "23505";
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

type StandardSubmissionSafetyResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: number;
      code:
        | "SESSION_CLOSED"
        | "POST_NOT_FOUND"
        | "PROGRESS_MISMATCH"
        | "ANSWERS_SCHEMA_INCOMPATIBLE";
      error: string;
      expectedPostIndex?: number | null;
      answeredPostIndexes?: number[];
      isFinished?: boolean;
    };

async function validateStandardSubmissionSafety({
  sessionId,
  participantId,
  postIndex,
  routeOrder,
  admin,
}: {
  sessionId: string;
  participantId: string;
  postIndex: number;
  routeOrder: readonly number[];
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
}): Promise<StandardSubmissionSafetyResult> {
  const { data: sessionRow, error: sessionError } = await admin
    .from("live_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle<{ status?: string | null }>();

  if (sessionError) {
    throw new Error(sessionError.message ?? "Kunne ikke hente sessionstatus.");
  }

  const sessionStatus = asTrimmedString(sessionRow?.status).toLocaleLowerCase("da-DK");
  if (!STANDARD_SUBMISSION_SESSION_STATUSES.has(sessionStatus)) {
    return {
      ok: false,
      status: 410,
      code: "SESSION_CLOSED",
      error: "Løbet er afsluttet. Svaret kan ikke længere afleveres.",
    };
  }

  if (!routeOrder.includes(postIndex)) {
    return {
      ok: false,
      status: 404,
      code: "POST_NOT_FOUND",
      error: "Posten kunne ikke findes.",
    };
  }

  const progressSnapshot = await fetchAuthoritativeProgressSnapshot({
    sessionId,
    participantId,
    routeOrder,
    adminSupabase: admin,
  });
  if (progressSnapshot === null) {
    return {
      ok: false,
      status: 503,
      code: "ANSWERS_SCHEMA_INCOMPATIBLE",
      error: "Svaraflevering understøttes ikke med den nuværende answers-struktur.",
    };
  }

  const { answeredPostIndexes, expectedPostIndex } = progressSnapshot;

  if (expectedPostIndex === null) {
    return {
      ok: false,
      status: 409,
      code: "PROGRESS_MISMATCH",
      error: "Alle poster er allerede besvaret.",
      expectedPostIndex: null,
      answeredPostIndexes,
      isFinished: true,
    };
  }

  if (postIndex !== expectedPostIndex) {
    return {
      ok: false,
      status: 409,
      code: "PROGRESS_MISMATCH",
      error: "Posten matcher ikke den aktuelle serverprogression.",
      expectedPostIndex,
      answeredPostIndexes,
      isFinished: false,
    };
  }

  return { ok: true };
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

  if (
    resolveQuestionVariant(run?.raceType ?? run?.race_type, rawQuestion) ===
    "character"
  ) {
    return 0;
  }

  return getAwardedPoints(rawQuestion, true);
}

async function withAwardedPoints(payload: Record<string, unknown>, runCache: RunCache) {
  return {
    ...payload,
    awarded_points: await resolveAwardedPoints(payload, runCache),
  };
}

function getSelectedIndex(payload: Record<string, unknown>) {
  const rawValue = payload.selected_index ?? payload.answer_index;
  const selectedIndex =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string"
        ? rawValue.trim()
          ? Number(rawValue.trim())
          : null
        : null;

  if (selectedIndex === null || !Number.isInteger(selectedIndex)) return null;
  if (selectedIndex < 0 || selectedIndex > 3) return null;
  return selectedIndex;
}

async function resolveServerCorrectness(
  payload: Record<string, unknown>,
  runCache: RunCache
): Promise<ServerCorrectnessResult> {
  const selectedIndex = getSelectedIndex(payload);
  if (selectedIndex === null) return undefined;

  const sessionId = asTrimmedString(payload.session_id);
  if (!sessionId) return undefined;

  const postIndex = getAnsweredPostIndex(payload);
  if (postIndex === null) return undefined;

  const run = await getRunForSessionCached(sessionId, runCache);
  const rawQuestion =
    Array.isArray(run?.questions) && postIndex >= 0 && postIndex < run.questions.length
      ? run.questions[postIndex]
      : null;
  if (!rawQuestion) return undefined;

  const variant = resolveQuestionVariant(run?.raceType ?? run?.race_type, rawQuestion);
  if (variant !== "quiz") return undefined;

  const correctIndex = getCorrectIndex(rawQuestion);
  if (correctIndex === null) return undefined;

  return {
    checked: true,
    isCorrect: selectedIndex === correctIndex,
  };
}

async function canonicalizeStandardAnswerPayload(
  payload: Record<string, unknown>,
  runCache: RunCache
) {
  const sessionId = asTrimmedString(payload.session_id);
  const postIndex = getAnsweredPostIndex(payload);
  if (!sessionId || postIndex === null) {
    return withAwardedPoints(payload, runCache);
  }

  const run = await getRunForSessionCached(sessionId, runCache);
  const rawQuestion =
    Array.isArray(run?.questions) && postIndex >= 0 && postIndex < run.questions.length
      ? run.questions[postIndex]
      : null;
  if (
    resolveQuestionVariant(run?.raceType ?? run?.race_type, rawQuestion) !==
    "quiz"
  ) {
    return withAwardedPoints(payload, runCache);
  }

  const serverCorrectness = await resolveServerCorrectness(payload, runCache);
  return withAwardedPoints(
    {
      ...payload,
      is_correct:
        serverCorrectness?.checked === true && serverCorrectness.isCorrect === true,
    },
    runCache
  );
}

async function createStandardDuplicateResponse(
  payload: Record<string, unknown>,
  existingAnswer: ExistingAnswerRow,
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  routeOrder: readonly number[]
) {
  await maybeStampRunStartedAt(payload, admin);

  const progressSnapshot = await fetchAuthoritativeProgressSnapshot({
    sessionId: asTrimmedString(payload.session_id),
    participantId: asTrimmedString(payload.participant_id),
    routeOrder,
    adminSupabase: admin,
  });
  if (progressSnapshot === null) {
    return NextResponse.json(
      {
        error: "Svarprogression understøttes ikke med den nuværende answers-struktur.",
        code: "ANSWERS_SCHEMA_INCOMPATIBLE",
      },
      { status: 503 }
    );
  }

  const existingAwardedPoints = Number(existingAnswer.awarded_points);
  const storedIsCorrect = existingAnswer.is_correct === true;
  const responseAwardedPoints = Number.isFinite(existingAwardedPoints)
    ? Math.max(0, Math.round(existingAwardedPoints))
    : 0;

  return NextResponse.json({
    inserted: true,
    awardedPoints: responseAwardedPoints,
    storedIsCorrect,
    serverCorrectness: {
      checked: true,
      isCorrect: storedIsCorrect,
    },
    zoneKrigCapture: null,
    isLocked: true,
    duplicate: true,
    ...progressSnapshot,
  });
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

async function resolveEffectiveAwardedPointsAfterCapture({
  answerId,
  awardedPoints,
  zoneKrigCapture,
  admin,
  requestPath,
  participantId,
  sessionId,
}: {
  answerId: string;
  awardedPoints: number;
  zoneKrigCapture: ZoneKrigCaptureResponse | null;
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  requestPath: string;
  participantId: string | null;
  sessionId: string | null;
}) {
  if (zoneKrigCapture?.status !== "blocked_by_shield") {
    return awardedPoints;
  }

  const { error } = await admin
    .from("answers")
    .update({ awarded_points: 0 })
    .eq("id", answerId)
    .select("id")
    .single<InsertedAnswerRow>();

  if (error) {
    console.error("[zone-krig] Could not reset shield-blocked answer points:", {
      answerId,
      sessionId,
      status: zoneKrigCapture.status,
      message: error.message,
    });

    await logHandledServerError({
      route: "/api/play/submit-answer",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      context: `zone_krig_shield_points_reset_failed:${answerId}:${zoneKrigCapture.status}`,
      participantId,
      sessionId,
    });

    return null;
  }

  return 0;
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

    let sanitizedPayloads = rawPayloads.map((payload) =>
      sanitizeAnswerPayload(payload, participantContext.data)
    );
    let isStandardStudentSubmission = false;
    let standardPostIndex: number | null = null;
    let standardOperationId: string | null = null;
    let standardRouteOrder: number[] = [];

    const run = await getRunForSessionCached(participantContext.data.sessionId, runCache);
    const hasRequestedOperationId = Boolean(asTrimmedString(body.operationId));
    if (!run && hasRequestedOperationId) {
      return NextResponse.json(
        {
          error: "Løbet kunne ikke hentes sikkert.",
          code: "RUN_LOOKUP_FAILED",
        },
        { status: 503 }
      );
    }
    const rawRaceType = run?.raceType ?? run?.race_type;
    isStandardStudentSubmission = usesStandardStudentLocationExperience(rawRaceType);

    if (isStandardStudentSubmission) {
      const questionCount = Array.isArray(run?.questions) ? run.questions.length : 0;
      standardRouteOrder = getServerRouteOrder(
        questionCount,
        participantContext.data.startOffset ?? 0,
        supportsServerStaggeredStart(
          rawRaceType,
          run?.sessionPostOrderMode,
          run?.routeVersion
        )
      );
      const parsedOperationId = parseClientOperationId(body.operationId);
      if (!parsedOperationId.valid) {
        return NextResponse.json(
          {
            error: "Ugyldigt operation-id.",
            code: "INVALID_OPERATION_ID",
          },
          { status: 400 }
        );
      }
      standardOperationId = parsedOperationId.value;

      const indexedStandardPayloads = sanitizedPayloads.map((payload) => ({
        payload,
        index: getStrictStandardPayloadPostIndex(payload),
      }));
      if (
        indexedStandardPayloads.some(
          ({ index }) => index.kind === "invalid"
        )
      ) {
        return NextResponse.json(
          {
            error: "Svarpayloads indeholder ugyldige postdata.",
            code: "INVALID_ANSWER_PAYLOAD",
          },
          { status: 400 }
        );
      }

      const submittedPostIndexes = [
        ...new Set(
          indexedStandardPayloads.flatMap(({ index }) =>
            index.kind === "valid" ? [index.postIndex] : []
          )
        ),
      ];
      if (submittedPostIndexes.length !== 1) {
        return NextResponse.json(
          {
            error: "Svarpayloads matcher ikke den samme post.",
            code: "INVALID_ANSWER_PAYLOAD",
          },
          { status: 400 }
        );
      }

      standardPostIndex = submittedPostIndexes[0] ?? null;
      sanitizedPayloads = indexedStandardPayloads.flatMap(
        ({ payload, index }) =>
          index.kind === "valid" &&
          index.postIndex === standardPostIndex
            ? [payload]
            : []
      );
      const standardQuestion =
        standardPostIndex !== null &&
        Array.isArray(run?.questions) &&
        standardPostIndex >= 0 &&
        standardPostIndex < run.questions.length
          ? run.questions[standardPostIndex]
          : null;
      if (!standardQuestion || standardPostIndex === null) {
        return NextResponse.json(
          {
            error: "Posten kunne ikke findes.",
            code: "POST_NOT_FOUND",
          },
          { status: 404 }
        );
      }

      const standardVariant = resolveQuestionVariant(
        rawRaceType,
        standardQuestion
      );
      if (standardVariant === "photo") {
        return NextResponse.json(
          {
            error: "Foto-poster skal afleveres som et billede.",
            code: "PHOTO_POST_REQUIRES_PHOTO_SUBMISSION",
          },
          { status: 400 }
        );
      }
      if (
        standardVariant !== "quiz" &&
        standardVariant !== "character" &&
        standardOperationId
      ) {
        return NextResponse.json(
          {
            error: "Denne posttype understøtter ikke almindelig svaraflevering.",
            code: "UNSUPPORTED_ANSWER_VARIANT",
          },
          { status: 400 }
        );
      }

      if (standardVariant === "character") {
        sanitizedPayloads = sanitizedPayloads.map(
          buildCharacterCompletionMetadataPayload,
        );
      }

      sanitizedPayloads = await Promise.all(
        sanitizedPayloads.map((payload) =>
          canonicalizeStandardAnswerPayload(payload, runCache)
        )
      );
      if (standardOperationId) {
        sanitizedPayloads = sanitizedPayloads.flatMap((payload) => {
          const operationPayload = {
            ...payload,
            client_operation_id: standardOperationId,
          };
          const legacyPayload: Record<string, unknown> = { ...operationPayload };
          delete legacyPayload.client_operation_id;
          return [operationPayload, legacyPayload];
        });
      }

      const primaryPayload =
        sanitizedPayloads.find(
          (payload) =>
            getStrictStandardPayloadPostIndex(payload).kind === "valid"
        ) ?? null;
      if (!primaryPayload || standardPostIndex === null) {
        return NextResponse.json(
          {
            error: "Svarposten mangler.",
            code: "INVALID_ANSWER_PAYLOAD",
          },
          { status: 400 }
        );
      }

      const enrichedPrimaryPayload = await withAwardedPoints(primaryPayload, runCache);

      if (standardOperationId) {
        const existingOperation = await findExistingAnswerByOperationId(
          participantContext.data.sessionId,
          participantContext.data.participantId,
          standardOperationId,
          admin
        );
        if (existingOperation) {
          const existingOperationPostIndex = getAnsweredPostIndex(
            existingOperation as Record<string, unknown>
          );
          if (existingOperationPostIndex !== standardPostIndex) {
            return NextResponse.json(
              {
                error: "Operationen tilhører en anden post.",
                code: "PROGRESS_MISMATCH",
              },
              { status: 409 }
            );
          }

          return createStandardDuplicateResponse(
            enrichedPrimaryPayload,
            existingOperation,
            admin,
            standardRouteOrder
          );
        }
      }

      const existingAnswer = await findExistingAnswerRecord(
        enrichedPrimaryPayload,
        admin,
        "standard"
      );
      if (existingAnswer) {
        return createStandardDuplicateResponse(
          enrichedPrimaryPayload,
          existingAnswer,
          admin,
          standardRouteOrder
        );
      }

      const safetyResult = await validateStandardSubmissionSafety({
        sessionId: participantContext.data.sessionId,
        participantId: participantContext.data.participantId,
        postIndex: standardPostIndex,
        routeOrder: standardRouteOrder,
        admin,
      });
      if (!safetyResult.ok) {
        return NextResponse.json(
          {
            error: safetyResult.error,
            code: safetyResult.code,
            ...("expectedPostIndex" in safetyResult
              ? { expectedPostIndex: safetyResult.expectedPostIndex }
              : {}),
            ...("answeredPostIndexes" in safetyResult
              ? { answeredPostIndexes: safetyResult.answeredPostIndexes }
              : {}),
            ...("isFinished" in safetyResult
              ? { isFinished: safetyResult.isFinished }
              : {}),
          },
          { status: safetyResult.status }
        );
      }
    }

    if (isStandardStudentSubmission && standardRouteOrder.length === 0) {
      return NextResponse.json(
        {
          error: "Løbets progression kunne ikke beregnes sikkert.",
          code: "RUN_LOOKUP_FAILED",
        },
        { status: 503 }
      );
    }

    for (const payload of sanitizedPayloads) {
      try {
        const enrichedPayload = await withAwardedPoints(payload, runCache);
        const serverCorrectness = await resolveServerCorrectness(enrichedPayload, runCache);
        const awardedPoints = Number(enrichedPayload.awarded_points) || 0;
        const incomingIsCorrect = isCorrectAnswerPayload(enrichedPayload);
        const existingAnswer = await findExistingAnswerRecord(
          enrichedPayload,
          admin,
          isStandardStudentSubmission ? "standard" : "legacy"
        );
        if (existingAnswer && isStandardStudentSubmission) {
          return createStandardDuplicateResponse(
            enrichedPayload,
            existingAnswer,
            admin,
            standardRouteOrder
          );
        }

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
          const effectiveAwardedPoints = await resolveEffectiveAwardedPointsAfterCapture({
            answerId: existingAnswer.id,
            awardedPoints: responseAwardedPoints,
            zoneKrigCapture,
            admin,
            requestPath,
            participantId: participantContext.data.participantId,
            sessionId: participantContext.data.sessionId,
          });
          if (effectiveAwardedPoints === null) {
            return NextResponse.json(
              { error: "Kunne ikke gemme shield-blokerede point.", zoneKrigCapture },
              { status: 500 }
            );
          }
          return NextResponse.json({
            inserted: true,
            awardedPoints: effectiveAwardedPoints,
            zoneKrigCapture,
            isLocked: true,
            ...(serverCorrectness ? { serverCorrectness } : {}),
          });
        }

        const insertSelectClause = isStandardStudentSubmission
          ? "id,is_correct,awarded_points"
          : "id";
        const { data: insertedAnswer, error } = await admin
          .from("answers")
          .insert(enrichedPayload)
          .select(insertSelectClause)
          .single<InsertedAnswerRow>();
        if (!error) {
          if (!insertedAnswer?.id) {
            const missingAnswerIdError = new Error("Answer insert succeeded without returning an id.");
            await logHandledServerError({
              route: "/api/play/submit-answer",
              method: "POST",
              status: 500,
              error: missingAnswerIdError,
              requestPath,
              routeType: "route",
              context: "zone_krig_answer_id_missing",
              participantId: participantContext.data.participantId,
              sessionId: participantContext.data.sessionId,
            });
            return NextResponse.json({ error: "Kunne ikke gemme svar." }, { status: 500 });
          }

          const storedIsCorrect = isStandardStudentSubmission
            ? insertedAnswer.is_correct === true
            : incomingIsCorrect;
          const insertedAwardedPoints = Number(
            insertedAnswer.awarded_points
          );
          const storedAwardedPoints = isStandardStudentSubmission
            ? Number.isFinite(insertedAwardedPoints)
              ? Math.max(0, Math.round(insertedAwardedPoints))
              : 0
            : awardedPoints;

          await maybeStampRunStartedAt(enrichedPayload, admin);
          const zoneKrigCapture = await maybeCaptureZone(
            enrichedPayload,
            admin,
            storedAwardedPoints,
            runCache
          );
          const effectiveAwardedPoints = await resolveEffectiveAwardedPointsAfterCapture({
            answerId: insertedAnswer.id,
            awardedPoints: storedAwardedPoints,
            zoneKrigCapture,
            admin,
            requestPath,
            participantId: participantContext.data.participantId,
            sessionId: participantContext.data.sessionId,
          });
          if (effectiveAwardedPoints === null) {
            return NextResponse.json(
              { error: "Kunne ikke gemme shield-blokerede point.", zoneKrigCapture },
              { status: 500 }
            );
          }
          const progressSnapshot = isStandardStudentSubmission
            ? await fetchAuthoritativeProgressSnapshot({
                sessionId: participantContext.data.sessionId,
                participantId: participantContext.data.participantId,
                routeOrder: standardRouteOrder,
                adminSupabase: admin,
              })
            : null;
          if (isStandardStudentSubmission && progressSnapshot === null) {
            return NextResponse.json(
              {
                error:
                  "Svarprogression understøttes ikke med den nuværende answers-struktur.",
                code: "ANSWERS_SCHEMA_INCOMPATIBLE",
              },
              { status: 503 }
            );
          }
          return NextResponse.json({
            inserted: true,
            awardedPoints: effectiveAwardedPoints,
            zoneKrigCapture,
            isLocked: true,
            ...(isStandardStudentSubmission
              ? {
                  storedIsCorrect,
                  serverCorrectness: {
                    checked: true,
                    isCorrect: storedIsCorrect,
                  },
                }
              : serverCorrectness
                ? { serverCorrectness }
                : {}),
            ...(progressSnapshot ?? {}),
          });
        }

        if (
          isStandardStudentSubmission &&
          standardPostIndex !== null &&
          isUniqueViolationError(error)
        ) {
          const existingOperation = standardOperationId
            ? await findExistingAnswerByOperationId(
                participantContext.data.sessionId,
                participantContext.data.participantId,
                standardOperationId,
                admin
              )
            : null;
          const existingOperationPostIndex = existingOperation
            ? getAnsweredPostIndex(existingOperation as Record<string, unknown>)
            : null;

          if (
            existingOperation &&
            existingOperationPostIndex !== standardPostIndex
          ) {
            return NextResponse.json(
              {
                error: "Operationen tilhører en anden post.",
                code: "PROGRESS_MISMATCH",
              },
              { status: 409 }
            );
          }

          const duplicateAnswer =
            existingOperation ??
            (await findExistingAnswerRecord(
              enrichedPayload,
              admin,
              "standard"
            ));
          if (duplicateAnswer) {
            return createStandardDuplicateResponse(
              enrichedPayload,
              duplicateAnswer,
              admin,
              standardRouteOrder
            );
          }
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
