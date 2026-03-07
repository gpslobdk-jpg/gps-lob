import { NextRequest, NextResponse } from "next/server";

import {
  getRunScheduleGate,
  inspectRunSchedule,
  type RunRecord,
  type RunSchedule,
  type RunScheduleGate,
} from "@/utils/runSchedule";

export const runtime = "edge";
export const revalidate = 5;

const CACHE_CONTROL = "public, s-maxage=5, stale-while-revalidate=25";

type LiveSessionRow = {
  id?: string | number | null;
  status?: string | null;
  run_id?: string | null;
};

type JoinApiResponse =
  | {
      kind: "invalid";
    }
  | {
      kind: "finished";
      runTitle: string;
      schedule: RunSchedule | null;
      scheduleGate: RunScheduleGate;
    }
  | {
      kind: "active";
      sessionId: string;
      sessionStatus: string | null;
      runTitle: string;
      schedule: RunSchedule | null;
      scheduleGate: RunScheduleGate;
    };

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error("Supabase er ikke konfigureret.");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

async function fetchSupabaseRows<T>(path: string) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 5 },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Supabase-opslag fejlede.");
  }

  return (await response.json()) as T[];
}

async function fetchRun(runId: string) {
  const rows = await fetchSupabaseRows<RunRecord & { title?: unknown }>(
    `gps_runs?id=eq.${encodeURIComponent(runId)}&select=*`
  );
  return (rows[0] ?? null) as (RunRecord & { title?: unknown }) | null;
}

function respond(data: JoinApiResponse, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": CACHE_CONTROL,
    },
  });
}

export async function GET(request: NextRequest) {
  const rawPin = request.nextUrl.searchParams.get("pin") ?? "";
  const pin = rawPin.replace(/\D/g, "").slice(0, 6);

  if (!pin) {
    return NextResponse.json(
      { error: "Pinkode mangler." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const activeRows = await fetchSupabaseRows<LiveSessionRow>(
      `live_sessions?select=id,status,run_id&pin=eq.${encodeURIComponent(pin)}&status=in.(waiting,running)&order=created_at.desc&limit=1`
    );
    const activeSession = activeRows[0] ?? null;

    if (activeSession?.id && activeSession.run_id) {
      const run = await fetchRun(String(activeSession.run_id));
      const scheduleResult = run ? inspectRunSchedule(run) : null;

      return respond({
        kind: "active",
        sessionId: String(activeSession.id),
        sessionStatus: typeof activeSession.status === "string" ? activeSession.status : null,
        runTitle: typeof run?.title === "string" ? run.title : "",
        schedule: scheduleResult?.schedule ?? null,
        scheduleGate: getRunScheduleGate(scheduleResult),
      });
    }

    const finishedRows = await fetchSupabaseRows<LiveSessionRow>(
      `live_sessions?select=run_id&pin=eq.${encodeURIComponent(pin)}&status=eq.finished&order=created_at.desc&limit=1`
    );
    const finishedSession = finishedRows[0] ?? null;

    if (finishedSession?.run_id) {
      const run = await fetchRun(String(finishedSession.run_id));
      const scheduleResult = run ? inspectRunSchedule(run) : null;

      return respond({
        kind: "finished",
        runTitle: typeof run?.title === "string" ? run.title : "",
        schedule: scheduleResult?.schedule ?? null,
        scheduleGate: getRunScheduleGate(scheduleResult),
      });
    }

    return respond({ kind: "invalid" }, 404);
  } catch (error) {
    console.error("Kunne ikke hente join-data:", error);
    return NextResponse.json(
      { error: "Kunne ikke hente sessionen." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
