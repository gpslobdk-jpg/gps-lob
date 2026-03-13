import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import {
  getRunScheduleGate,
  inspectRunSchedule,
  type RunRecord,
  type RunSchedule,
  type RunScheduleGate,
} from "@/utils/runSchedule";

export const runtime = "edge";
const CACHE_CONTROL = "no-store";

type LiveSessionRow = {
  id?: string | number | null;
  status?: string | null;
  run_id?: string | null;
};

type ParticipantRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
};

type JoinParticipantRequest = {
  sessionId?: unknown;
  studentName?: unknown;
};

type JoinParticipantResponse = {
  participantId: string;
  sessionId: string;
  studentName: string;
};

type SupabaseRestError = {
  code?: string;
  message?: string;
  details?: string;
};

type SupabaseResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: SupabaseRestError; status: number };

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

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingColumnError(error: SupabaseRestError | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column/i.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

function buildParticipantHeaders(participantId: string, sessionId: string) {
  return {
    "x-participant-id": participantId,
    "x-session-id": sessionId,
  };
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit,
  prefer = "return=representation"
): Promise<SupabaseResult<T>> {
  const { url, anonKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${anonKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", prefer);

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as T | SupabaseRestError)
    : ({ message: await response.text() } satisfies SupabaseRestError);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body as SupabaseRestError,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: body as T,
  };
}

async function fetchSupabaseRows<T>(path: string) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Supabase-opslag fejlede.");
  }

  return (await response.json()) as T[];
}

async function fetchRun(
  runId: string,
  adminSupabase: ReturnType<typeof createAdminClient> | null = null
) {
  if (adminSupabase) {
    const { data, error } = await adminSupabase
      .from("gps_runs")
      .select("*")
      .eq("id", runId)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return (data?.[0] ?? null) as (RunRecord & { title?: unknown }) | null;
  }

  const rows = await fetchSupabaseRows<RunRecord & { title?: unknown }>(
    `gps_runs?id=eq.${encodeURIComponent(runId)}&select=*`
  );
  return (rows[0] ?? null) as (RunRecord & { title?: unknown }) | null;
}

async function fetchLiveSessionByPin(
  pin: string,
  statuses: string[],
  adminSupabase: ReturnType<typeof createAdminClient> | null = null
) {
  if (adminSupabase) {
    const { data, error } = await adminSupabase
      .from("live_sessions")
      .select("id,status,run_id")
      .eq("pin", pin)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return (data?.[0] ?? null) as LiveSessionRow | null;
  }

  const rows = await fetchSupabaseRows<LiveSessionRow>(
    `live_sessions?select=id,status,run_id&pin=eq.${encodeURIComponent(pin)}&status=in.(${statuses.join(",")})&order=created_at.desc&limit=1`
  );
  return rows[0] ?? null;
}

async function fetchLiveSessionById(
  sessionId: string,
  statuses: string[],
  adminSupabase: ReturnType<typeof createAdminClient> | null = null
) {
  if (adminSupabase) {
    const { data, error } = await adminSupabase
      .from("live_sessions")
      .select("id,status")
      .eq("id", sessionId)
      .in("status", statuses)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return (data?.[0] ?? null) as LiveSessionRow | null;
  }

  const rows = await fetchSupabaseRows<LiveSessionRow>(
    `live_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,status&status=in.(${statuses.join(",")})&limit=1`
  );
  return rows[0] ?? null;
}

async function insertParticipant(
  sessionId: string,
  studentName: string,
  participantId: string,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  const normalizedStudentName = studentName.trim();
  const timestamp = new Date().toISOString();
  const headers = buildParticipantHeaders(participantId, sessionId);
  const payloads = [
    { id: participantId, session_id: sessionId, student_name: normalizedStudentName, last_updated: timestamp },
    { id: participantId, session_id: sessionId, student_name: normalizedStudentName },
  ];

  for (const payload of payloads) {
    const result = await supabaseRequest<ParticipantRow[]>(
      "participants?select=id,session_id,student_name",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    if (result.ok) {
      return result;
    }

    if (result.error.code === "23505") {
      if (!adminSupabase) {
        return result;
      }

      const { data, error } = await adminSupabase
        .from("participants")
        .select("id,session_id,student_name")
        .eq("session_id", sessionId)
        .eq("student_name", normalizedStudentName)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        return {
          ok: false,
          status: 500,
          error: { code: error.code, message: error.message, details: error.details ?? undefined },
        } satisfies SupabaseResult<ParticipantRow[]>;
      }

      return {
        ok: true,
        status: 200,
        data: (data ?? []) as ParticipantRow[],
      } satisfies SupabaseResult<ParticipantRow[]>;
    }

    if (isMissingColumnError(result.error)) {
      continue;
    }

    return result;
  }

  return {
    ok: false,
    status: 400,
    error: { code: "PGRST204", message: "Participants-tabellen mangler et nÃ¸dvendigt felt." },
  } satisfies SupabaseResult<ParticipantRow[]>;
}

async function ensureSessionStudent(sessionId: string, studentName: string) {
  const normalizedStudentName = studentName.trim();
  const timestamp = new Date().toISOString();
  const payloads = [
    { session_id: sessionId, student_name: normalizedStudentName, last_updated: timestamp },
    { session_id: sessionId, student_name: normalizedStudentName },
  ];

  for (const payload of payloads) {
    const result = await supabaseRequest<unknown>(
      "session_students",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      "return=minimal"
    );

    if (result.ok || result.error.code === "23505") {
      return true;
    }

    if (isMissingColumnError(result.error)) {
      continue;
    }

    console.warn("Kunne ikke oprette session_students-rÃ¦kke:", result.error);
    return false;
  }

  return false;
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
    const adminSupabase = createAdminClient();
    const activeSession = await fetchLiveSessionByPin(pin, ["waiting", "running"], adminSupabase);

    if (activeSession?.id && activeSession.run_id) {
      const run = await fetchRun(String(activeSession.run_id), adminSupabase);
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

    const finishedSession = await fetchLiveSessionByPin(pin, ["finished"], adminSupabase);

    if (finishedSession?.run_id) {
      const run = await fetchRun(String(finishedSession.run_id), adminSupabase);
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

export async function POST(request: NextRequest) {
  let payload: JoinParticipantRequest;

  try {
    payload = (await request.json()) as JoinParticipantRequest;
  } catch {
    return NextResponse.json(
      { error: "Ugyldig forespÃ¸rgsel." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const studentName = asTrimmedString(payload.studentName);

  if (!sessionId || !studentName) {
    return NextResponse.json(
      { error: "Session eller navn mangler." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const adminSupabase = createAdminClient();
    const activeSession = await fetchLiveSessionById(sessionId, ["waiting", "running"], adminSupabase);

    if (!activeSession?.id) {
      return NextResponse.json(
        { error: "Sessionen findes ikke lÃ¦ngere." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const participantResult = await insertParticipant(
      sessionId,
      studentName,
      crypto.randomUUID(),
      adminSupabase
    );
    if (!participantResult.ok) {
      console.error("Kunne ikke oprette deltager ved join:", participantResult.error);
      return NextResponse.json(
        { error: "Kunne ikke oprette deltageren." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const participantRow = Array.isArray(participantResult.data) ? participantResult.data[0] : null;
    const participantId = asTrimmedString(participantRow?.id);
    const normalizedStudentName = asTrimmedString(participantRow?.student_name) || studentName;

    if (!participantId) {
      return NextResponse.json(
        { error: "Deltager-id mangler i svar." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    void ensureSessionStudent(sessionId, normalizedStudentName);

    return NextResponse.json<JoinParticipantResponse>(
      {
        participantId,
        sessionId,
        studentName: normalizedStudentName,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Kunne ikke registrere deltageren:", error);
    return NextResponse.json(
      { error: "Kunne ikke registrere deltageren." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
