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

async function maybeStampRunStartedAt(
  payload: Record<string, unknown>,
  admin: NonNullable<ReturnType<typeof createAdminClient>>
) {
  if (!isCorrectAnswerPayload(payload)) return;

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
        const { error } = await admin.from("answers").insert(payload as Record<string, unknown>);
        if (!error) {
          await maybeStampRunStartedAt(payload, admin);
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
