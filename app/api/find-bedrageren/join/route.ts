import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type JoinPayload = {
  pin?: unknown;
  studentName?: unknown;
  participantId?: unknown;
};

type LiveSessionRow = {
  id: string;
  run_id: string | null;
  status: string | null;
  pin: string | null;
};

type FindBedragerenSessionRow = {
  live_session_id: string;
  phase: string;
};

type ParticipantRow = {
  id: string;
  session_id: string | null;
  student_name: string | null;
};

type FindBedragerenPlayerRow = {
  participant_id: string;
  live_session_id: string;
  student_name: string | null;
  has_seen_role: boolean | null;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

const ACTIVE_FIND_BEDRAGEREN_STATUS = "active";
const MAX_STUDENT_NAME_LENGTH = 40;
const PARTICIPANT_STORAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const JOINABLE_PHASES = new Set(["lobby", "reveal"]);

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePin(value: unknown) {
  return asTrimmedString(value).replace(/\D/g, "").slice(0, 6);
}

function participantStorageKey(sessionId: string) {
  return `find_bedrageren_participant_${sessionId}`;
}

function isMissingColumnError(error: SupabaseErrorLike | null | undefined) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204";
}

function toSafeLogError(error: unknown) {
  if (error instanceof Error) {
    return new Error(error.message);
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = asTrimmedString((error as SupabaseErrorLike).message);
    return new Error(message || "Find Bedrageren-join fejlede.");
  }

  return new Error("Find Bedrageren-join fejlede.");
}

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
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

async function fetchFindBedragerenSession(
  liveSessionId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("find_bedrageren_sessions")
    .select("live_session_id,phase")
    .eq("live_session_id", liveSessionId)
    .maybeSingle<FindBedragerenSessionRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function fetchParticipantById(
  sessionId: string,
  participantId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("participants")
    .select("id,session_id,student_name")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .maybeSingle<ParticipantRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function createParticipant(
  sessionId: string,
  studentName: string,
  adminSupabase: AdminSupabaseClient
) {
  const participantId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const payloads = [
    {
      id: participantId,
      session_id: sessionId,
      student_name: studentName,
      last_updated: timestamp,
    },
    {
      id: participantId,
      session_id: sessionId,
      student_name: studentName,
    },
  ];

  for (const payload of payloads) {
    const { data, error } = await adminSupabase
      .from("participants")
      .insert(payload)
      .select("id,session_id,student_name")
      .single<ParticipantRow>();

    if (!error && data) {
      return data;
    }

    if (!isMissingColumnError(error)) {
      throw new Error(error?.message ?? "Kunne ikke oprette deltageren.");
    }
  }

  throw new Error("Kunne ikke oprette deltageren.");
}

async function updateParticipantName(
  sessionId: string,
  participantId: string,
  studentName: string,
  adminSupabase: AdminSupabaseClient
) {
  const timestamp = new Date().toISOString();
  const payloads = [
    { student_name: studentName, last_updated: timestamp },
    { student_name: studentName },
  ];

  for (const payload of payloads) {
    const { error } = await adminSupabase
      .from("participants")
      .update(payload)
      .eq("id", participantId)
      .eq("session_id", sessionId);

    if (!error) {
      return await fetchParticipantById(sessionId, participantId, adminSupabase);
    }

    if (!isMissingColumnError(error)) {
      throw new Error(error.message);
    }
  }

  return await fetchParticipantById(sessionId, participantId, adminSupabase);
}

async function ensureFindBedragerenPlayer(
  sessionId: string,
  participantId: string,
  studentName: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data: existing, error: existingError } = await adminSupabase
    .from("find_bedrageren_players")
    .select("participant_id,live_session_id,student_name,has_seen_role")
    .eq("participant_id", participantId)
    .eq("live_session_id", sessionId)
    .maybeSingle<FindBedragerenPlayerRow>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    if ((existing.student_name ?? "").trim() !== studentName) {
      const { data: updated, error: updateError } = await adminSupabase
        .from("find_bedrageren_players")
        .update({ student_name: studentName })
        .eq("participant_id", participantId)
        .eq("live_session_id", sessionId)
        .select("participant_id,live_session_id,student_name,has_seen_role")
        .single<FindBedragerenPlayerRow>();

      if (updateError || !updated) {
        throw new Error(updateError?.message ?? "Kunne ikke opdatere spilleren.");
      }

      return updated;
    }

    return existing;
  }

  const { data: created, error: createError } = await adminSupabase
    .from("find_bedrageren_players")
    .insert({
      participant_id: participantId,
      live_session_id: sessionId,
      student_name: studentName,
      player_role: "civilian",
      has_seen_role: false,
    })
    .select("participant_id,live_session_id,student_name,has_seen_role")
    .single<FindBedragerenPlayerRow>();

  if (!createError && created) {
    return created;
  }

  if ((createError as SupabaseErrorLike | null)?.code !== "23505") {
    throw new Error(createError?.message ?? "Kunne ikke oprette spilleren.");
  }

  const { data: racedExisting, error: refetchError } = await adminSupabase
    .from("find_bedrageren_players")
    .select("participant_id,live_session_id,student_name,has_seen_role")
    .eq("participant_id", participantId)
    .eq("live_session_id", sessionId)
    .single<FindBedragerenPlayerRow>();

  if (refetchError || !racedExisting) {
    throw new Error(refetchError?.message ?? "Kunne ikke hente spilleren.");
  }

  return racedExisting;
}

export async function POST(request: NextRequest) {
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  let payload: JoinPayload;

  try {
    payload = (await request.json()) as JoinPayload;
  } catch {
    return respond({ error: "Ugyldig forespørgsel." }, 400);
  }

  const pin = normalizePin(payload.pin);
  const studentName = asTrimmedString(payload.studentName);
  const preferredParticipantId = asTrimmedString(payload.participantId);

  if (pin.length !== 6) {
    return respond({ error: "Skriv den 6-cifrede kode." }, 400);
  }

  if (!studentName || studentName.length > MAX_STUDENT_NAME_LENGTH) {
    return respond({ error: `Skriv et navn på højst ${MAX_STUDENT_NAME_LENGTH} tegn.` }, 400);
  }

  try {
    const adminSupabase = getRequiredAdminClient();

    const { data: liveSessions, error: liveSessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,run_id,status,pin")
      .eq("pin", pin)
      .eq("status", ACTIVE_FIND_BEDRAGEREN_STATUS)
      .limit(1);

    if (liveSessionError) {
      throw new Error(liveSessionError.message);
    }

    const liveSession = ((liveSessions ?? []) as LiveSessionRow[])[0] ?? null;
    if (!liveSession?.id) {
      return respond({ error: "Koden passer ikke til et åbent Find Bedrageren-spil." }, 404);
    }

    const findSession = await fetchFindBedragerenSession(liveSession.id, adminSupabase);
    if (!findSession) {
      return respond({ error: "Koden passer ikke til et Find Bedrageren-spil." }, 404);
    }

    if (!JOINABLE_PHASES.has(findSession.phase)) {
      return respond({ error: "Spillet kan ikke joines lige nu." }, 409);
    }

    const cookieParticipantId = asTrimmedString(
      request.cookies.get(participantStorageKey(liveSession.id))?.value
    );
    const reusableParticipantId = preferredParticipantId || cookieParticipantId;
    const reusableParticipant = reusableParticipantId
      ? await fetchParticipantById(liveSession.id, reusableParticipantId, adminSupabase)
      : null;

    const participant = reusableParticipant
      ? await updateParticipantName(liveSession.id, reusableParticipant.id, studentName, adminSupabase)
      : await createParticipant(liveSession.id, studentName, adminSupabase);

    if (!participant?.id) {
      throw new Error("Deltageren kunne ikke oprettes.");
    }

    const normalizedStudentName = asTrimmedString(participant.student_name) || studentName;
    await ensureFindBedragerenPlayer(
      liveSession.id,
      participant.id,
      normalizedStudentName,
      adminSupabase
    );

    const response = respond({
      sessionId: liveSession.id,
      participantId: participant.id,
      studentName: normalizedStudentName,
      phase: findSession.phase,
      redirectUrl: `/find-bedrageren/${encodeURIComponent(liveSession.id)}`,
    });

    response.cookies.set({
      name: participantStorageKey(liveSession.id),
      value: participant.id,
      path: "/",
      maxAge: PARTICIPANT_STORAGE_MAX_AGE_SECONDS,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Find Bedrageren join fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/join",
      method: "POST",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return respond({ error: "Kunne ikke joine spillet lige nu." }, 500);
  }
}

export async function GET(request: NextRequest) {
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const sessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
  const requestedParticipantId = asTrimmedString(request.nextUrl.searchParams.get("participantId"));
  const participantId =
    requestedParticipantId ||
    (sessionId ? asTrimmedString(request.cookies.get(participantStorageKey(sessionId))?.value) : "");

  if (!sessionId || !participantId) {
    return respond({ error: "Deltageren kunne ikke findes." }, 400);
  }

  try {
    const adminSupabase = getRequiredAdminClient();

    const findSession = await fetchFindBedragerenSession(sessionId, adminSupabase);
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
      .select("participant_id,live_session_id,student_name,has_seen_role")
      .eq("participant_id", participantId)
      .eq("live_session_id", sessionId)
      .maybeSingle<FindBedragerenPlayerRow>();

    if (playerError) {
      throw new Error(playerError.message);
    }

    if (!player) {
      return respond({ error: "Du er ikke med i dette spil endnu." }, 404);
    }

    const response = respond({
      sessionId,
      participantId,
      studentName: asTrimmedString(player.student_name) || "Elev",
      phase: findSession.phase,
      sessionStatus: liveSession.status ?? null,
    });

    response.cookies.set({
      name: participantStorageKey(sessionId),
      value: participantId,
      path: "/",
      maxAge: PARTICIPANT_STORAGE_MAX_AGE_SECONDS,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Find Bedrageren lobby-status fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/join",
      method: "GET",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return respond({ error: "Kunne ikke hente spillet lige nu." }, 500);
  }
}
