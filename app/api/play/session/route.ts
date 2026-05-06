import { NextRequest, NextResponse } from "next/server";

import {
  asTrimmedString,
  fetchRunForSession,
  getRunRadiusMeters,
  normalizeRaceMode,
  resolveQuestionVariant,
  sanitizeQuestionForPlay,
} from "@/app/api/play/_shared";
import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const sessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (!sessionId) {
    return NextResponse.json({ error: "Session-id mangler." }, { status: 400 });
  }

  try {
    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
    }

    const { data: sessionData, error: sessionError } = await adminSupabase
      .from("live_sessions")
      .select("gps_override")
      .eq("id", sessionId)
      .maybeSingle<{ gps_override?: boolean | null }>();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const run = await fetchRunForSession(sessionId);
    if (!run) {
      return NextResponse.json({ error: "Kunne ikke finde løbet." }, { status: 404 });
    }

    const rawQuestions = Array.isArray(run.questions) ? run.questions : [];
    const normalizedRaceMode = normalizeRaceMode(run.raceType ?? run.race_type);
    const inferredVariants = rawQuestions.map((question) => resolveQuestionVariant("unknown", question));
    const inferredEscapeRun =
      inferredVariants.length > 0 && inferredVariants.every((variant) => variant === "escape");
    const raceType =
      normalizedRaceMode !== "unknown"
        ? normalizedRaceMode
        : inferredEscapeRun
          ? "escape"
          : asTrimmedString(run.raceType ?? run.race_type) || "unknown";

    const questions = rawQuestions.map((question) =>
      sanitizeQuestionForPlay(question, resolveQuestionVariant(raceType, question))
    );

    return NextResponse.json(
      {
        questions,
        raceType,
        radius: getRunRadiusMeters(run),
        gpsOverride: Boolean(sessionData?.gps_override),
        bonusEnabled: Boolean(run?.bonus_enabled ?? false),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Kunne ikke hente play-data:", error);
    await logHandledServerError({
      route: "/api/play/session",
      method: "GET",
      status: 500,
      error,
      requestPath,
      routeType: "route",
      sessionId,
    });
    return NextResponse.json({ error: "Kunne ikke hente løbet." }, { status: 500 });
  }
}
