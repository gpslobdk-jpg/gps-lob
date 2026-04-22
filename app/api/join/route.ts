import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { createParticipantClient as createParticipantServerClient } from "@/utils/supabase/participantServer";
import {
  getRunScheduleGate,
  inspectRunSchedule,
  type RunRecord,
  type RunSchedule,
  type RunScheduleGate,
} from "@/utils/runSchedule";
import {
  initializeZoneKrigZones,
  isZoneKrigRaceType,
} from "@/app/api/zone-krig/_shared";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { sendDiscordWebhook } from "@/lib/discord";

export const runtime = "edge";
const CACHE_CONTROL = "no-store";
const MAX_STUDENT_NAME_LENGTH = 20;

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;
type ParticipantServerClient = Awaited<ReturnType<typeof createParticipantServerClient>>;

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
  zone_krig_team_id?: string | null;
};

type JoinParticipantRequest = {
  sessionId?: unknown;
  studentName?: unknown;
  participantId?: unknown;
};

type JoinParticipantResponse = {
  participantId: string;
  sessionId: string;
  studentName: string;
  startOffset: number;
  sessionStatus: string | null;
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
};

type ParticipantOffsetRow = {
  start_offset?: number | string | null;
};

type GameTeamRow = {
  id?: string | null;
  session_id?: string | null;
  team_name?: string | null;
  color?: string | null;
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
      raceType: string | null;
    };

const ZONE_KRIG_DEFAULT_TEAMS = [
  { teamName: "Rød", color: "#ef4444" },
  { teamName: "Blå", color: "#3b82f6" },
  { teamName: "Grøn", color: "#22c55e" },
  { teamName: "Gul", color: "#eab308" },
] as const;

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
    case "matematik":
    case "math":
    case "dansk":
    case "danish":
    case "engelsk":
    case "english":
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

  let { data, error } = await runQuery("id,session_id,student_name,start_offset,zone_krig_team_id");
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await runQuery("id,session_id,student_name,start_offset"));
  }

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
  authUserId: string,
  adminSupabase: AdminSupabaseClient
) {
  const normalizedStudentName = studentName.trim();
  const timestamp = new Date().toISOString();
  const payloads = [
    {
      id: participantId,
      session_id: sessionId,
      student_name: normalizedStudentName,
      auth_user_id: authUserId,
      last_updated: timestamp,
      start_offset: startOffset,
    },
    {
      id: participantId,
      session_id: sessionId,
      student_name: normalizedStudentName,
      auth_user_id: authUserId,
      start_offset: startOffset,
    },
    {
      id: participantId,
      session_id: sessionId,
      student_name: normalizedStudentName,
      auth_user_id: authUserId,
      last_updated: timestamp,
    },
    { id: participantId, session_id: sessionId, student_name: normalizedStudentName, auth_user_id: authUserId },
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
    const { error } = await adminSupabase.from("participants").insert(payload);

    if (!error) {
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
        status: 201,
        data: [insertedParticipant],
      } satisfies SupabaseResult<ParticipantRow[]>;
    }

    if (error.code === "23505") {
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

    if (isMissingColumnError(error)) {
      continue;
    }

    return {
      ok: false,
      status: 500,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? undefined,
      },
    } satisfies SupabaseResult<ParticipantRow[]>;
  }

  return {
    ok: false,
    status: 400,
    error: { code: "PGRST204", message: "Participants-tabellen mangler et nødvendigt felt." },
  } satisfies SupabaseResult<ParticipantRow[]>;
}

async function bindParticipantAuthUser(
  sessionId: string,
  participantId: string,
  authUserId: string,
  adminSupabase: AdminSupabaseClient
) {
  const timestamp = new Date().toISOString();
  const payloads = [
    { auth_user_id: authUserId, last_updated: timestamp },
    { auth_user_id: authUserId },
    { last_updated: timestamp },
  ];

  for (const payload of payloads) {
    const { error } = await adminSupabase
      .from("participants")
      .update(payload)
      .eq("id", participantId)
      .eq("session_id", sessionId);

    if (!error) {
      return await fetchParticipantRecord(sessionId, adminSupabase, { participantId });
    }

    if (isMissingColumnError(error)) {
      continue;
    }

    throw new Error(error.message);
  }

  return await fetchParticipantRecord(sessionId, adminSupabase, { participantId });
}

async function createParticipantAuthSession() {
  const participantSupabase = await createParticipantServerClient();
  const { data, error } = await participantSupabase.auth.signInAnonymously();

  if (error) {
    return {
      ok: false as const,
      client: participantSupabase,
      error,
    };
  }

  const authUserId = asTrimmedString(data.user?.id);
  if (!authUserId) {
    return {
      ok: false as const,
      client: participantSupabase,
      error: { message: "Deltager-login mangler bruger-id." },
    };
  }

  return {
    ok: true as const,
    client: participantSupabase,
    authUserId,
  };
}

async function clearParticipantAuthSession(participantSupabase: ParticipantServerClient | null) {
  if (!participantSupabase) {
    return;
  }

  try {
    await participantSupabase.auth.signOut();
  } catch (error) {
    console.warn("Kunne ikke rydde deltager-session efter join-fejl:", error);
  }
}

async function ensureSessionStudent(
  sessionId: string,
  studentName: string,
  adminSupabase: AdminSupabaseClient
) {
  const normalizedStudentName = studentName.trim();
  const timestamp = new Date().toISOString();
  const payloads = [
    { session_id: sessionId, student_name: normalizedStudentName, last_updated: timestamp },
    { session_id: sessionId, student_name: normalizedStudentName },
  ];

  for (const payload of payloads) {
    const { error } = await adminSupabase.from("session_students").insert(payload);

    if (!error || error.code === "23505") {
      return true;
    }

    if (isMissingColumnError(error)) {
      continue;
    }

    console.warn("Kunne ikke oprette session_students-række:", error);
    return false;
  }

  return false;
}

async function ensureGameTeam(
  sessionId: string,
  teamName: string,
  color: string,
  adminSupabase: AdminSupabaseClient
): Promise<string | null> {
  try {
    // Find existing team by session + color
    const { data: existing } = await adminSupabase
      .from("game_teams")
      .select("id")
      .eq("session_id", sessionId)
      .eq("color", color)
      .limit(1);

    if (existing && existing.length > 0 && existing[0]) {
      return String((existing[0] as { id?: unknown }).id ?? "");
    }

    // Insert new team
    const { data: inserted } = await adminSupabase
      .from("game_teams")
      .insert({ session_id: sessionId, team_name: teamName, color })
      .select("id")
      .limit(1);

    if (inserted && inserted.length > 0 && inserted[0]) {
      return String((inserted[0] as { id?: unknown }).id ?? "");
    }

    return null;
  } catch {
    return null;
  }
}

async function ensureZoneKrigAutoBalanceTeams(
  sessionId: string,
  adminSupabase: AdminSupabaseClient
) {
  const teams: Array<{ id: string; teamName: string; color: string }> = [];

  for (const defaultTeam of ZONE_KRIG_DEFAULT_TEAMS) {
    const teamId = await ensureGameTeam(
      sessionId,
      defaultTeam.teamName,
      defaultTeam.color,
      adminSupabase
    );

    if (!teamId) {
      continue;
    }

    teams.push({
      id: teamId,
      teamName: defaultTeam.teamName,
      color: defaultTeam.color,
    });
  }

  if (teams.length > 0) {
    return teams;
  }

  const { data, error } = await adminSupabase
    .from("game_teams")
    .select("id,team_name,color")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as GameTeamRow[])
    .map((row) => {
      const id = asTrimmedString(row.id);
      const teamName = asTrimmedString(row.team_name);
      const color = asTrimmedString(row.color);

      if (!id || !teamName || !color) {
        return null;
      }

      return {
        id,
        teamName,
        color,
      };
    })
    .filter((row): row is { id: string; teamName: string; color: string } => row !== null);
}

async function pickLeastPopulatedZoneKrigTeam(
  sessionId: string,
  participantId: string,
  teams: Array<{ id: string; teamName: string; color: string }>,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("participants")
    .select("id,zone_krig_team_id")
    .eq("session_id", sessionId);

  if (error) {
    if (isMissingColumnError(error)) {
      return teams[0] ?? null;
    }

    throw new Error(error.message);
  }

  const countsByTeamId = new Map<string, number>(teams.map((team) => [team.id, 0]));

  for (const row of (data ?? []) as ParticipantRow[]) {
    const rowParticipantId = asTrimmedString(row.id);
    const rowTeamId = asTrimmedString(row.zone_krig_team_id);

    if (!rowParticipantId || rowParticipantId === participantId || !rowTeamId) {
      continue;
    }

    if (!countsByTeamId.has(rowTeamId)) {
      continue;
    }

    countsByTeamId.set(rowTeamId, (countsByTeamId.get(rowTeamId) ?? 0) + 1);
  }

  return teams.reduce<{ id: string; teamName: string; color: string } | null>(
    (currentLeastPopulated, candidateTeam) => {
      if (!currentLeastPopulated) {
        return candidateTeam;
      }

      const currentCount = countsByTeamId.get(currentLeastPopulated.id) ?? 0;
      const candidateCount = countsByTeamId.get(candidateTeam.id) ?? 0;
      return candidateCount < currentCount ? candidateTeam : currentLeastPopulated;
    },
    null
  );
}

async function assignParticipantToZoneKrigTeam(
  sessionId: string,
  participantId: string,
  teamId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { error } = await adminSupabase
    .from("participants")
    .update({ zone_krig_team_id: teamId })
    .eq("id", participantId)
    .eq("session_id", sessionId);

  if (error) {
    if (isMissingColumnError(error)) {
      return;
    }

    throw new Error(error.message);
  }
}

function respond(data: JoinApiResponse, status = 200) {  return NextResponse.json(data, {
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
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
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
        raceType: typeof run?.race_type === "string" ? run.race_type : null,
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
    await logHandledServerError({
      route: "/api/join",
      method: "GET",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Kunne ikke hente sessionen." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  let payload: JoinParticipantRequest;
  let participantAuthClient: ParticipantServerClient | null = null;
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    payload = (await request.json()) as JoinParticipantRequest;
  } catch {
    return NextResponse.json(
      { error: "Ugyldig forespørgsel." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const studentName = asTrimmedString(payload.studentName);
  const preferredParticipantId = asTrimmedString(payload.participantId);

  if (!sessionId || !studentName) {
    return NextResponse.json(
      { error: "Session eller navn mangler." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (studentName.length > MAX_STUDENT_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Navnet må højst være ${MAX_STUDENT_NAME_LENGTH} tegn langt.` },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const adminSupabase = getRequiredAdminClient();
    const activeSession = await fetchLiveSessionById(sessionId, ["waiting", "running"], adminSupabase);

    if (!activeSession?.id) {
      return NextResponse.json(
        { error: "Sessionen findes ikke længere." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const run = activeSession.run_id ? await fetchRun(String(activeSession.run_id), adminSupabase) : null;
    const isZoneKrig = isZoneKrigRaceType(run?.race_type ?? run?.raceType);

    if (isZoneKrig) {
      await initializeZoneKrigZones(sessionId, run, adminSupabase);
    }

    const questionCount = getQuestionCount(run);
    const staggerEnabled = supportsStaggeredStart(run?.race_type ?? run?.raceType);
    const plannedStartOffset = staggerEnabled
      ? pickLeastUsedStartOffset(
          await fetchSessionParticipantOffsets(sessionId, adminSupabase),
          questionCount
        )
      : 0;

    const participantAuthSession = await createParticipantAuthSession();
    participantAuthClient = participantAuthSession.client;

    if (!participantAuthSession.ok) {
      console.error("Kunne ikke oprette deltager-login:", participantAuthSession.error);
      await clearParticipantAuthSession(participantAuthClient);
      const authErrorStatus =
        "status" in participantAuthSession.error
          ? (participantAuthSession.error as { status?: unknown }).status
          : undefined;
      const isRateLimit = authErrorStatus === 429;
      return NextResponse.json(
        { error: "Kunne ikke oprette deltager-login." },
        { status: isRateLimit ? 429 : 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const existingParticipant = preferredParticipantId
      ? await fetchParticipantRecord(sessionId, adminSupabase, {
          participantId: preferredParticipantId,
        })
      : await fetchParticipantRecord(sessionId, adminSupabase, { studentName });

    if (preferredParticipantId && !existingParticipant) {
      await clearParticipantAuthSession(participantAuthClient);
      return NextResponse.json(
        {
          error:
            "Vi kunne ikke genfinde din tidligere deltager i dette spil. Åbn løbet fra samme enhed eller kontakt læreren.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const existingParticipantId = asTrimmedString(existingParticipant?.id);

    let participantResult: SupabaseResult<ParticipantRow[]>;
    if (existingParticipantId) {
      const reboundParticipant = await bindParticipantAuthUser(
        sessionId,
        existingParticipantId,
        participantAuthSession.authUserId,
        adminSupabase
      );

      participantResult = reboundParticipant
        ? {
            ok: true,
            status: 200,
            data: [reboundParticipant],
          }
        : {
            ok: false,
            status: 404,
            error: {
              code: "PGRST116",
              message: "Den eksisterende deltager kunne ikke genindlæses.",
            },
          };
    } else {
      participantResult = await insertParticipant(
        sessionId,
        studentName,
        crypto.randomUUID(),
        plannedStartOffset,
        participantAuthSession.authUserId,
        adminSupabase
      );
    }

    if (!participantResult.ok) {
      console.error("Kunne ikke oprette deltager ved join:", participantResult.error);
      await clearParticipantAuthSession(participantAuthClient);
      return NextResponse.json(
        { error: "Kunne ikke oprette deltageren." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const participantRow = Array.isArray(participantResult.data) ? participantResult.data[0] : null;
    const participantId = asTrimmedString(participantRow?.id);

    if (!participantId) {
      throw new Error("Deltager-id mangler i svar.");
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

    void ensureSessionStudent(sessionId, normalizedStudentName, adminSupabase);

    // Zone-Krig: auto-balance player onto the least populated team
    let teamId: string | null = null;
    let assignedZoneKrigTeam: { id: string; teamName: string; color: string } | null = null;
    if (isZoneKrig) {
      const autoBalanceTeams = await ensureZoneKrigAutoBalanceTeams(sessionId, adminSupabase); /* legacy manual color selection removed
        "#ef4444": "Rød",
        "#3b82f6": "Blå",
        "#22c55e": "Grøn",
        "#eab308": "Gul",
      };
      */ const existingTeamId = asTrimmedString(resolvedParticipantRow?.zone_krig_team_id);

      if (existingTeamId) {
        assignedZoneKrigTeam = autoBalanceTeams.find((team) => team.id === existingTeamId) ?? null;
        teamId = assignedZoneKrigTeam?.id ?? null;
      }

      if (!teamId) {
        assignedZoneKrigTeam = await pickLeastPopulatedZoneKrigTeam(
          sessionId,
          participantId,
          autoBalanceTeams,
          adminSupabase
        );

        teamId = assignedZoneKrigTeam?.id ?? null;

        if (teamId) {
          await assignParticipantToZoneKrigTeam(sessionId, participantId, teamId, adminSupabase);
        }
      }
    }

    return NextResponse.json<JoinParticipantResponse>(
      {
        participantId,
        sessionId,
        studentName: normalizedStudentName,
        startOffset,
        sessionStatus: typeof activeSession.status === "string" ? activeSession.status : null,
        teamId,
        teamName: assignedZoneKrigTeam?.teamName ?? null,
        teamColor: assignedZoneKrigTeam?.color ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
    // Notify Discord in a best-effort, non-blocking way
    try {
      void sendDiscordWebhook(`🚀 Nyt hold er netop trådt ind i skoven: ${normalizedStudentName}!`);
    } catch (e) {
      // The helper already swallows errors; this is just extra safety
      console.error("Discord notification failed:", e);
    }
  } catch (error) {
    await clearParticipantAuthSession(participantAuthClient);

    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json(
        { error: ADMIN_ACCESS_MISSING_MESSAGE },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.error("Kunne ikke registrere deltageren:", error);
    await logHandledServerError({
      route: "/api/join",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      sessionId,
      participantId: preferredParticipantId || null,
    });
    return NextResponse.json(
      { error: "Kunne ikke registrere deltageren." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
