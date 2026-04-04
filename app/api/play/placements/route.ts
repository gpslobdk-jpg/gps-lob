import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "edge";

type PlacementRow = {
  student_name?: string | null;
  run_started_at?: string | null;
  finished_at?: string | null;
};

function asTrimmedString(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export async function GET(request: NextRequest) {
  const claimedSessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
  const claimedParticipantId = asTrimmedString(request.nextUrl.searchParams.get("participantId"));

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  const participantContext = await resolveParticipantRequestContext({
    adminSupabase,
    claimedParticipantId: claimedParticipantId || null,
    claimedSessionId: claimedSessionId || null,
  });
  if (!participantContext.ok) {
    return NextResponse.json({ error: participantContext.error }, { status: participantContext.status });
  }

  const { sessionId } = participantContext.data;

  const loadPlacements = async (table: "participants" | "session_students") =>
    adminSupabase
      .from(table)
      .select(
        table === "participants"
          ? "student_name,run_started_at,finished_at"
          : "student_name,finished_at"
      )
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

  const placements = ((result.data ?? []) as PlacementRow[])
    .map((row) => {
      const finishedAtTs = toTimestamp(row.finished_at);
      const startedAtTs = toTimestamp(row.run_started_at);
      const elapsedTimeMs =
        finishedAtTs !== null && startedAtTs !== null && finishedAtTs >= startedAtTs
          ? finishedAtTs - startedAtTs
          : null;

      return {
        student_name: row.student_name ?? null,
        run_started_at: row.run_started_at ?? null,
        finished_at: row.finished_at ?? null,
        elapsedTimeMs,
      };
    })
    .sort((a, b) => {
      const aElapsed = a.elapsedTimeMs ?? Number.POSITIVE_INFINITY;
      const bElapsed = b.elapsedTimeMs ?? Number.POSITIVE_INFINITY;
      if (aElapsed !== bElapsed) {
        return aElapsed - bElapsed;
      }

      const aFinishedAt = toTimestamp(a.finished_at) ?? Number.POSITIVE_INFINITY;
      const bFinishedAt = toTimestamp(b.finished_at) ?? Number.POSITIVE_INFINITY;
      if (aFinishedAt !== bFinishedAt) {
        return aFinishedAt - bFinishedAt;
      }

      return (a.student_name ?? "").localeCompare(b.student_name ?? "", "da");
    });

  return NextResponse.json({
    placements,
  });
}
