import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import {
  getRunScheduleGate,
  inspectRunSchedule,
  type RunRecord,
  type RunSchedule,
  type RunScheduleGate,
} from "@/utils/runSchedule";

export const runtime = "edge";
const CACHE_CONTROL = "no-store";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type LiveSessionRow = {
  id?: string | number | null;
  status?: string | null;
  run_id?: string | null;
};

type ParticipantRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  start_offset?: number | string | null;
};

type JoinParticipantRequest = {
  sessionId?: unknown;
  studentName?: unknown;
};

type JoinParticipantResponse = {
  participantId: string;
  sessionId: string;
  studentName: string;
  startOffset: number;
};

type ParticipantOffsetRow = {
  start_offset?: number | string | null;
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

function normalizeStartOffset(value: unknown, questionCount: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || questionCount <= 1) {
    return 0;
  }

  return ((parsed % questionCount) + questionCount) % questionCount;
}

function normalizeStaggerRaceType(value: unknown) {
  if (typeof value !== "string") return "unknown";

  switch (value.trim().toLocaleLowerCase("da-DK")) {
    case "quiz":
    case "manuel":
    case "manual":
      return "quiz";
    case "foto":
    case "photo":
      return "photo";
    case "selfie":
      return "selfie";
    case "scanner":
    case "bogscanner":
    case "bookscanner":
    case "qrscanner":
      return "scanner";
    case "escape":
    case "escape_room":
    case "escaperoom":
      return "escape";
    case "rollespil":
    case "roleplay":
    case "role_play":
    case "tidsmaskinen":
      return "roleplay";
    default:
      return "unknown";
  }
}

function supportsStaggeredStart(value: unknown) {
  const normalizedRaceType = normalizeStaggerRaceType(value);
  return (
    normalizedRaceType === "quiz" ||
    normalizedRaceType === "photo" ||
    normalizedRaceType === "selfie" ||
    normalizedRaceType === "scanner"
  );
}

function getQuestionCount(run: (RunRecord & { questions?: unknown }) | null) {
  return Array.isArray(run?.questions) ? run.questions.length : 0;
}

function pickLeastUsedStartOffset(rows: ParticipantOffsetRow[] | null, questionCount: number) {
  if (!rows || questionCount <= 1) return 0;

  const usageByOffset = Array.from({ length: questionCount }, () => 0);
  for (const row of rows) {
    const normalizedOffset = normalizeStartOffset(row?.start_offset, questionCount);
    usageByOffset[normalizedOffset] += 1;
  }

  const minUsage = Math.min(...usageByOffset);
  return usageByOffset.findIndex((usage) => usage === minUsage);
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

async function fetchRun(runId: string, adminSupabase: AdminSupabaseClient) {
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

async function fetchLiveSessionByPin(
  pin: string,
  statuses: string[],
  adminSupabase: AdminSupabaseClient
) {
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

async function fetchLiveSessionById(
  sessionId: string,
  statuses: string[],
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("live_sessions")
    .select("id,status,run_id")
    .eq("id", sessionId)
    .in("status", statuses)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.[0] ?? null) as LiveSessionRow | null;
}

async function fetchParticipantRecord(
  sessionId: string,
  adminSupabase: AdminSupabaseClient,
  options: {
    participantId?: string;
    studentName?: string;
  }
) {
  const runQuery = async (selectClause: string) => {
    let query = adminSupabase.from("participants").select(selectClause).eq("session_id", sessionId);

    if (options.participantId) {
      query = query.eq("id", options.participantId);
    }

    if (options.studentName) {
      query = query.eq("student_name", options.studentName).order("created_at", { ascending: false });
    }

    return await query.limit(1);
  };

  let { data, error } = await runQuery("id,session_id,student_name,start_offset");
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await runQuery("id,session_id,student_name"));
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? [])[0] ?? null) as ParticipantRow | null;
}

async function fetchSessionParticipantOffsets(
  sessionId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("participants")
    .select("start_offset")
    .eq("session_id", sessionId);

  if (error) {
    if (isMissingColumnError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return (data ?? []) as ParticipantOffsetRow[];
}

async function persistParticipantStartOffset(
  sessionId: string,
  participantId: string,
  startOffset: number,
  adminSupabase: AdminSupabaseClient
) {
  const { error } = await adminSupabase
    .from("participants")
    .update({ start_offset: startOffset })
    .eq("id", participantId)
    .eq("session_id", sessionId);

  if (error) {
    if (isMissingColumnError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return await fetchParticipantRecord(sessionId, adminSupabase, { participantId });
}

async function insertParticipant(
  sessionId: string,
  studentName: string,
  participantId: string,
  startOffset: number,
  adminSupabase: AdminSupabaseClient
) {
  const normalizedStudentName = studentName.trim();
  const timestamp = new Date().toISOString();
  const headers = buildParticipantHeaders(participantId, sessionId);
  const payloads = [
    {
      id: participantId,
      session_id: sessionId,
      student_name: normalizedStudentName,
      last_updated: timestamp,
      start_offset: startOffset,
    },
    { id: participantId, session_id: sessionId, student_name: normalizedStudentName, start_offset: startOffset },
    { id: participantId, session_id: sessionId, student_name: normalizedStudentName, last_updated: timestamp },
    { id: participantId, session_id: sessionId, student_name: normalizedStudentName },
  ];

  for (const payload of payloads) {
    const result = await supabaseRequest<unknown>(
      "participants",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
      "return=minimal"
    );

    if (result.ok) {
      const insertedParticipant = await fetchParticipantRecord(sessionId, adminSupabase, { participantId });
      if (!insertedParticipant) {
        return {
          ok: false,
          status: 500,
          error: { code: "PGRST116", message: "Deltageren blev oprettet, men kunne ikke genindlæses." },
        } satisfies SupabaseResult<ParticipantRow[]>;
      }

      return {
        ok: true,
        status: result.status,
        data: [insertedParticipant],
      } satisfies SupabaseResult<ParticipantRow[]>;
    }

    if (result.error.code === "23505") {
      try {
        const existingParticipant = await fetchParticipantRecord(sessionId, adminSupabase, {
          studentName: normalizedStudentName,
        });
        if (!existingParticipant) {
          return {
            ok: false,
            status: 404,
            error: { code: "PGRST116", message: "Deltageren findes allerede, men kunne ikke genindlæses." },
          } satisfies SupabaseResult<ParticipantRow[]>;
        }

        return {
          ok: true,
          status: 200,
          data: [existingParticipant],
        } satisfies SupabaseResult<ParticipantRow[]>;
      } catch (error) {
        return {
          ok: false,
          status: 500,
          error: {
            code: "PGRST500",
            message: error instanceof Error ? error.message : "Kunne ikke genindlæse eksisterende deltager.",
          },
        } satisfies SupabaseResult<ParticipantRow[]>;
      }
    }

    if (isMissingColumnError(result.error)) {
      continue;
    }

    return {
      ok: false,
      status: result.status,
      error: result.error,
    } satisfies SupabaseResult<ParticipantRow[]>;
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

function getRequiredAdminClient() {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
  }

  return adminSupabase;
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
    const adminSupabase = getRequiredAdminClient();
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
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json(
        { error: ADMIN_ACCESS_MISSING_MESSAGE },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

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
    const adminSupabase = getRequiredAdminClient();
    const activeSession = await fetchLiveSessionById(sessionId, ["waiting", "running"], adminSupabase);

    if (!activeSession?.id) {
      return NextResponse.json(
        { error: "Sessionen findes ikke lÃ¦ngere." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const run = activeSession.run_id ? await fetchRun(String(activeSession.run_id), adminSupabase) : null;
    const questionCount = getQuestionCount(run);
    const staggerEnabled = supportsStaggeredStart(run?.race_type ?? run?.raceType);
    const plannedStartOffset = staggerEnabled
      ? pickLeastUsedStartOffset(
          await fetchSessionParticipantOffsets(sessionId, adminSupabase),
          questionCount
        )
      : 0;

    const participantResult = await insertParticipant(
      sessionId,
      studentName,
      crypto.randomUUID(),
      plannedStartOffset,
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

    if (!participantId) {
      return NextResponse.json(
        { error: "Deltager-id mangler i svar." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    let resolvedParticipantRow = participantRow;

    if (
      staggerEnabled &&
      questionCount > 1 &&
      (participantRow?.start_offset === null || participantRow?.start_offset === undefined)
    ) {
      try {
        const updatedParticipantRow = await persistParticipantStartOffset(
          sessionId,
          participantId,
          plannedStartOffset,
          adminSupabase
        );
        if (updatedParticipantRow) {
          resolvedParticipantRow = updatedParticipantRow;
        }
      } catch (error) {
        console.warn("Kunne ikke gemme start_offset for eksisterende deltager:", error);
      }
    }

    const normalizedStudentName =
      asTrimmedString(resolvedParticipantRow?.student_name) || studentName;
    const startOffset = staggerEnabled
      ? normalizeStartOffset(resolvedParticipantRow?.start_offset ?? plannedStartOffset, questionCount)
      : 0;

    void ensureSessionStudent(sessionId, normalizedStudentName);

    return NextResponse.json<JoinParticipantResponse>(
      {
        participantId,
        sessionId,
        studentName: normalizedStudentName,
        startOffset,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json(
        { error: ADMIN_ACCESS_MISSING_MESSAGE },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.error("Kunne ikke registrere deltageren:", error);
    return NextResponse.json(
      { error: "Kunne ikke registrere deltageren." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
