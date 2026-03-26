import { NextRequest, NextResponse } from "next/server";

import {
  asTrimmedString,
  extractEscapeCodeBrick,
  fetchParticipantLocationState,
  fetchRunForSession,
  getCorrectIndex,
  getExpectedAnswer,
  getLocationDistanceMeters,
  normalizeEscapeAnswer,
  resolveQuestionVariant,
} from "@/app/api/play/_shared";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";

export const runtime = "edge";

type ValidateAnswerPayload = {
  sessionId?: unknown;
  participantId?: unknown;
  postIndex?: unknown;
  answer?: unknown;
  selectedIndex?: unknown;
};

const SERVER_POSITION_VALIDATION_RADIUS_METERS = 65;

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

function asSelectedIndex(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
}

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string"
      ? Number(value)
      : null;
}

function getQuestionCoordinates(rawQuestion: unknown) {
  if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) return null;
  const candidate = rawQuestion as { lat?: unknown; lng?: unknown };
  const lat = asFiniteNumber(candidate.lat);
  const lng = asFiniteNumber(candidate.lng);
  if (lat === null || !Number.isFinite(lat) || lng === null || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

async function validateParticipantPosition(sessionId: string, participantId: string, rawQuestion: unknown) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
  }

  const questionCoordinates = getQuestionCoordinates(rawQuestion);
  if (!questionCoordinates) {
    return "Posten mangler gyldige GPS-koordinater.";
  }

  const participantState = await fetchParticipantLocationState(sessionId, participantId, adminSupabase);
  const participantLat = asFiniteNumber(participantState?.lat);
  const participantLng = asFiniteNumber(participantState?.lng);

  if (participantLat === null || !Number.isFinite(participantLat) || participantLng === null || !Number.isFinite(participantLng)) {
    return "Vi mangler din seneste GPS-position. Gå tættere på posten og prøv igen.";
  }

  const distanceToPost = getLocationDistanceMeters(
    participantLat,
    participantLng,
    questionCoordinates.lat,
    questionCoordinates.lng
  );

  if (distanceToPost > SERVER_POSITION_VALIDATION_RADIUS_METERS) {
    return "Du skal være tættere på posten, før svaret kan godkendes.";
  }

  return null;
}

export async function POST(request: NextRequest) {
  let payload: ValidateAnswerPayload;

  try {
    payload = (await request.json()) as ValidateAnswerPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const participantId = asTrimmedString(payload.participantId);
  const postIndex = asPostIndex(payload.postIndex);
  const answer = asTrimmedString(payload.answer);
  const selectedIndex = asSelectedIndex(payload.selectedIndex);

  if (!sessionId || postIndex === null) {
    return NextResponse.json({ error: "Manglende valideringsdata." }, { status: 400 });
  }

  try {
    const run = await fetchRunForSession(sessionId);
    if (!run || !Array.isArray(run.questions) || postIndex >= run.questions.length) {
      return NextResponse.json({ error: "Gåden kunne ikke findes." }, { status: 404 });
    }

    const rawQuestion = run.questions[postIndex];
    // Allow explicit post_type to short-circuit validation (e.g. intro posts)
    const postType = getPostType(rawQuestion);

    if (typeof postType === "string" && postType.trim().toLowerCase() === "intro") {
      return NextResponse.json({ isCorrect: true, isIntro: true });
    }

    const variant = resolveQuestionVariant(run.raceType ?? run.race_type, rawQuestion);
    if (!participantId) {
      return NextResponse.json({ error: "Deltager-id mangler." }, { status: 400 });
    }

    const positionValidationError = await validateParticipantPosition(sessionId, participantId, rawQuestion);
    if (positionValidationError) {
      return NextResponse.json({ error: positionValidationError }, { status: 403 });
    }

    if (variant === "quiz") {
      const correctIndex = getCorrectIndex(rawQuestion);
      if (correctIndex === null || selectedIndex === null) {
        return NextResponse.json({ error: "Quiz-svaret mangler." }, { status: 400 });
      }

      return NextResponse.json({
        isCorrect: selectedIndex === correctIndex,
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
      });
    }

    return NextResponse.json({ error: "Denne post-type bruger en anden validator." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Kunne ikke validere gådesvar:", error);
    return NextResponse.json({ error: "Kunne ikke tjekke svaret." }, { status: 500 });
  }
}
