import { NextRequest, NextResponse } from "next/server";

import { isParticipantRemovalUuid } from "@/lib/live/participantRemoval";
import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "edge";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const ACTIVE_SESSION_STATUSES = ["waiting", "running", "active", "paused"] as const;
const MAX_BODY_BYTES = 2_048;

type RemoveParticipantPayload = {
  sessionId?: unknown;
  participantId?: unknown;
};

type LiveSessionRow = {
  id?: string | null;
  status?: string | null;
  teacher_id?: string | null;
};

type ParticipantRemovalRow = {
  id?: string | null;
  removed_at?: string | null;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readPayload(request: NextRequest): Promise<RemoveParticipantPayload | null> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return null;
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as RemoveParticipantPayload)
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const payload = await readPayload(request);
  const sessionId = asTrimmedString(payload?.sessionId);
  const participantId = asTrimmedString(payload?.participantId);

  if (!isParticipantRemovalUuid(sessionId) || !isParticipantRemovalUuid(participantId)) {
    return json({ error: "Ugyldig deltager eller session." }, 400);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || user.is_anonymous) {
      return json({ error: "Du skal være logget ind som lærer." }, 401);
    }

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, 503);
    }

    const { data: session, error: sessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,status,teacher_id")
      .eq("id", sessionId)
      .maybeSingle<LiveSessionRow>();

    if (sessionError) throw new Error(sessionError.message);
    if (!session?.id) return json({ error: "Sessionen blev ikke fundet." }, 404);
    if (session.teacher_id !== user.id) {
      return json({ error: "Du har ikke adgang til denne session." }, 403);
    }
    if (!ACTIVE_SESSION_STATUSES.includes(session.status as (typeof ACTIVE_SESSION_STATUSES)[number])) {
      return json({ error: "Løbet er allerede afsluttet." }, 409);
    }

    const removedAt = new Date().toISOString();
    const { data: removedRows, error: removeError } = await adminSupabase
      .from("participants")
      .update({
        removed_at: removedAt,
        lat: null,
        lng: null,
        accuracy: null,
        last_updated: removedAt,
      })
      .eq("id", participantId)
      .eq("session_id", sessionId)
      .is("removed_at", null)
      .select("id");

    if (removeError) throw new Error(removeError.message);
    if (Array.isArray(removedRows) && removedRows.length > 0) {
      return json({ removed: true, participantId, alreadyRemoved: false });
    }

    const { data: existingParticipant, error: existingError } = await adminSupabase
      .from("participants")
      .select("id,removed_at")
      .eq("id", participantId)
      .eq("session_id", sessionId)
      .maybeSingle<ParticipantRemovalRow>();

    if (existingError) throw new Error(existingError.message);
    if (!existingParticipant?.id) {
      return json({ error: "Holdet blev ikke fundet i dette løb." }, 404);
    }

    if (existingParticipant.removed_at) {
      return json({ removed: true, participantId, alreadyRemoved: true });
    }

    return json({ error: "Holdet kunne ikke fjernes. Prøv igen." }, 409);
  } catch (error) {
    console.error("Kunne ikke fjerne hold fra live-session:", error);
    return json({ error: "Holdet kunne ikke fjernes. Prøv igen." }, 500);
  }
}
