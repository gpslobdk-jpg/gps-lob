import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { logServerResponseError } from "@/utils/telemetry/serverLogs";
import { resolveParticipantRequestContext } from "@/utils/supabase/participantServer";
import { shouldExposeStudentLocation } from "@/lib/studentData/privacyPolicy";

export const runtime = "edge";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type ParticipantSnapshotRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  accuracy?: number | string | null;
  last_updated?: string | null;
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
    "id,session_id,student_name,lat,lng,accuracy,last_updated,finished_at,start_offset,run_started_at"
  );

  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuery("id,session_id,student_name,lat,lng,last_updated,finished_at,start_offset,run_started_at");
  }

  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuery("id,session_id,student_name,lat,lng,last_updated,finished_at,start_offset");
  }

  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuery("id,session_id,student_name,lat,lng,last_updated,finished_at");
  }

  return result;
}

export async function GET(request: NextRequest) {
  const claimedSessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
  const claimedParticipantId = asTrimmedString(request.nextUrl.searchParams.get("participantId"));
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (!claimedSessionId || !claimedParticipantId) {
    return NextResponse.json({ error: "Session-id eller deltager-id mangler." }, { status: 400 });
  }

  const participantContext = await resolveParticipantRequestContext({
    claimedParticipantId,
    claimedSessionId,
  });

  if (!participantContext.ok) {
    if (participantContext.status >= 401) {
      await logServerResponseError({
        route: "/api/play/participant",
        method: "GET",
        status: participantContext.status,
        error: participantContext.error,
        requestPath,
        participantId: claimedParticipantId || null,
        sessionId: claimedSessionId || null,
      });
    }

    return NextResponse.json({ error: participantContext.error }, { status: participantContext.status });
  }

  const { adminSupabase, participantId, sessionId } = participantContext.data;
  const { data, error } = await fetchParticipantSnapshot(sessionId, participantId, adminSupabase);

  if (error) {
    console.error("Kunne ikke hente deltager-snapshot:", error);
    await logServerResponseError({
      route: "/api/play/participant",
      method: "GET",
      status: 500,
      error,
      requestPath,
      participantId,
      sessionId,
    });
    return NextResponse.json({ error: "Kunne ikke hente deltageren." }, { status: 500 });
  }

  if (!data) {
    await logServerResponseError({
      route: "/api/play/participant",
      method: "GET",
      status: 404,
      error: "Deltageren findes ikke længere.",
      requestPath,
      participantId,
      sessionId,
    });
    return NextResponse.json({ error: "Deltageren findes ikke længere." }, { status: 404 });
  }

  const { data: session } = await adminSupabase
    .from("live_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle<{ status?: string | null }>();
  const exposeLocation = shouldExposeStudentLocation({
    sessionStatus: session?.status,
    finishedAt: data.finished_at,
    lastUpdated: data.last_updated,
  });
  const participant = exposeLocation
    ? data
    : { ...data, lat: null, lng: null, accuracy: null };

  return NextResponse.json(
    {
      participant,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
