import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";

export const runtime = "edge";

function asTrimmedString(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const sessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));

  if (!sessionId) {
    return NextResponse.json({ error: "Session-id mangler." }, { status: 400 });
  }

  try {
    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
    }

    const { data, error } = await adminSupabase
      .from("live_sessions")
      .select("status,gps_override")
      .eq("id", sessionId)
      .maybeSingle<{ status?: string | null; gps_override?: boolean | null }>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ error: "Kunne ikke finde sessionen." }, { status: 404 });
    }

    return NextResponse.json(
      {
        sessionStatus: data.status ?? null,
        gpsOverride: Boolean(data.gps_override),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Kunne ikke hente play-status:", error);
    return NextResponse.json({ error: "Kunne ikke hente sessionstatus." }, { status: 500 });
  }
}