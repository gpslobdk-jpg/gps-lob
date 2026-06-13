import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type RevealPayload = {
  sessionId?: unknown;
  participantId?: unknown;
  action?: unknown;
};

type FindBedragerenSessionStatusRow = {
  live_session_id: string;
  phase: string;
  roles_assigned_at: string | null;
};

type FindBedragerenSessionSecretRow = {
  secret_word_snapshot: string;
};

type FindBedragerenPlayerStatusRow = {
  participant_id: string;
  live_session_id: string;
  student_name: string | null;
  has_seen_role: boolean | null;
  created_at: string | null;
};

type FindBedragerenPlayerRevealRow = FindBedragerenPlayerStatusRow & {
  player_role: string | null;
};

type FindBedragerenSafePlayerRow = {
  participant_id: string;
  student_name: string | null;
};

type FindBedragerenResultPlayerRow = FindBedragerenSafePlayerRow & {
  player_role: string | null;
};

type FindBedragerenVoteResultRow = {
  suspect_participant_id: string | null;
};

type FindBedragerenResultSuspect = {
  participantId: string;
  studentName: string;
  voteCount: number;
  isImpostor?: boolean;
};

type FindBedragerenResult = {
  topSuspectParticipantId: string | null;
  topSuspectName: string | null;
  topSuspectIsImpostor: boolean | null;
  voteCount: number;
  totalVotes: number;
  tied: boolean;
  suspects: FindBedragerenResultSuspect[];
};

type SupabaseErrorLike = {
  message?: unknown;
};

const PARTICIPANT_STORAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const ROLE_VISIBLE_PHASES = new Set(["reveal", "discussion", "voting", "results"]);

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function participantStorageKey(sessionId: string) {
  return `find_bedrageren_participant_${sessionId}`;
}

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function toSafeLogError(error: unknown) {
  if (error instanceof Error) {
    return new Error(error.message);
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = asTrimmedString((error as SupabaseErrorLike).message);
    return new Error(message || "Find Bedrageren-status kunne ikke hentes.");
  }

  return new Error("Find Bedrageren-status kunne ikke hentes.");
}

function getRequestedParticipantId(request: NextRequest, sessionId: string, value: unknown) {
  return (
    asTrimmedString(value) ||
    asTrimmedString(request.cookies.get(participantStorageKey(sessionId))?.value)
  );
}

function isPlayerAssigned(
  player: Pick<FindBedragerenPlayerStatusRow, "created_at">,
  rolesAssignedAt: string | null
) {
  if (!rolesAssignedAt || !player.created_at) {
    return false;
  }

  const playerCreatedAt = new Date(player.created_at).getTime();
  const assignedAt = new Date(rolesAssignedAt).getTime();

  if (Number.isNaN(playerCreatedAt) || Number.isNaN(assignedAt)) {
    return false;
  }

  return playerCreatedAt <= assignedAt;
}

function withParticipantCookie(response: NextResponse, sessionId: string, participantId: string) {
  response.cookies.set({
    name: participantStorageKey(sessionId),
    value: participantId,
    path: "/",
    maxAge: PARTICIPANT_STORAGE_MAX_AGE_SECONDS,
    sameSite: "lax",
  });

  return response;
}

function buildResult(
  players: FindBedragerenResultPlayerRow[],
  votes: FindBedragerenVoteResultRow[]
): FindBedragerenResult {
  const voteCounts = new Map(players.map((player) => [player.participant_id, 0]));
  let totalVotes = 0;

  votes.forEach((vote) => {
    const suspectId = asTrimmedString(vote.suspect_participant_id);
    if (voteCounts.has(suspectId)) {
      voteCounts.set(suspectId, (voteCounts.get(suspectId) ?? 0) + 1);
      totalVotes += 1;
    }
  });

  const suspects = players.map((player) => ({
    participantId: player.participant_id,
    studentName: asTrimmedString(player.student_name) || "Elev",
    voteCount: voteCounts.get(player.participant_id) ?? 0,
    isImpostor: player.player_role === "impostor",
  }));

  if (totalVotes === 0 || suspects.length === 0) {
    return {
      topSuspectParticipantId: null,
      topSuspectName: null,
      topSuspectIsImpostor: null,
      voteCount: 0,
      totalVotes,
      tied: false,
      suspects,
    };
  }

  const topVoteCount = Math.max(...suspects.map((suspect) => suspect.voteCount));
  const topSuspects = suspects.filter((suspect) => suspect.voteCount === topVoteCount && topVoteCount > 0);
  const tied = topSuspects.length > 1;
  const topSuspect = tied ? null : topSuspects[0] ?? null;

  return {
    topSuspectParticipantId: topSuspect?.participantId ?? null,
    topSuspectName: topSuspect?.studentName ?? null,
    topSuspectIsImpostor: topSuspect ? topSuspect.isImpostor === true : null,
    voteCount: topVoteCount,
    totalVotes,
    tied,
    suspects,
  };
}

export async function GET(request: NextRequest) {
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const sessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
  const requestedParticipantId = asTrimmedString(request.nextUrl.searchParams.get("participantId"));
  const participantId = sessionId
    ? getRequestedParticipantId(request, sessionId, requestedParticipantId)
    : "";

  if (!sessionId || !participantId) {
    return respond({ error: "Deltageren kunne ikke findes." }, 400);
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: ADMIN_ACCESS_MISSING_MESSAGE }, 503);
  }

  try {
    const { data: findSession, error: findSessionError } = await adminSupabase
      .from("find_bedrageren_sessions")
      .select("live_session_id,phase,roles_assigned_at")
      .eq("live_session_id", sessionId)
      .maybeSingle<FindBedragerenSessionStatusRow>();

    if (findSessionError) {
      throw new Error(findSessionError.message);
    }

    if (!findSession) {
      return respond({ error: "Sessionen er ikke et Find Bedrageren-spil." }, 404);
    }

    const { data: liveSession, error: liveSessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,status")
      .eq("id", sessionId)
      .maybeSingle<{ id: string; status: string | null }>();

    if (liveSessionError) {
      throw new Error(liveSessionError.message);
    }

    if (!liveSession?.id) {
      return respond({ error: "Sessionen findes ikke længere." }, 404);
    }

    const { data: player, error: playerError } = await adminSupabase
      .from("find_bedrageren_players")
      .select("participant_id,live_session_id,student_name,has_seen_role,created_at")
      .eq("participant_id", participantId)
      .eq("live_session_id", sessionId)
      .maybeSingle<FindBedragerenPlayerStatusRow>();

    if (playerError) {
      throw new Error(playerError.message);
    }

    if (!player) {
      return respond({ error: "Du er ikke med i dette spil endnu." }, 404);
    }

    const { data: playersData, error: playersError } = await adminSupabase
      .from("find_bedrageren_players")
      .select("participant_id,student_name")
      .eq("live_session_id", sessionId)
      .order("created_at", { ascending: true });

    if (playersError) {
      throw new Error(playersError.message);
    }

    const players = ((playersData ?? []) as FindBedragerenSafePlayerRow[]).map((sessionPlayer) => ({
      participantId: sessionPlayer.participant_id,
      studentName: asTrimmedString(sessionPlayer.student_name) || "Elev",
    }));

    let result: FindBedragerenResult | null = null;

    if (findSession.phase === "results") {
      const { data: resultPlayersData, error: resultPlayersError } = await adminSupabase
        .from("find_bedrageren_players")
        .select("participant_id,student_name,player_role")
        .eq("live_session_id", sessionId)
        .order("created_at", { ascending: true });

      if (resultPlayersError) {
        throw new Error(resultPlayersError.message);
      }

      const { data: votesData, error: votesError } = await adminSupabase
        .from("find_bedrageren_votes")
        .select("suspect_participant_id")
        .eq("live_session_id", sessionId);

      if (votesError) {
        throw new Error(votesError.message);
      }

      result = buildResult(
        (resultPlayersData ?? []) as FindBedragerenResultPlayerRow[],
        (votesData ?? []) as FindBedragerenVoteResultRow[]
      );
    }

    const canRevealRole =
      ROLE_VISIBLE_PHASES.has(findSession.phase) &&
      isPlayerAssigned(player, findSession.roles_assigned_at);
    const response = respond({
      sessionId,
      participantId,
      studentName: asTrimmedString(player.student_name) || "Elev",
      phase: findSession.phase,
      sessionStatus: liveSession.status ?? null,
      canRevealRole,
      hasSeenRole: Boolean(player.has_seen_role),
      waitingForTeacher: findSession.phase !== "lobby" && !canRevealRole,
      players,
      result,
    });

    return withParticipantCookie(response, sessionId, participantId);
  } catch (error) {
    console.error("Find Bedrageren-status fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/session",
      method: "GET",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return respond({ error: "Kunne ikke hente spillet lige nu." }, 500);
  }
}

export async function POST(request: NextRequest) {
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  let payload: RevealPayload;

  try {
    payload = (await request.json()) as RevealPayload;
  } catch {
    return respond({ error: "Ugyldig forespørgsel." }, 400);
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const participantId = sessionId
    ? getRequestedParticipantId(request, sessionId, payload.participantId)
    : "";
  const action = asTrimmedString(payload.action);

  if (!sessionId || !participantId) {
    return respond({ error: "Deltageren kunne ikke findes." }, 400);
  }

  if (action !== "reveal") {
    return respond({ error: "Ugyldig handling." }, 400);
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: ADMIN_ACCESS_MISSING_MESSAGE }, 503);
  }

  try {
    const { data: findSession, error: findSessionError } = await adminSupabase
      .from("find_bedrageren_sessions")
      .select("live_session_id,phase,roles_assigned_at")
      .eq("live_session_id", sessionId)
      .maybeSingle<FindBedragerenSessionStatusRow>();

    if (findSessionError) {
      throw new Error(findSessionError.message);
    }

    if (!findSession) {
      return respond({ error: "Sessionen er ikke et Find Bedrageren-spil." }, 404);
    }

    if (!ROLE_VISIBLE_PHASES.has(findSession.phase)) {
      return respond({ error: "Læreren har ikke startet rollevisningen endnu." }, 409);
    }

    const { data: player, error: playerError } = await adminSupabase
      .from("find_bedrageren_players")
      .select("participant_id,live_session_id,student_name,player_role,has_seen_role,created_at")
      .eq("participant_id", participantId)
      .eq("live_session_id", sessionId)
      .maybeSingle<FindBedragerenPlayerRevealRow>();

    if (playerError) {
      throw new Error(playerError.message);
    }

    if (!player) {
      return respond({ error: "Du er ikke med i dette spil endnu." }, 404);
    }

    if (!isPlayerAssigned(player, findSession.roles_assigned_at)) {
      return respond({ error: "Din rolle er ikke klar endnu. Vent på læreren." }, 409);
    }

    const role = player.player_role === "impostor" ? "impostor" : "civilian";
    const roleSeenAt = new Date().toISOString();
    const { error: seenError } = await adminSupabase
      .from("find_bedrageren_players")
      .update({
        has_seen_role: true,
        role_seen_at: roleSeenAt,
      })
      .eq("participant_id", participantId)
      .eq("live_session_id", sessionId);

    if (seenError) {
      throw new Error(seenError.message);
    }

    const responseBody: {
      sessionId: string;
      participantId: string;
      studentName: string;
      phase: string;
      role: "civilian" | "impostor";
      hasSeenRole: boolean;
      secretWord?: string;
    } = {
      sessionId,
      participantId,
      studentName: asTrimmedString(player.student_name) || "Elev",
      phase: findSession.phase,
      role,
      hasSeenRole: true,
    };

    if (role === "civilian") {
      const { data: secretRow, error: secretError } = await adminSupabase
        .from("find_bedrageren_sessions")
        .select("secret_word_snapshot")
        .eq("live_session_id", sessionId)
        .maybeSingle<FindBedragerenSessionSecretRow>();

      if (secretError) {
        throw new Error(secretError.message);
      }

      if (!secretRow?.secret_word_snapshot) {
        return respond({ error: "Dit ord er ikke klar endnu. Prøv igen om lidt." }, 409);
      }

      responseBody.secretWord = secretRow.secret_word_snapshot;
    }

    const response = respond(responseBody);
    return withParticipantCookie(response, sessionId, participantId);
  } catch (error) {
    console.error("Find Bedrageren-rollevisning fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/session",
      method: "POST",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return respond({ error: "Kunne ikke vise rollen lige nu." }, 500);
  }
}
