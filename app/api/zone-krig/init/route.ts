import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import {
  initializeZoneKrigZones,
  isZoneKrigRaceType,
} from "@/app/api/zone-krig/_shared";

export const runtime = "edge";

type InitZoneKrigPayload = {
  sessionId?: unknown;
};

type LiveSessionRow = {
  id?: string | null;
  run_id?: string | null;
  status?: string | null;
};

type RunRow = {
  race_type?: unknown;
  raceType?: unknown;
  questions?: unknown;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let payload: InitZoneKrigPayload;

  try {
    payload = (await request.json()) as InitZoneKrigPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const sessionId = asTrimmedString(payload.sessionId);
  if (!sessionId) {
    return NextResponse.json({ error: "Session-id mangler." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  try {
    const { data: session, error: sessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,run_id,status")
      .eq("id", sessionId)
      .in("status", ["waiting", "running"])
      .maybeSingle<LiveSessionRow>();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session?.id || !session.run_id) {
      return NextResponse.json({ error: "Sessionen blev ikke fundet." }, { status: 404 });
    }

    const { data: run, error: runError } = await adminSupabase
      .from("gps_runs")
      .select("questions,race_type,raceType")
      .eq("id", session.run_id)
      .maybeSingle<RunRow>();

    if (runError) {
      throw new Error(runError.message);
    }

    if (!isZoneKrigRaceType(run?.race_type ?? run?.raceType)) {
      return NextResponse.json({ initialized: false, zoneCount: 0 });
    }

    const result = await initializeZoneKrigZones(sessionId, run ?? null, adminSupabase);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Kunne ikke initialisere Zone Krig-zoner:", error);
    return NextResponse.json(
      { error: "Kunne ikke initialisere Zone Krig-zoner." },
      { status: 500 }
    );
  }
}