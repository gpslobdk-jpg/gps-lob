import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";

export const runtime = "edge";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type ParticipantSnapshotRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  accuracy?: number | string | null;
  finished_at?: string | null;
  start_offset?: number | string | null;
  run_started_at?: string | null;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

function asTrimmedString(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingColumnError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column/i.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

async function fetchParticipantSnapshot(
  sessionId: string,
  participantId: string,
  adminSupabase: AdminSupabaseClient
) {
  const runQuery = (selectClause: string) =>
    adminSupabase
      .from("participants")
      .select(selectClause)
      .eq("id", participantId)
      .eq("session_id", sessionId)
      .maybeSingle<ParticipantSnapshotRow>();

  let result = await runQuery(
    "id,session_id,student_name,lat,lng,accuracy,finished_at,start_offset,run_started_at"
  );

  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuery("id,session_id,student_name,lat,lng,finished_at,start_offset,run_started_at");
  }

  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuery("id,session_id,student_name,lat,lng,finished_at,start_offset");
  }

  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuery("id,session_id,student_name,lat,lng,finished_at");
  }

  return result;
}

export async function GET(request: NextRequest) {
  const claimedSessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
  const claimedParticipantId = asTrimmedString(request.nextUrl.searchParams.get("participantId"));

  if (!claimedSessionId || !claimedParticipantId) {
    return NextResponse.json({ error: "Session-id eller deltager-id mangler." }, { status: 400 });
  }

  const participantContext = await resolveParticipantRequestContext({
    claimedParticipantId,
    claimedSessionId,
  });

  if (!participantContext.ok) {
    return NextResponse.json({ error: participantContext.error }, { status: participantContext.status });
  }

  const { adminSupabase, participantId, sessionId } = participantContext.data;
  const { data, error } = await fetchParticipantSnapshot(sessionId, participantId, adminSupabase);

  if (error) {
    console.error("Kunne ikke hente deltager-snapshot:", error);
    return NextResponse.json({ error: "Kunne ikke hente deltageren." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Deltageren findes ikke længere." }, { status: 404 });
  }

  return NextResponse.json(
    {
      participant: data,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}