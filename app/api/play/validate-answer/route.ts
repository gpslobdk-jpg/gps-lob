import { NextRequest, NextResponse } from "next/server";

import {
  asTrimmedString,
  extractEscapeCodeBrick,
  fetchRunForSession,
  getFirstRoutePostIndexForParticipant,
  getCorrectIndex,
  getExpectedAnswer,
  normalizeEscapeAnswer,
  resolveQuestionVariant,
  isZoneKrigRaceType,
} from "@/app/api/play/_shared";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { getAwardedPoints } from "@/utils/questionPoints";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "edge";

type ValidateAnswerPayload = {
  sessionId?: unknown;
  participantId?: unknown;
  postIndex?: unknown;
  answer?: unknown;
  selectedIndex?: unknown;
};

type ZoneKrigSessionStateRow = {
  status?: string | null;
  ends_at?: string | null;
};

type CaptureZoneRpcRow = {
  zone_id?: string | null;
  owner_team_id?: string | null;
  previous_owner_team_id?: string | null;
  captured?: boolean | null;
  owner_changed?: boolean | null;
  blocked_by_shield?: boolean | null;
  zone_missing?: boolean | null;
};

type ZoneKrigCaptureResponse =
  | {
      status: "captured" | "blocked_by_shield" | "already_owned" | "zone_missing" | "game_over";
      shieldRemainingSeconds?: number;
    }
  | null;

function getPostType(rawQuestion: unknown) {
  if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) return null;
  const candidate = rawQuestion as { post_type?: unknown; postType?: unknown };
  if (typeof candidate.post_type === "string") return candidate.post_type;
  if (typeof candidate.postType === "string") return candidate.postType;
  return null;
}

function asPostIndex(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
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

async function hasExistingAnswerRecord(
  sessionId: string,
  studentName: string,
  participantId: string,
  postIndex: number,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const normalizedStudentName = asTrimmedString(studentName);
  const lookupCandidates = [
    normalizedStudentName ? { column: "student_name" as const, value: normalizedStudentName } : null,
    !normalizedStudentName && asTrimmedString(participantId)
      ? { column: "participant_id" as const, value: asTrimmedString(participantId) }
      : null,
  ].filter((candidate): candidate is { column: "student_name" | "participant_id"; value: string } =>
    candidate !== null
  );

  if (lookupCandidates.length === 0) {
    return false;
  }

  for (const lookup of lookupCandidates) {
    for (const column of ["question_index", "post_index"] as const) {
      const value = column === "question_index" ? postIndex : postIndex + 1;
      const { data, error } = await admin
        .from("answers")
        .select("id")
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

      if (Array.isArray(data) && data.length > 0) {
        return true;
      }
    }
  }

  return false;
}

async function maybeStampRunStartedAt(
  sessionId: string,
  participantId: string,
  startOffset: number | string | null,
  answeredPostIndex: number,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const run = await fetchRunForSession(sessionId);
  const questionCount = Array.isArray(run?.questions) ? run.questions.length : 0;
  if (questionCount <= 0) return;

  const firstRoutePostIndex = getFirstRoutePostIndexForParticipant(
    questionCount,
    startOffset ?? 0,
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

async function maybeCaptureZoneAfterAtomicQuizAttempt(
  sessionId: string,
  zoneIndex: number,
  teamId: string | null,
  awardedPoints: number,
  run: Awaited<ReturnType<typeof fetchRunForSession>>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<ZoneKrigCaptureResponse> {
  try {
    if (!isZoneKrigRaceType(run?.raceType ?? run?.race_type)) return null;
    if (!teamId) return null;

    const zoneKrigSession = await fetchZoneKrigSessionState(sessionId, admin);
    const endsAtMs = zoneKrigSession.endsAt ? new Date(zoneKrigSession.endsAt).getTime() : Number.NaN;

    if (
      zoneKrigSession.status === "finished" ||
      (Number.isFinite(endsAtMs) && Date.now() > endsAtMs)
    ) {
      return { status: "game_over" };
    }

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
      console.warn(`[quiz-atomic] Zone ${zoneIndex} mangler for session ${sessionId}. Capture blev sprunget over.`);
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

      return { status: "blocked_by_shield", shieldRemainingSeconds };
    }

    if (captureResult.captured) {
      return { status: "captured" };
    }

    if (captureResult.owner_changed) {
      return { status: "captured" };
    }

    if (captureResult.owner_team_id) {
      return { status: "already_owned" };
    }

    return null;
  } catch (error) {
    console.warn("[quiz-atomic] maybeCaptureZoneAfterAtomicQuizAttempt failed silently:", error);
    return null;
  }
}

function asSelectedIndex(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
}

export async function POST(request: NextRequest) {
  let payload: ValidateAnswerPayload;
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    payload = (await request.json()) as ValidateAnswerPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const claimedSessionId = asTrimmedString(payload.sessionId);
  const claimedParticipantId = asTrimmedString(payload.participantId);
  const postIndex = asPostIndex(payload.postIndex);
  const answer = asTrimmedString(payload.answer);
  const selectedIndex = asSelectedIndex(payload.selectedIndex);

  if (postIndex === null) {
    return NextResponse.json({ error: "Manglende valideringsdata." }, { status: 400 });
  }

  try {
    const participantContext = await resolveParticipantRequestContext({
      claimedParticipantId: claimedParticipantId || null,
      claimedSessionId: claimedSessionId || null,
    });
    if (!participantContext.ok) {
      return NextResponse.json({ error: participantContext.error }, { status: participantContext.status });
    }
    const { sessionId, participantId } = participantContext.data;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    const run = await fetchRunForSession(sessionId);
    if (!run || !Array.isArray(run.questions) || postIndex >= run.questions.length) {
      return NextResponse.json({ error: "Gåden kunne ikke findes." }, { status: 404 });
    }

    const isLocked = await hasExistingAnswerRecord(
      sessionId,
      participantContext.data.studentName,
      participantId,
      postIndex,
      admin
    );

    const rawQuestion = run.questions[postIndex];
    // Allow explicit post_type to short-circuit validation (e.g. intro posts)
    const postType = getPostType(rawQuestion);

    if (typeof postType === "string" && postType.trim().toLowerCase() === "intro") {
      return NextResponse.json({ isCorrect: true, isIntro: true, isLocked });
    }

    const variant = resolveQuestionVariant(run.raceType ?? run.race_type, rawQuestion);
    // Answer checking must stay soft: delayed sync and GPS drift may not block the student flow.

    if (variant === "quiz") {
      const correctIndex = getCorrectIndex(rawQuestion);
      if (correctIndex === null || selectedIndex === null) {
        return NextResponse.json({ error: "Quiz-svaret mangler." }, { status: 400 });
      }

      const awardedPoints = getAwardedPoints(rawQuestion, true);
      const isCorrect = selectedIndex === correctIndex;
      const questionText =
        rawQuestion && typeof rawQuestion === "object" && !Array.isArray(rawQuestion) && typeof (rawQuestion as { text?: unknown }).text === "string"
          ? String((rawQuestion as { text?: unknown }).text)
          : "";

      if (isLocked) {
        return NextResponse.json({
          isCorrect,
          isLocked: true,
          awardedPoints: 0,
        });
      }

      const insertedAnswer = {
        session_id: sessionId,
        participant_id: participantId,
        student_name: participantContext.data.studentName,
        post_index: postIndex + 1,
        question_index: postIndex,
        selected_index: selectedIndex,
        answer_index: selectedIndex,
        is_correct: isCorrect,
        awarded_points: isCorrect ? awardedPoints : 0,
        question_text: questionText,
        answered_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await admin.from("answers").insert(insertedAnswer);
      if (insertError) {
        if ((insertError as { code?: string }).code === "23505") {
          return NextResponse.json({
            isCorrect,
            isLocked: true,
            awardedPoints: 0,
          });
        }

        throw new Error(insertError.message ?? "Kunne ikke gemme quiz-svaret.");
      }

      try {
        await maybeStampRunStartedAt(
          sessionId,
          participantId,
          participantContext.data.startOffset,
          postIndex,
          admin
        );
      } catch (error) {
        console.error("Kunne ikke opdatere run_started_at for quiz-svaret:", error);
      }

      const zoneKrigCapture = isCorrect
        ? await maybeCaptureZoneAfterAtomicQuizAttempt(
            sessionId,
            postIndex,
            participantContext.data.teamId,
            awardedPoints,
            run,
            admin
          )
        : null;

      return NextResponse.json({
        isCorrect,
        isLocked: false,
        awardedPoints: isCorrect ? awardedPoints : 0,
        zoneKrigCapture,
      });
    }

    if (variant === "roleplay" || variant === "escape") {
      const expectedAnswer = getExpectedAnswer(rawQuestion);
      if (!expectedAnswer || !answer) {
        return NextResponse.json({ error: "Svaret mangler." }, { status: 400 });
      }

      const isCorrect = normalizeEscapeAnswer(answer) === normalizeEscapeAnswer(expectedAnswer);

      return NextResponse.json({
        isCorrect,
        brick: variant === "escape" && isCorrect ? extractEscapeCodeBrick(rawQuestion, postIndex) : null,
        isLocked,
      });
    }

    return NextResponse.json({ error: "Denne post-type bruger en anden validator." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Kunne ikke validere gådesvar:", error);
    await logHandledServerError({
      route: "/api/play/validate-answer",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      participantId: claimedParticipantId || null,
      sessionId: claimedSessionId || null,
    });
    return NextResponse.json({ error: "Kunne ikke tjekke svaret." }, { status: 500 });
  }
}
