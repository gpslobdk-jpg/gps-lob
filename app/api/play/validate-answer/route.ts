import { NextRequest, NextResponse } from "next/server";

import {
  asTrimmedString,
  extractEscapeCodeBrick,
  fetchRunForSession,
  getCorrectIndex,
  getExpectedAnswer,
  normalizeEscapeAnswer,
  resolveQuestionVariant,
} from "@/app/api/play/_shared";
import { ADMIN_ACCESS_MISSING_MESSAGE } from "@/utils/supabase/admin";

export const runtime = "edge";

type ValidateAnswerPayload = {
  sessionId?: unknown;
  postIndex?: unknown;
  answer?: unknown;
  selectedIndex?: unknown;
};

function asPostIndex(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function asSelectedIndex(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
}

export async function POST(request: NextRequest) {
  let payload: ValidateAnswerPayload;

  try {
    payload = (await request.json()) as ValidateAnswerPayload;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørgsel." }, { status: 400 });
  }

  const sessionId = asTrimmedString(payload.sessionId);
  const postIndex = asPostIndex(payload.postIndex);
  const answer = asTrimmedString(payload.answer);
  const selectedIndex = asSelectedIndex(payload.selectedIndex);

  if (!sessionId || postIndex === null) {
    return NextResponse.json({ error: "Manglende valideringsdata." }, { status: 400 });
  }

  try {
    const run = await fetchRunForSession(sessionId);
    if (!run || !Array.isArray(run.questions) || postIndex >= run.questions.length) {
      return NextResponse.json({ error: "Gåden kunne ikke findes." }, { status: 404 });
    }

    const rawQuestion = run.questions[postIndex];
    const variant = resolveQuestionVariant(run.raceType ?? run.race_type, rawQuestion);

    if (variant === "quiz") {
      const correctIndex = getCorrectIndex(rawQuestion);
      if (correctIndex === null || selectedIndex === null) {
        return NextResponse.json({ error: "Quiz-svaret mangler." }, { status: 400 });
      }

      return NextResponse.json({
        isCorrect: selectedIndex === correctIndex,
      });
    }

    if (variant === "roleplay" || variant === "escape") {
      const expectedAnswer = getExpectedAnswer(rawQuestion);
      if (!expectedAnswer || !answer) {
        return NextResponse.json({ error: "Svaret mangler." }, { status: 400 });
      }

      const isCorrect = normalizeEscapeAnswer(answer) === normalizeEscapeAnswer(expectedAnswer);

      return NextResponse.json({
        isCorrect,
        brick: variant === "escape" && isCorrect ? extractEscapeCodeBrick(rawQuestion, postIndex) : null,
      });
    }

    return NextResponse.json({ error: "Denne post-type bruger en anden validator." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Kunne ikke validere gådesvar:", error);
    return NextResponse.json({ error: "Kunne ikke tjekke svaret." }, { status: 500 });
  }
}
