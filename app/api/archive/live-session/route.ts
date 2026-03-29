import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const ACTIVE_SESSION_STATUSES = ["waiting", "running"] as const;

type ArchiveLiveSessionAction = "ensure" | "finish";

type ArchiveLiveSessionPayload = {
  action?: ArchiveLiveSessionAction;
  runId?: string;
};

type RunRow = {
  id: string;
  user_id: string;
};

type LiveSessionRow = {
  id: string;
  run_id: string;
  pin: string | null;
  status: string | null;
  created_at?: string | null;
};

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
    .select("id,user_id")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle<RunRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
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

async function ensureLiveSession(runId: string, teacherId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
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
      .update({ finished_at: finishedAt })
      .in("session_id", sessionIds)
      .is("finished_at", null);

    if (finishParticipantsError) {
      console.warn("Kunne ikke registrere afslutning på deltagere fra arkiv-toggle:", finishParticipantsError);
    }
  }

  return { session: null, source: null };
}

export async function POST(request: Request) {
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

    const result =
      action === "ensure"
        ? await ensureLiveSession(runId, user.id, supabase)
        : await finishLiveSessions(runId, user.id, supabase);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Arkiv live-session mutation fejlede:", error);
    return NextResponse.json({ error: "Kunne ikke opdatere løbets lobby-status." }, { status: 500 });
  }
}