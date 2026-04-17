import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const runtime = "edge";

type ProvisionPayload = {
  sessionId?: unknown;
};

type LiveSessionRow = {
  id?: string | null;
  run_id?: string | null;
  status?: string | null;
  teacher_id?: string | null;
};

type RunRow = {
  race_type?: unknown;
  raceType?: unknown;
};

type ParticipantRow = {
  id?: string | null;
  student_name?: string | null;
  session_id?: string | null;
};

type RoleKey =
  | "flag"
  | "spy"
  | "bomb"
  | "miner"
  | "scout"
  | "sergeant"
  | "lieutenant"
  | "captain"
  | "major"
  | "colonel"
  | "general"
  | "marshal";

type TeamCode = "red" | "blue";

type StrategoPlayerInsertRow = {
  session_id: string;
  participant_id: string;
  team_code: TeamCode;
  rank_key: RoleKey;
  state: "alive";
  eliminated_by_participant_id: null;
  last_duel_at: null;
  updated_at: string;
};

const MIN_PARTICIPANTS = 2;
const MAX_TEAM_SIZE = 30;

// Prioritet: altid flag + spy, derefter mobile/taktiske roller først,
// og først senere flere tunge officerer eller gentagelser af stærke kort.
const ROLE_PRIORITY_SEQUENCE: RoleKey[] = [
  "flag",
  "spy",
  "bomb",
  "miner",
  "scout",
  "sergeant",
  "lieutenant",
  "captain",
  "major",
  "colonel",
  "general",
  "marshal",
  "bomb",
  "miner",
  "scout",
  "sergeant",
  "lieutenant",
  "captain",
  "major",
  "scout",
  "bomb",
  "miner",
  "captain",
  "lieutenant",
  "scout",
  "major",
  "bomb",
  "sergeant",
  "colonel",
  "general",
];

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRandomIndex(maxExclusive: number) {
  if (maxExclusive <= 1) return 0;
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  return Number(randomBuffer[0] ?? 0) % maxExclusive;
}

function shuffleArray<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomIndex(index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function buildRolePool(teamSize: number) {
  if (teamSize < 1) {
    throw new Error("Hvert hold skal have mindst 1 spiller.");
  }

  if (teamSize > ROLE_PRIORITY_SEQUENCE.length) {
    throw new Error(`Hvert hold kan højst have ${ROLE_PRIORITY_SEQUENCE.length} spillere.`);
  }

  return shuffleArray(ROLE_PRIORITY_SEQUENCE.slice(0, teamSize));
}

function createAssignments(
  participants: ParticipantRow[],
  teamCode: TeamCode,
  sessionId: string,
  timestamp: string
) {
  const roles = buildRolePool(participants.length);

  return participants.map<StrategoPlayerInsertRow>((participant, index) => ({
    session_id: sessionId,
    participant_id: asTrimmedString(participant.id),
    team_code: teamCode,
    rank_key: roles[index] ?? "scout",
    state: "alive",
    eliminated_by_participant_id: null,
    last_duel_at: null,
    updated_at: timestamp,
  }));
}

export async function POST(request: NextRequest) {
  let payload: ProvisionPayload;
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    payload = (await request.json()) as ProvisionPayload;
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
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    const { data: session, error: sessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,run_id,status,teacher_id")
      .eq("id", sessionId)
      .maybeSingle<LiveSessionRow>();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session?.id || !session.run_id) {
      return NextResponse.json({ error: "Sessionen blev ikke fundet." }, { status: 404 });
    }

    if (session.teacher_id !== authData.user.id) {
      return NextResponse.json({ error: "Du har ikke adgang til denne session." }, { status: 403 });
    }

    if ((session.status ?? "waiting") !== "waiting") {
      return NextResponse.json(
        { error: "Stratego-hold kan kun klargøres, mens sessionen står i lobby." },
        { status: 409 }
      );
    }

    const { data: run, error: runError } = await adminSupabase
      .from("gps_runs")
      .select("race_type,raceType:race_type")
      .eq("id", session.run_id)
      .maybeSingle<RunRow>();

    if (runError) {
      throw new Error(runError.message);
    }

    if (normalizeRaceType(run?.race_type ?? run?.raceType) !== RACE_TYPES.STRATEGO) {
      return NextResponse.json({ error: "Denne session er ikke et Stratego-løb." }, { status: 400 });
    }

    const { data: participantsData, error: participantsError } = await adminSupabase
      .from("participants")
      .select("id,student_name,session_id")
      .eq("session_id", sessionId);

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    const participants = ((participantsData ?? []) as ParticipantRow[]).filter(
      (participant): participant is ParticipantRow =>
        asTrimmedString(participant.id).length > 0 && asTrimmedString(participant.session_id).length > 0
    );

    if (participants.length < MIN_PARTICIPANTS) {
      return NextResponse.json(
        { error: "Der skal være mindst 2 deltagere, før Live Stratego kan starte." },
        { status: 400 }
      );
    }

    const largestTeamSize = Math.ceil(participants.length / 2);
    if (largestTeamSize > MAX_TEAM_SIZE) {
      return NextResponse.json(
        { error: `Live Stratego understøtter højst ${MAX_TEAM_SIZE} spillere pr. hold.` },
        { status: 400 }
      );
    }

    const shuffledParticipants = shuffleArray(participants);
    const redTeamSize = Math.ceil(shuffledParticipants.length / 2);
    const redTeam = shuffledParticipants.slice(0, redTeamSize);
    const blueTeam = shuffledParticipants.slice(redTeamSize);

    if (redTeam.length < 1 || blueTeam.length < 1) {
      return NextResponse.json(
        { error: "Begge hold skal have mindst 1 spiller. Tilføj flere deltagere." },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const assignments = [
      ...createAssignments(redTeam, "red", sessionId, timestamp),
      ...createAssignments(blueTeam, "blue", sessionId, timestamp),
    ];

    const { error: deleteError } = await adminSupabase
      .from("stratego_players")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const { error: insertError } = await adminSupabase
      .from("stratego_players")
      .insert(assignments);

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      ok: true,
      sessionId,
      totalParticipants: participants.length,
      teamSizes: {
        red: redTeam.length,
        blue: blueTeam.length,
      },
    });
  } catch (error) {
    console.error("Kunne ikke provisionere Stratego-spillere:", error);
    await logHandledServerError({
      route: "/api/stratego/provision",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      sessionId,
    });
    return NextResponse.json(
      { error: "Kunne ikke klargøre hold og roller til Live Stratego." },
      { status: 500 }
    );
  }
}
