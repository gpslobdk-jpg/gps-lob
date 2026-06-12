import { NextResponse } from "next/server";

import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

type CreateFindBedragerenSessionPayload = {
  runId?: unknown;
};

type RunRow = {
  id: string;
  user_id: string | null;
  race_type?: unknown;
};

type FindBedragerenGameRow = {
  id: string;
  gps_run_id: string;
  secret_word: string;
  impostor_count: number;
};

type LiveSessionRow = {
  id: string;
  run_id: string | null;
  teacher_id: string | null;
  pin: string | null;
  status: string | null;
  created_at?: string | null;
};

type FindBedragerenSessionRow = {
  live_session_id: string;
  gps_run_id: string;
  game_id: string;
  phase: string;
  secret_word_snapshot: string;
  impostor_count_snapshot: number;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

const FIND_BEDRAGEREN_LIVE_STATUS = "active";
const REUSABLE_SESSION_STATUSES = ["waiting", "running", FIND_BEDRAGEREN_LIVE_STATUS] as const;

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePin(pin: string | null | undefined) {
  const trimmed = typeof pin === "string" ? pin.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function generateJoinPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function toSessionResponse(session: LiveSessionRow) {
  return {
    id: session.id,
    pin: normalizePin(session.pin),
    status: session.status ?? FIND_BEDRAGEREN_LIVE_STATUS,
  };
}

function toSafeLogError(error: unknown) {
  if (error instanceof Error) {
    return new Error(error.message);
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = asTrimmedString((error as SupabaseErrorLike).message);
    return new Error(message || "Find Bedrageren-session kunne ikke oprettes.");
  }

  return new Error("Find Bedrageren-session kunne ikke oprettes.");
}

async function generateAvailablePin(adminSupabase: ReturnType<typeof createAdminClient>) {
  if (!adminSupabase) {
    throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
  }

  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = generateJoinPin();
    const { data, error } = await adminSupabase
      .from("live_sessions")
      .select("id")
      .eq("pin", candidate)
      .in("status", [...REUSABLE_SESSION_STATUSES])
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return candidate;
    }
  }

  throw new Error("Kunne ikke generere en unik kode.");
}

async function fetchReusableLiveSession(
  runId: string,
  teacherId: string,
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const { data, error } = await adminSupabase
    .from("live_sessions")
    .select("id,run_id,teacher_id,pin,status,created_at")
    .eq("run_id", runId)
    .eq("teacher_id", teacherId)
    .in("status", [...REUSABLE_SESSION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as LiveSessionRow[])[0] ?? null;
}

async function ensureFindBedragerenSession(
  liveSession: LiveSessionRow,
  game: FindBedragerenGameRow,
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const { data: existing, error: existingError } = await adminSupabase
    .from("find_bedrageren_sessions")
    .select("live_session_id,gps_run_id,game_id,phase,secret_word_snapshot,impostor_count_snapshot")
    .eq("live_session_id", liveSession.id)
    .maybeSingle<FindBedragerenSessionRow>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing;
  }

  const insertRow = {
    live_session_id: liveSession.id,
    gps_run_id: game.gps_run_id,
    game_id: game.id,
    phase: "lobby",
    secret_word_snapshot: game.secret_word,
    impostor_count_snapshot: game.impostor_count,
  };

  const { data: created, error: createError } = await adminSupabase
    .from("find_bedrageren_sessions")
    .insert(insertRow)
    .select("live_session_id,gps_run_id,game_id,phase,secret_word_snapshot,impostor_count_snapshot")
    .single<FindBedragerenSessionRow>();

  if (!createError && created) {
    return created;
  }

  if ((createError as SupabaseErrorLike | null)?.code !== "23505") {
    throw new Error(createError?.message ?? "Kunne ikke oprette Find Bedrageren-session.");
  }

  const { data: createdByRace, error: refetchError } = await adminSupabase
    .from("find_bedrageren_sessions")
    .select("live_session_id,gps_run_id,game_id,phase,secret_word_snapshot,impostor_count_snapshot")
    .eq("live_session_id", liveSession.id)
    .single<FindBedragerenSessionRow>();

  if (refetchError || !createdByRace) {
    throw new Error(refetchError?.message ?? "Kunne ikke hente Find Bedrageren-session.");
  }

  return createdByRace;
}

export async function POST(request: Request) {
  const requestPath = new URL(request.url).pathname;
  let payload: CreateFindBedragerenSessionPayload;

  try {
    payload = (await request.json()) as CreateFindBedragerenSessionPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const runId = asTrimmedString(payload.runId);
  if (!runId) {
    return NextResponse.json({ error: "Aktiviteten mangler." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    const { data: run, error: runError } = await adminSupabase
      .from("gps_runs")
      .select("id,user_id,race_type")
      .eq("id", runId)
      .maybeSingle<RunRow>();

    if (runError) {
      throw new Error(runError.message);
    }

    if (!run || run.user_id !== user.id) {
      return NextResponse.json({ error: "Aktiviteten blev ikke fundet." }, { status: 404 });
    }

    if (normalizeRaceType(run.race_type) !== RACE_TYPES.FIND_BEDRAGEREN) {
      return NextResponse.json({ error: "Aktiviteten er ikke Find Bedrageren." }, { status: 400 });
    }

    const { data: game, error: gameError } = await adminSupabase
      .from("find_bedrageren_games")
      .select("id,gps_run_id,secret_word,impostor_count")
      .eq("gps_run_id", run.id)
      .maybeSingle<FindBedragerenGameRow>();

    if (gameError) {
      throw new Error(gameError.message);
    }

    if (!game) {
      return NextResponse.json({ error: "Spilindstillingerne blev ikke fundet." }, { status: 404 });
    }

    const reusableSession = await fetchReusableLiveSession(run.id, user.id, adminSupabase);
    let liveSession = reusableSession;
    const source: "created" | "reused" = reusableSession ? "reused" : "created";

    if (liveSession) {
      const nextPin = normalizePin(liveSession.pin) ?? (await generateAvailablePin(adminSupabase));
      const needsUpdate = liveSession.status !== FIND_BEDRAGEREN_LIVE_STATUS || liveSession.pin !== nextPin;

      if (needsUpdate) {
        const { data: updatedSession, error: updateError } = await adminSupabase
          .from("live_sessions")
          .update({
            pin: nextPin,
            status: FIND_BEDRAGEREN_LIVE_STATUS,
          })
          .eq("id", liveSession.id)
          .eq("teacher_id", user.id)
          .select("id,run_id,teacher_id,pin,status,created_at")
          .single<LiveSessionRow>();

        if (updateError || !updatedSession) {
          throw new Error(updateError?.message ?? "Kunne ikke opdatere lobbyen.");
        }

        liveSession = updatedSession;
      }
    } else {
      const generatedPin = await generateAvailablePin(adminSupabase);
      const { data: createdSession, error: createSessionError } = await adminSupabase
        .from("live_sessions")
        .insert({
          run_id: run.id,
          teacher_id: user.id,
          pin: generatedPin,
          status: FIND_BEDRAGEREN_LIVE_STATUS,
        })
        .select("id,run_id,teacher_id,pin,status,created_at")
        .single<LiveSessionRow>();

      if (createSessionError || !createdSession) {
        throw new Error(createSessionError?.message ?? "Kunne ikke oprette lobbyen.");
      }

      liveSession = createdSession;
    }

    await ensureFindBedragerenSession(liveSession, game, adminSupabase);

    return NextResponse.json({
      session: toSessionResponse(liveSession),
      source,
    });
  } catch (error) {
    console.error("Find Bedrageren-session fejlede.");
    await logHandledServerError({
      route: "/api/find-bedrageren/sessions",
      method: "POST",
      status: 500,
      error: toSafeLogError(error),
      requestPath,
      routeType: "route",
    });

    return NextResponse.json({ error: "Kunne ikke åbne lobbyen lige nu." }, { status: 500 });
  }
}
