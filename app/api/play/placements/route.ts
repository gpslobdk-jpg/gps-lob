import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";

export const runtime = "edge";

type PlacementRow = {
  student_name?: string | null;
  finished_at?: string | null;
};

type ParticipantLookupRow = {
  id?: string | null;
};

function asTrimmedString(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const sessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
  const participantId = asTrimmedString(request.nextUrl.searchParams.get("participantId"));

  if (!sessionId || !participantId) {
    return NextResponse.json({ error: "Session-id eller deltager-id mangler." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  const { data: participantRows, error: participantError } = await adminSupabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .limit(1);

  if (participantError) {
    console.error("Kunne ikke validere deltageren før play-placeringer:", participantError);
    return NextResponse.json({ error: "Placeringerne kunne ikke hentes." }, { status: 500 });
  }

  const participant = ((participantRows ?? []) as ParticipantLookupRow[])[0] ?? null;
  if (!participant?.id) {
    return NextResponse.json({ error: "Deltageren findes ikke i sessionen." }, { status: 404 });
  }

  const loadPlacements = async (table: "participants" | "session_students") =>
    adminSupabase
      .from(table)
      .select("student_name,finished_at")
      .eq("session_id", sessionId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: true });

  let result = await loadPlacements("participants");
  if (result.error?.code === "PGRST205") {
    result = await loadPlacements("session_students");
  }

  if (result.error) {
    console.error("Kunne ikke hente play-placeringer:", result.error);
    return NextResponse.json({ error: "Placeringerne kunne ikke hentes." }, { status: 500 });
  }

  return NextResponse.json({
    placements: ((result.data ?? []) as PlacementRow[]).map((row) => ({
      student_name: row.student_name ?? null,
      finished_at: row.finished_at ?? null,
    })),
  });
}
