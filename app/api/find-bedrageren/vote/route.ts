import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type VotePayload = {
  sessionId?: unknown;
  participantId?: unknown;
  suspectParticipantId?: unknown;
};

type FindBedragerenSessionRow = {
  live_session_id: string;
  phase: string;
};

type FindBedragerenPlayerRow = {
  participant_id: string;
  live_session_id: string;
  student_name: string | null;
};

type FindBedragerenVoteRow = {
  id: string;
};

type SupabaseErrorLike = {
  message?: unknown;
};

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
    return new Error(message || "Find Bedrageren-stemmen kunne ikke gemmes.");
  }

  return new Error("Find Bedrageren-stemmen kunne ikke gemmes.");
}

export async function POST(request: NextRequest) {
  const requestPath = new URL(request.url).pathname;
  let payload: VotePayload;

  try {
    payload = (await request.json()) as VotePayload;
  } catch {
    return respond({ error: "Ugyldig forespørgsel." }, 400);
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const participantId = asTrimmedString(payload.participantId);
  const suspectParticipantId = asTrimmedString(payload.suspectParticipantId);

  if (!sessionId || !participantId || !suspectParticipantId) {
    return respond({ error: "Stemmen mangler oplysninger." }, 400);
  }

  if (participantId === suspectParticipantId) {
    return respond({ error: "Du kan ikke stemme på dig selv." }, 400);
  }

  const cookieParticipantId = asTrimmedString(request.cookies.get(participantStorageKey(sessionId))?.value);
  if (cookieParticipantId !== participantId) {
    return respond({ error: "Deltageren kunne ikke bekræftes." }, 401);
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: ADMIN_ACCESS_MISSING_MESSAGE }, 503);
  }

  try {
    const { data: findSession, error: findSessionError } = await adminSupabase
      .from("find_bedrageren_sessions")
      .select("live_session_id,phase")
      .eq("live_session_id", sessionId)
      .maybeSingle<FindBedragerenSessionRow>();

    if (findSessionError) {
      throw new Error(findSessionError.message);
    }

    if (!findSession) {
      return respond({ error: "Sessionen er ikke et Find Bedrageren-spil." }, 404);
    }

    if (findSession.phase !== "voting") {
      return respond({ error: "Afstemningen er ikke startet endnu." }, 409);
    }

    const { data: playersData, error: playersError } = await adminSupabase
      .from("find_bedrageren_players")
      .select("participant_id,live_session_id,student_name")
      .eq("live_session_id", sessionId)
      .in("participant_id", [participantId, suspectParticipantId]);

    if (playersError) {
      throw new Error(playersError.message);
    }

    const players = (playersData ?? []) as FindBedragerenPlayerRow[];
    const voter = players.find((player) => player.participant_id === participantId);
    const suspect = players.find((player) => player.participant_id === suspectParticipantId);

    if (!voter) {
      return respond({ error: "Du er ikke med i dette spil." }, 404);
    }

    if (!suspect) {
      return respond({ error: "Den valgte spiller er ikke med i dette spil." }, 404);
    }

    const { data: existingVote, error: existingVoteError } = await adminSupabase
      .from("find_bedrageren_votes")
      .select("id")
      .eq("live_session_id", sessionId)
      .eq("voter_participant_id", participantId)
      .maybeSingle<FindBedragerenVoteRow>();

    if (existingVoteError) {
      throw new Error(existingVoteError.message);
    }

    const { error: voteError } = await adminSupabase
      .from("find_bedrageren_votes")
      .upsert(
        {
          live_session_id: sessionId,
          voter_participant_id: participantId,
          suspect_participant_id: suspectParticipantId,
        },
        { onConflict: "live_session_id,voter_participant_id" }
      );

    if (voteError) {
      throw new Error(voteError.message);
    }

    return respond({
      ok: true,
      status: existingVote ? "updated" : "created",
    });
  } catch (error) {
    console.error("Find Bedrageren-stemme fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/vote",
      method: "POST",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return respond({ error: "Kunne ikke gemme stemmen lige nu." }, 500);
  }
}
