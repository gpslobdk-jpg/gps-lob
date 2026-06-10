import { NextRequest, NextResponse } from "next/server";

import { buildVm26PublicTheme } from "@/utils/vm26Template";
import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

type LiveSessionThemeRow = {
  id?: string | null;
  run_id?: string | null;
  teacher_id?: string | null;
};

type RunThemeRow = {
  game_config?: unknown;
  gameConfig?: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
    if (!sessionId) {
      return jsonResponse({ error: "sessionId mangler." }, 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Du skal være logget ind." }, 401);
    }

    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      return jsonResponse({ error: ADMIN_ACCESS_MISSING_MESSAGE }, 503);
    }

    const { data: session, error: sessionError } = await adminSupabase
      .from("live_sessions")
      .select("id,run_id,teacher_id")
      .eq("id", sessionId)
      .maybeSingle<LiveSessionThemeRow>();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session?.id) {
      return jsonResponse({ error: "Sessionen blev ikke fundet." }, 404);
    }

    if (session.teacher_id !== user.id) {
      return jsonResponse({ error: "Du har ikke adgang til denne session." }, 403);
    }

    const runId = asTrimmedString(session.run_id);
    if (!runId) {
      return jsonResponse({});
    }

    const { data: run, error: runError } = await adminSupabase
      .from("gps_runs")
      .select("game_config,gameConfig:game_config")
      .eq("id", runId)
      .maybeSingle<RunThemeRow>();

    if (runError) {
      throw new Error(runError.message);
    }

    if (!run) {
      return jsonResponse({ error: "Løbet blev ikke fundet." }, 404);
    }

    const theme = buildVm26PublicTheme(run);

    return jsonResponse(theme ? { theme } : {});
  } catch (error) {
    console.error("Kunne ikke hente lærerens live-tema:", error);
    return jsonResponse({ error: "Kunne ikke hente live-tema." }, 500);
  }
}
