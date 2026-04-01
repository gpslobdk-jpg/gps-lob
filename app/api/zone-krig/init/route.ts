import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import {
  canCreatePremiumRun,
  hasPremiumAccess,
  isPaywallEnabled,
  type AccessProfile,
} from "@/utils/accessControl";
import { createClient } from "@/utils/supabase/server";
import {
  initializeZoneKrigZones,
  isZoneKrigRaceType,
} from "@/app/api/zone-krig/_shared";

export const runtime = "edge";

type InitZoneKrigPayload = {
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
  questions?: unknown;
};

type ProfileAccessRow = AccessProfile;

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function markFreeTrialAsUsed(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const profileClient = createAdminClient() ?? supabase;
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
    throw new Error(error.message ?? "Kunne ikke markere gratis pr\u00F8vel\u00F8b.");
  }
}

export async function POST(request: NextRequest) {
  let payload: InitZoneKrigPayload;

  try {
    payload = (await request.json()) as InitZoneKrigPayload;
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
    const paywallEnabled = isPaywallEnabled();
    const supabase = paywallEnabled ? await createClient() : null;
    const authenticatedUser = paywallEnabled
      ? await supabase?.auth.getUser()
      : null;
    let shouldConsumeFreeTrial = false;

    if (paywallEnabled && (authenticatedUser?.error || !authenticatedUser?.data.user)) {
      return NextResponse.json({ error: "Du skal v\u00E6re logget ind." }, { status: 401 });
    }

    const { data: session, error: sessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,run_id,status,teacher_id")
      .eq("id", sessionId)
      .in("status", ["waiting", "running"])
      .maybeSingle<LiveSessionRow>();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session?.id || !session.run_id) {
      return NextResponse.json({ error: "Sessionen blev ikke fundet." }, { status: 404 });
    }

    const user = authenticatedUser?.data.user ?? null;
    if (paywallEnabled && session.teacher_id !== user?.id) {
      return NextResponse.json({ error: "Du har ikke adgang til denne session." }, { status: 403 });
    }

    const { data: run, error: runError } = await adminSupabase
      .from("gps_runs")
      .select("questions,race_type,raceType")
      .eq("id", session.run_id)
      .maybeSingle<RunRow>();

    if (runError) {
      throw new Error(runError.message);
    }

    if (!isZoneKrigRaceType(run?.race_type ?? run?.raceType)) {
      return NextResponse.json({ initialized: false, zoneCount: 0 });
    }

    if (paywallEnabled && supabase && user) {
      const { count: existingZoneCount, error: zoneCountError } = await adminSupabase
        .from("game_zones")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId);

      if (zoneCountError) {
        throw new Error(zoneCountError.message);
      }

      const alreadyInitialized = (existingZoneCount ?? 0) > 0;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("plan_type,access_expires_at,has_used_free_trial")
        .eq("id", user.id)
        .maybeSingle<ProfileAccessRow>();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (!alreadyInitialized && !canCreatePremiumRun(profile)) {
        return NextResponse.json(
          { error: "Du har brugt dit gratis pr\u00F8vel\u00F8b. Opgrader for at forts\u00E6tte" },
          { status: 403 }
        );
      }

      shouldConsumeFreeTrial =
        !alreadyInitialized &&
        !hasPremiumAccess(profile) &&
        profile?.has_used_free_trial !== true;
    }

    const result = await initializeZoneKrigZones(sessionId, run ?? null, adminSupabase);
    if (shouldConsumeFreeTrial && supabase && user) {
      await markFreeTrialAsUsed(user.id, supabase);
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Kunne ikke initialisere Zone Krig-zoner:", error);
    return NextResponse.json(
      { error: "Kunne ikke initialisere Zone Krig-zoner." },
      { status: 500 }
    );
  }
}
