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
import {
  isDistributedCircularEligibleRaceType,
  normalizeCircularStartOffset,
} from "@/lib/routes/postOrderPolicy";
import {
  isCompleteJoinCode,
  normalizeJoinCode,
} from "@/lib/join/studentJoin";
import { resolveParticipantJoinIdentity } from "@/lib/join/participantJoinIdentity";
import {
  PARTICIPANT_REMOVED_CODE,
  PARTICIPANT_REMOVED_MESSAGE,
} from "@/lib/live/participantRemoval";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const runtime = "edge";
const CACHE_CONTROL = "no-store";
const MAX_STUDENT_NAME_LENGTH = 20;

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;
type ParticipantServerClient = Awaited<ReturnType<typeof createParticipantServerClient>>;

type LiveSessionRow = {
  id?: string | number | null;
  status?: string | null;
  run_id?: string | null;
  post_order_mode?: unknown;
  route_version?: number | string | null;
};

type ParticipantRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  start_offset?: number | string | null;
  zone_krig_team_id?: string | null;
  auth_user_id?: string | null;
  removed_at?: string | null;
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
  startOffset: number | null;
  sessionStatus: string | null;
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
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

function toParticipantJoinIdentity(row: ParticipantRow | null) {
  const id = asTrimmedString(row?.id);
  const sessionId = asTrimmedString(row?.session_id);
  if (!id || !sessionId) return null;

  return {
    id,
    sessionId,
    authUserId: asTrimmedString(row?.auth_user_id) || null,
  };
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

  return normalizeCircularStartOffset(parsed, questionCount);
}

function getQuestionCount(run: (RunRecord & { questions?: unknown }) | null) {
  return Array.isArray(run?.questions) ? run.questions.length : 0;
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
    .select("id,status,run_id,post_order_mode,route_version")
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
    .select("id,status,run_id,post_order_mode,route_version")
    .eq("id", sessionId)
    .in("status", statuses)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.[0] ?? null) as LiveSessionRow | null;
}

async function fetchParticipantRecord(
  sessionId: string | null,
  adminSupabase: AdminSupabaseClient,
  options: {
    participantId?: string;
    studentName?: string;
    authUserId?: string;
    includeRemoved?: boolean;
  }
) {
  const runQuery = async (selectClause: string, excludesRemovedParticipants: boolean) => {
    let query = adminSupabase.from("participants").select(selectClause);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    if (excludesRemovedParticipants) {
      query = query.is("removed_at", null);
    }

    if (options.participantId) {
      query = query.eq("id", options.participantId);
    }

    if (options.studentName) {
      query = query.eq("student_name", options.studentName).order("created_at", { ascending: false });
    }

    if (options.authUserId) {
      query = query.eq("auth_user_id", options.authUserId);
    }

    return await query.limit(1);
  };

  const queryVariants = [
    "id,session_id,student_name,start_offset,zone_krig_team_id,auth_user_id,removed_at",
    "id,session_id,student_name,start_offset,auth_user_id,removed_at",
    "id,session_id,student_name,auth_user_id,removed_at",
    // Pre-phase-3 databases have no removed_at. This is deliberately the
    // final compatibility path, not a way to include a removed participant.
    "id,session_id,student_name,start_offset,zone_krig_team_id,auth_user_id",
    "id,session_id,student_name,start_offset,auth_user_id",
    "id,session_id,student_name,auth_user_id",
  ] as const;

  let data: ParticipantRow[] | null = null;
  let error: SupabaseRestError | null = null;

  for (const [index, selectClause] of queryVariants.entries()) {
    const excludesRemovedParticipants = !options.includeRemoved && index < 3;
    const result = await runQuery(selectClause, excludesRemovedParticipants);
    data = result.data as ParticipantRow[] | null;
    error = result.error as SupabaseRestError | null;
    if (!error) break;
    if (!isMissingColumnError(error)) {
      throw new Error(error.message);
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? [])[0] ?? null) as ParticipantRow | null;
}

async function assignParticipantStartOffset(
  sessionId: string,
  participantId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { error } = await adminSupabase.rpc("assign_live_participant_start_offset", {
    p_session_id: sessionId,
    p_participant_id: participantId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return await fetchParticipantRecord(sessionId, adminSupabase, { participantId });
}

async function insertParticipant(
  sessionId: string,
  studentName: string,
  participantId: string,
  initialStartOffset: number | null,
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
      start_offset: initialStartOffset,
    },
    {
      id: participantId,
      session_id: sessionId,
      student_name: normalizedStudentName,
      auth_user_id: authUserId,
      start_offset: initialStartOffset,
    },
    { id: participantId, session_id: sessionId, student_name: normalizedStudentName, auth_user_id: authUserId },
    {
      id: participantId,
      session_id: sessionId,
      student_name: normalizedStudentName,
      last_updated: timestamp,
      start_offset: initialStartOffset,
    },
    {
      id: participantId,
      session_id: sessionId,
      student_name: normalizedStudentName,
      start_offset: initialStartOffset,
    },
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
          participantId,
          includeRemoved: true,
        });
        if (
          existingParticipant?.removed_at &&
          asTrimmedString(existingParticipant.auth_user_id) === authUserId
        ) {
          return {
            ok: false,
            status: 410,
            error: {
              code: PARTICIPANT_REMOVED_CODE,
              message: PARTICIPANT_REMOVED_MESSAGE,
            },
          } satisfies SupabaseResult<ParticipantRow[]>;
        }
        if (!existingParticipant || asTrimmedString(existingParticipant.auth_user_id) !== authUserId) {
          return {
            ok: false,
            status: 409,
            error: {
              code: "PGRST116",
              message: "Tilmeldingsforsøget er allerede knyttet til en anden deltageridentitet.",
            },
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

type ExistingParticipantAuthSession = {
  client: ParticipantServerClient;
  authUserId: string | null;
};

async function readParticipantAuthSession(): Promise<ExistingParticipantAuthSession> {
  const client = await createParticipantServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  return {
    client,
    authUserId: error ? null : asTrimmedString(user?.id) || null,
  };
}

async function createParticipantAuthSession(
  participantSupabase: ParticipantServerClient
) {
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
    created: true as const,
  };
}

async function replaceParticipantAuthSession(participantSupabase: ParticipantServerClient) {
  const { error } = await participantSupabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }

  return await createParticipantAuthSession(participantSupabase);
}

async function clearCreatedParticipantAuthSession(
  participantSupabase: ParticipantServerClient | null,
  wasCreated: boolean
) {
  if (!participantSupabase || !wasCreated) {
    return;
  }

  try {
    await participantSupabase.auth.signOut();
  } catch {
    console.warn("Kunne ikke rydde deltager-session efter join-fejl.");
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

    console.warn("Kunne ikke oprette session_students-række.");
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
    .eq("session_id", sessionId)
    .is("removed_at", null);

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
    .eq("session_id", sessionId)
    .is("removed_at", null);

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
  const requestPath = request.nextUrl.pathname;
  const rawPin =
    request.headers.get("x-student-join-code") ??
    request.nextUrl.searchParams.get("pin") ??
    "";
  const pin = normalizeJoinCode(rawPin);

  if (!isCompleteJoinCode(rawPin)) {
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

    console.error("Kunne ikke hente join-data.");
    await logHandledServerError({
      route: "/api/join",
      method: "GET",
      status: 500,
      error: "join_session_lookup_failed",
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
  let didCreateParticipantAuthSession = false;
  const requestPath = request.nextUrl.pathname;

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
    // Tjek først om session findes uanset status
    const { data: sessionRow, error: sessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,status,run_id,post_order_mode,route_version")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!sessionRow) {
      return NextResponse.json(
        { error: "Sessionen findes ikke længere." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (sessionRow.status !== "waiting" && sessionRow.status !== "running") {
      return NextResponse.json(
        { error: "Sessionen er afsluttet eller ikke aktiv." },
        { status: 410, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Nu er vi sikre på at session findes og er aktiv
    const activeSession = sessionRow;

    const run = activeSession.run_id ? await fetchRun(String(activeSession.run_id), adminSupabase) : null;
    const isZoneKrig = isZoneKrigRaceType(run?.race_type ?? run?.raceType);

    if (isZoneKrig) {
      await initializeZoneKrigZones(sessionId, run, adminSupabase);
    }

    const questionCount = getQuestionCount(run);
    const usesAtomicPostAssignment =
      isDistributedCircularEligibleRaceType(run?.race_type ?? run?.raceType);

    const currentAuthSession = await readParticipantAuthSession();
    participantAuthClient = currentAuthSession.client;
    const currentAuthUserId = currentAuthSession.authUserId;
    const currentlyOwnedParticipant = currentAuthUserId
      ? await fetchParticipantRecord(null, adminSupabase, {
          authUserId: currentAuthUserId,
          includeRemoved: true,
        })
      : null;
    if (currentlyOwnedParticipant?.removed_at) {
      return NextResponse.json(
        {
          error: PARTICIPANT_REMOVED_MESSAGE,
          code: PARTICIPANT_REMOVED_CODE,
        },
        { status: 410, headers: { "Cache-Control": "no-store" } }
      );
    }
    const requestedParticipant = preferredParticipantId
      ? await fetchParticipantRecord(sessionId, adminSupabase, {
          participantId: preferredParticipantId,
        })
      : null;
    const identityResolution = resolveParticipantJoinIdentity({
      sessionId,
      requestedParticipantId: preferredParticipantId || null,
      currentAuthUserId: currentAuthUserId || null,
      currentlyOwnedParticipant: toParticipantJoinIdentity(currentlyOwnedParticipant),
      requestedParticipant: toParticipantJoinIdentity(requestedParticipant),
    });

    let participantRow: ParticipantRow | null = null;

    if (identityResolution.kind === "reject") {
      return NextResponse.json(
        { error: identityResolution.error },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (identityResolution.kind === "reuse") {
      // A browser-held participant id is not an authorization credential. The
      // policy above only returns a row already owned by this auth session.
      participantRow =
        toParticipantJoinIdentity(requestedParticipant)?.id === identityResolution.participantId
          ? requestedParticipant
          : currentlyOwnedParticipant;
    } else {
      let authUserId = currentAuthUserId;
      if (identityResolution.rotateParticipantAuth) {
        const rotatedSession = await replaceParticipantAuthSession(currentAuthSession.client);
        participantAuthClient = rotatedSession.client;

        if (!rotatedSession.ok) {
          const authErrorStatus =
            "status" in rotatedSession.error
              ? (rotatedSession.error as { status?: unknown }).status
              : undefined;
          const isRateLimit = authErrorStatus === 429;
          return NextResponse.json(
            { error: "Kunne ikke oprette deltager-login." },
            { status: isRateLimit ? 429 : 503, headers: { "Cache-Control": "no-store" } }
          );
        }

        didCreateParticipantAuthSession = true;
        authUserId = rotatedSession.authUserId;
      } else if (!currentAuthUserId) {
        const createdSession = await createParticipantAuthSession(currentAuthSession.client);
        participantAuthClient = createdSession.client;

        if (!createdSession.ok) {
          const authErrorStatus =
            "status" in createdSession.error
              ? (createdSession.error as { status?: unknown }).status
              : undefined;
          const isRateLimit = authErrorStatus === 429;
          return NextResponse.json(
            { error: "Kunne ikke oprette deltager-login." },
            { status: isRateLimit ? 429 : 503, headers: { "Cache-Control": "no-store" } }
          );
        }

        didCreateParticipantAuthSession = true;
        authUserId = createdSession.authUserId;
      }

      if (!authUserId) {
        throw new Error("Deltager-login mangler bruger-id.");
      }

      const participantResult = await insertParticipant(
        sessionId,
        studentName,
        preferredParticipantId || crypto.randomUUID(),
        usesAtomicPostAssignment ? null : 0,
        authUserId,
        adminSupabase
      );

      if (!participantResult.ok) {
        console.error("Kunne ikke oprette deltager ved join.");
        await clearCreatedParticipantAuthSession(
          participantAuthClient,
          didCreateParticipantAuthSession
        );
        didCreateParticipantAuthSession = false;
        return NextResponse.json(
          { error: participantResult.error.message || "Kunne ikke oprette deltageren." },
          {
            status: participantResult.status === 409 ? 409 : 500,
            headers: { "Cache-Control": "no-store" },
          }
        );
      }

      participantRow = Array.isArray(participantResult.data) ? participantResult.data[0] : null;
    }

    const participantId = asTrimmedString(participantRow?.id);

    if (!participantId) {
      throw new Error("Deltager-id mangler i svar.");
    }

    const resolvedParticipantRow = usesAtomicPostAssignment
      ? await assignParticipantStartOffset(sessionId, participantId, adminSupabase)
      : participantRow;

    const normalizedStudentName =
      asTrimmedString(resolvedParticipantRow?.student_name) || studentName;
    const storedStartOffset = resolvedParticipantRow?.start_offset;
    const startOffset = !usesAtomicPostAssignment
      ? 0
      : storedStartOffset === null || storedStartOffset === undefined
        ? null
        : normalizeStartOffset(storedStartOffset, questionCount);
    const refreshedActiveSession = await fetchLiveSessionById(
      sessionId,
      ["waiting", "running"],
      adminSupabase
    );

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
        sessionStatus:
          typeof refreshedActiveSession?.status === "string"
            ? refreshedActiveSession.status
            : typeof activeSession.status === "string"
              ? activeSession.status
              : null,
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
  } catch (error) {
    await clearCreatedParticipantAuthSession(
      participantAuthClient,
      didCreateParticipantAuthSession
    );

    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json(
        { error: ADMIN_ACCESS_MISSING_MESSAGE },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.error("Kunne ikke registrere deltageren.");
    await logHandledServerError({
      route: "/api/join",
      method: "POST",
      status: 500,
      error: "participant_creation_failed",
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Kunne ikke registrere deltageren." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
