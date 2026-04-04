import { NextRequest, NextResponse } from "next/server";

import {
  asTrimmedString,
  extractEscapeCodeBrick,
  fetchParticipantLocationState,
  fetchRunForSession,
  fetchZoneKrigZoneState,
  getCorrectIndex,
  getExpectedAnswer,
  getLocationDistanceMeters,
  getServerPositionValidationRadius,
  isZoneKrigRaceType,
  normalizeEscapeAnswer,
  resolveQuestionVariant,
} from "@/app/api/play/_shared";
import { ADMIN_ACCESS_MISSING_MESSAGE } from "@/utils/supabase/admin";
import type { ParticipantRequestContext } from "@/utils/supabase/participantServer";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "edge";

type ValidateAnswerPayload = {
  sessionId?: unknown;
  participantId?: unknown;
  postIndex?: unknown;
  answer?: unknown;
  selectedIndex?: unknown;
};

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

type ValidationTarget = {
  lat: number;
  lng: number;
  label: string;
};

async function validateParticipantPosition(
  sessionId: string,
  participantId: string,
  target: ValidationTarget,
  validationRadiusMeters: number,
  adminSupabase: ParticipantRequestContext["adminSupabase"]
) {
  const participantState = await fetchParticipantLocationState(sessionId, participantId, adminSupabase);
  const participantLat = asFiniteNumber(participantState?.lat);
  const participantLng = asFiniteNumber(participantState?.lng);

  if (participantLat === null || !Number.isFinite(participantLat) || participantLng === null || !Number.isFinite(participantLng)) {
    return "Vi mangler din seneste GPS-position. Gå tættere på posten og prøv igen.";
  }

  const distanceToPost = getLocationDistanceMeters(
    participantLat,
    participantLng,
    target.lat,
    target.lng
  );

  if (distanceToPost > validationRadiusMeters) {
    return `Du er for langt væk fra ${target.label.toLocaleLowerCase("da-DK")} til at svare.`;
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
    const { adminSupabase, participantId, sessionId } = participantContext.data;

    const run = await fetchRunForSession(sessionId);
    if (!run || !Array.isArray(run.questions) || postIndex >= run.questions.length) {
      return NextResponse.json({ error: "Gåden kunne ikke findes." }, { status: 404 });
    }

    const rawQuestion = run.questions[postIndex];
    const isZoneKrig = isZoneKrigRaceType(run.raceType ?? run.race_type);
    const validationRadiusMeters = getServerPositionValidationRadius(run);
    // Allow explicit post_type to short-circuit validation (e.g. intro posts)
    const postType = getPostType(rawQuestion);

    if (typeof postType === "string" && postType.trim().toLowerCase() === "intro") {
      return NextResponse.json({ isCorrect: true, isIntro: true });
    }

    const variant = resolveQuestionVariant(run.raceType ?? run.race_type, rawQuestion);
    let validationTarget: ValidationTarget | null = null;
    let effectiveValidationRadiusMeters = validationRadiusMeters;

    if (isZoneKrig) {
      const zone = await fetchZoneKrigZoneState(sessionId, postIndex, adminSupabase);
      const zoneLat = asFiniteNumber(zone?.center_lat);
      const zoneLng = asFiniteNumber(zone?.center_lng);
      const zoneRadius = asFiniteNumber(zone?.radius_m);

      if (!zone || zoneLat === null || zoneLng === null || zoneRadius === null || zoneRadius <= 0) {
        return NextResponse.json({ error: "Zonen kunne ikke valideres endnu." }, { status: 409 });
      }

      validationTarget = {
        lat: zoneLat,
        lng: zoneLng,
        label: `Zone ${postIndex + 1}`,
      };
      effectiveValidationRadiusMeters = Math.round(zoneRadius);
    } else {
      const questionCoordinates = getQuestionCoordinates(rawQuestion);
      if (!questionCoordinates) {
        return NextResponse.json({ error: "Posten mangler gyldige GPS-koordinater." }, { status: 400 });
      }

      validationTarget = {
        lat: questionCoordinates.lat,
        lng: questionCoordinates.lng,
        label: "Posten",
      };
    }

    const positionValidationError = await validateParticipantPosition(
      sessionId,
      participantId,
      validationTarget,
      effectiveValidationRadiusMeters,
      adminSupabase
    );
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
