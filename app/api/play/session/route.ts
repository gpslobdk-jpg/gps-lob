import { NextRequest, NextResponse } from "next/server";

import {
  asTrimmedString,
  fetchRunForSession,
  normalizeRaceMode,
  resolveQuestionVariant,
  sanitizeQuestionForPlay,
} from "@/app/api/play/_shared";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));

  if (!sessionId) {
    return NextResponse.json({ error: "Session-id mangler." }, { status: 400 });
  }

  try {
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
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Kunne ikke hente play-data:", error);
    return NextResponse.json({ error: "Kunne ikke hente løbet." }, { status: 500 });
  }
}
