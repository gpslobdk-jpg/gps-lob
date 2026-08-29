import { NextResponse } from "next/server";

import {
  canCreatePremiumRun,
  hasPremiumAccess,
  isPaywallEnabled,
  type AccessProfile,
} from "@/utils/accessControl";
import {
  CURRENT_ROUTE_VERSION,
  resolvePostOrderMode,
} from "@/lib/routes/postOrderPolicy";
import {
  containsPilenCharacterPost,
  PILEN_TEACHER_ACKNOWLEDGEMENT_VERSION,
} from "@/lib/pilenProductCopy";
import { getNormalizedRunRaceType, RACE_TYPES, type StoredRunRecord } from "@/utils/gpsRuns";
import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

const ACTIVE_SESSION_STATUSES = ["waiting", "running"] as const;

type ArchiveLiveSessionAction = "ensure" | "finish";

type ArchiveLiveSessionPayload = {
  action?: ArchiveLiveSessionAction;
  runId?: string;
};

type RunRow = Pick<
  StoredRunRecord,
  "id" | "user_id" | "race_type" | "post_order_mode" | "questions"
>;

type LiveSessionRow = {
  id: string;
  run_id: string;
  pin: string | null;
  status: string | null;
  created_at?: string | null;
};

type ProfileAccessRow = AccessProfile;

function generateJoinPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePin(pin: string | null | undefined) {
  const trimmed = typeof pin === "string" ? pin.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function toSessionResponse(session: LiveSessionRow) {
  return {
    id: session.id,
    pin: normalizePin(session.pin),
    status: session.status ?? "waiting",
  };
}

async function fetchOwnedRun(runId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("gps_runs")
    .select("id,user_id,race_type,post_order_mode,questions")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle<RunRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function fetchProfileAccess(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_type,access_expires_at,has_used_free_trial")
    .eq("id", userId)
    .maybeSingle<ProfileAccessRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function markFreeTrialAsUsed(
  userId: string,
  profileClient: NonNullable<ReturnType<typeof createAdminClient>>
) {
  const { error } = await profileClient
    .from("profiles")
    .upsert(
      {
        id: userId,
        has_used_free_trial: true,
      },
      { onConflict: "id" }
    );

  if (error) {
    throw error;
  }
}

async function fetchActiveSessions(runId: string, teacherId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("live_sessions")
    .select("id,run_id,pin,status,created_at")
    .eq("run_id", runId)
    .eq("teacher_id", teacherId)
    .in("status", [...ACTIVE_SESSION_STATUSES])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as LiveSessionRow[];
}

async function generateAvailablePin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = generateJoinPin();
    const { data, error } = await supabase
      .from("live_sessions")
      .select("id")
      .eq("pin", candidate)
      .in("status", [...ACTIVE_SESSION_STATUSES])
      .limit(1);

    if (error) {
      console.warn("Fejl ved PIN-tjek i arkiv-toggle:", error);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return candidate;
    }
  }

  throw new Error("Kunne ikke generere en unik PIN efter flere forsøg.");
}

async function ensureLiveSession(
  run: RunRow,
  teacherId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const runId = run.id;
  const existingSessions = await fetchActiveSessions(runId, teacherId, supabase);
  const existingSession = existingSessions[0] ?? null;
  const existingPin = normalizePin(existingSession?.pin);

  if (existingSession?.id && existingPin) {
    return {
      session: toSessionResponse(existingSession),
      source: "reused" as const,
    };
  }

  const generatedPin = await generateAvailablePin(supabase);

  if (existingSession?.id) {
    const { data, error } = await supabase
      .from("live_sessions")
      .update({ pin: generatedPin })
      .eq("id", existingSession.id)
      .eq("teacher_id", teacherId)
      .select("id,run_id,pin,status,created_at")
      .single<LiveSessionRow>();

    if (error) {
      throw error;
    }

    return {
      session: toSessionResponse(data),
      source: "reused" as const,
    };
  }

  const { data, error } = await supabase
    .from("live_sessions")
    .insert({
      run_id: runId,
      teacher_id: teacherId,
      pin: generatedPin,
      status: "waiting",
      post_order_mode: resolvePostOrderMode(run.post_order_mode, run.race_type),
      route_version: CURRENT_ROUTE_VERSION,
    })
    .select("id,run_id,pin,status,created_at")
    .single<LiveSessionRow>();

  if (error) {
    throw error;
  }

  return {
    session: toSessionResponse(data),
    source: "created" as const,
  };
}

async function finishLiveSessions(runId: string, teacherId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const activeSessions = await fetchActiveSessions(runId, teacherId, supabase);

  if (activeSessions.length === 0) {
    return { session: null, source: null };
  }

  const sessionIds = activeSessions.map((session) => session.id);
  const finishedAt = new Date().toISOString();

  const { error } = await supabase
    .from("live_sessions")
    .update({ status: "finished" })
    .in("id", sessionIds)
    .eq("teacher_id", teacherId);

  if (error) {
    throw error;
  }

  const adminSupabase = createAdminClient();
  if (adminSupabase) {
    const { error: finishParticipantsError } = await adminSupabase
      .from("participants")
      .update({
        finished_at: finishedAt,
        lat: null,
        lng: null,
        accuracy: null,
        last_updated: finishedAt,
      })
      .in("session_id", sessionIds)
      .is("finished_at", null);

    if (finishParticipantsError) {
      console.warn("Kunne ikke registrere afslutning på deltagere fra arkiv-toggle:", finishParticipantsError);
    }
  }

  return { session: null, source: null };
}

export async function POST(request: Request) {
  const requestPath = new URL(request.url).pathname;

  try {
    const payload = (await request.json()) as ArchiveLiveSessionPayload;
    const action = payload.action;
    const runId = payload.runId?.trim() ?? "";

    if (!action || !["ensure", "finish"].includes(action) || runId.length === 0) {
      return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    const ownedRun = await fetchOwnedRun(runId, user.id, supabase);
    if (!ownedRun) {
      return NextResponse.json({ error: "Løbet blev ikke fundet, eller du har ikke adgang." }, { status: 404 });
    }

    const normalizedRaceType = getNormalizedRunRaceType(ownedRun);
    const requiresPremiumAccess =
      normalizedRaceType === RACE_TYPES.STRATEGO || normalizedRaceType === RACE_TYPES.ZONE_KRIG;
    let shouldConsumeFreeTrial = false;

    if (action === "ensure" && containsPilenCharacterPost(ownedRun.questions)) {
      const acknowledgementClient = createAdminClient();
      if (!acknowledgementClient) {
        return NextResponse.json(
          { error: ADMIN_ACCESS_MISSING_MESSAGE },
          { status: 503 },
        );
      }

      const { data: acknowledgement, error: acknowledgementError } =
        await acknowledgementClient
          .from("pilen_realtime_teacher_acknowledgements")
          .select("accepted")
          .eq("user_id", user.id)
          .eq("copy_version", PILEN_TEACHER_ACKNOWLEDGEMENT_VERSION)
          .maybeSingle<{ accepted?: boolean | null }>();

      if (acknowledgementError) {
        return NextResponse.json(
          {
            error: "Pilen-bekræftelsen kunne ikke kontrolleres.",
            code: "PILEN_ACKNOWLEDGEMENT_UNAVAILABLE",
          },
          { status: 503 },
        );
      }
      if (acknowledgement?.accepted !== true) {
        return NextResponse.json(
          {
            error: "Bekræft den nødvendige tilladelse, før Pilen-løbet startes.",
            code: "PILEN_ACKNOWLEDGEMENT_REQUIRED",
          },
          { status: 428 },
        );
      }
    }

    if (action === "ensure" && isPaywallEnabled() && requiresPremiumAccess) {
      const profile = await fetchProfileAccess(user.id, supabase);
      const existingSessions = await fetchActiveSessions(runId, user.id, supabase);
      const hasExistingSession = existingSessions.length > 0;

      if (!hasExistingSession && !canCreatePremiumRun(profile)) {
        return NextResponse.json(
          { error: "Du har brugt dit gratis pr\u00F8vel\u00F8b. Opgrader for at forts\u00E6tte" },
          { status: 403 }
        );
      }

      shouldConsumeFreeTrial =
        !hasExistingSession &&
        normalizedRaceType === RACE_TYPES.STRATEGO &&
        !hasPremiumAccess(profile) &&
        profile?.has_used_free_trial !== true;
    }

    const freeTrialProfileClient = shouldConsumeFreeTrial ? createAdminClient() : null;
    if (shouldConsumeFreeTrial && !freeTrialProfileClient) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    const result =
      action === "ensure"
        ? await ensureLiveSession(ownedRun, user.id, supabase)
        : await finishLiveSessions(runId, user.id, supabase);

    if (action === "ensure" && shouldConsumeFreeTrial) {
      if (!freeTrialProfileClient) {
        throw new Error("Supabase admin access forsvandt før registrering af gratis prøveløb.");
      }
      await markFreeTrialAsUsed(user.id, freeTrialProfileClient);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Arkiv live-session mutation fejlede:", error);
    await logHandledServerError({
      route: "/api/archive/live-session",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json({ error: "Kunne ikke opdatere løbets lobby-status." }, { status: 500 });
  }
}
