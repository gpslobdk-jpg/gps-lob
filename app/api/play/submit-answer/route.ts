import { NextRequest, NextResponse } from "next/server";

import {
  fetchParticipantStartState,
  fetchRunForSession,
  getAnsweredPostIndex,
  getFirstRoutePostIndexForParticipant,
} from "@/app/api/play/_shared";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";

export const runtime = "edge";

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

type ExistingAnswerRow = {
  id: string;
};

async function hasExistingAnswerRecord(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const sessionId = asTrimmedString(payload.session_id);
  const participantId = asTrimmedString(payload.participant_id);
  const studentName = asTrimmedString(payload.student_name);
  const answeredAt = asTrimmedString(payload.answered_at);
  const createdAt = asTrimmedString(payload.created_at);

  if (!sessionId) {
    return false;
  }

  const identityFilters = [
    participantId ? { column: "participant_id", value: participantId } : null,
    studentName ? { column: "student_name", value: studentName } : null,
  ].filter((value): value is { column: string; value: string } => value !== null);

  const timestampFilters = [
    answeredAt ? { column: "answered_at", value: answeredAt } : null,
    createdAt ? { column: "created_at", value: createdAt } : null,
  ].filter((value): value is { column: string; value: string } => value !== null);

  if (identityFilters.length === 0 || timestampFilters.length === 0) {
    return false;
  }

  for (const identity of identityFilters) {
    for (const timestamp of timestampFilters) {
      const { data, error } = await admin
        .from("answers")
        .select("id")
        .eq("session_id", sessionId)
        .eq(identity.column, identity.value)
        .eq(timestamp.column, timestamp.value)
        .limit(1);

      if (error) {
        if (isMissingColumnError(error)) {
          continue;
        }

        throw new Error(error.message ?? "Kunne ikke tjekke eksisterende svar.");
      }

      if (Array.isArray(data) && (data as ExistingAnswerRow[]).length > 0) {
        return true;
      }
    }
  }

  return false;
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

type GameZoneRow = {
  id: string;
  owner_team_id: string | null;
  shield_until: string | null;
};

async function maybeCaptureZone(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  try {
    if (!isCorrectAnswerPayload(payload)) return;

    const run = await fetchRunForSession(asTrimmedString(payload.session_id)).catch(() => null);
    const rawRaceType = asTrimmedString(run?.race_type ?? run?.raceType);
    if (rawRaceType !== "zone_krig") return;

    const teamId = asTrimmedString(payload.zone_krig_team_id);
    if (!teamId) return;

    const sessionId = asTrimmedString(payload.session_id);
    if (!sessionId) return;

    const zoneIndex = getAnsweredPostIndex(payload);
    if (zoneIndex === null) return;

    const shieldUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    // Check if zone already exists
    const { data: existingZone } = await admin
      .from("game_zones")
      .select("id,owner_team_id,shield_until")
      .eq("session_id", sessionId)
      .eq("zone_index", zoneIndex)
      .maybeSingle<GameZoneRow>();

    if (existingZone) {
      // Reject capture if zone is shielded by another team.
      // Compare using UTC ms to avoid timezone-skew on server/client.
      const shieldActiveMs =
        existingZone.shield_until !== null
          ? new Date(existingZone.shield_until).getTime()
          : 0;
      if (shieldActiveMs > Date.now() && existingZone.owner_team_id !== teamId) return;

      await admin
        .from("game_zones")
        .update({ owner_team_id: teamId, shield_until: shieldUntil })
        .eq("id", existingZone.id);
    } else {
      // Lazily create zone with coordinates from run questions
      const questions = Array.isArray(run?.questions) ? run!.questions : [];
      const q = (questions[zoneIndex] ?? {}) as Record<string, unknown>;
      const centerLat = typeof q.lat === "number" ? q.lat : 0;
      const centerLng = typeof q.lng === "number" ? q.lng : 0;

      await admin.from("game_zones").insert({
        session_id: sessionId,
        zone_index: zoneIndex,
        center_lat: centerLat,
        center_lng: centerLng,
        radius_m: 30,
        owner_team_id: teamId,
        shield_until: shieldUntil,
      });
    }
  } catch (err) {
    console.error("[zone-krig] maybeCaptureZone failed silently:", err);
  }
}

export async function POST(request: NextRequest) {
  let body: SubmitAnswerPayload;
  try {
    body = (await request.json()) as SubmitAnswerPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const rawPayloads = body.payloads ?? null;
  if (!isArrayOfRecords(rawPayloads)) {
    return NextResponse.json({ error: "Manglende eller ugyldigt payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  try {
    for (const payload of rawPayloads) {
      try {
        const existingAnswer = await hasExistingAnswerRecord(payload, admin);
        if (existingAnswer) {
          await maybeStampRunStartedAt(payload, admin);
          await maybeCaptureZone(payload, admin);
          return NextResponse.json({ inserted: true });
        }

        const { error } = await admin.from("answers").insert(payload as Record<string, unknown>);
        if (!error) {
          await maybeStampRunStartedAt(payload, admin);
          await maybeCaptureZone(payload, admin);
          return NextResponse.json({ inserted: true });
        }

        if (isMissingColumnError(error)) {
          // Skip payloads that rely on missing columns and try next
          continue;
        }

        // If we hit a non-recoverable error, return it so the client can log it
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
    return NextResponse.json({ error: "Kunne ikke gemme svar." }, { status: 500 });
  }
}
