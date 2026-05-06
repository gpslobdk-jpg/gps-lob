/**
 * POST /api/bonus/answer
 *
 * Indsender et elevssvar på ét bonusspørgsmål.
 *
 * Request body (JSON):
 *   bonusSessionId  string  — bonus_sessions UUID (required)
 *   questionId      string  — bonus_questions UUID (required)
 *   questionIndex   number  — 1..15 (required, bruges til unique-lock)
 *   selectedIndex   number  — 0..3 (required, elevens valg)
 *
 * Respons:
 *   isCorrect, pointsAwarded, score, currentIndex, isFinished, nextQuestionIndex
 *
 * Sikkerhed:
 *   - correct_index læses server-side og returneres ALDRIG til klienten
 *   - Duplicate submit returnerer eksisterende resultat (ingen dobbelt-point)
 *   - Forkert svar giver 0 point og blokerer IKKE eleven
 *   - bonus_sessions.score og normal score er fuldstændigt adskilt
 *
 * Idempotens:
 *   - unique(bonus_session_id, question_index) i DB forhindrer dobbelt-insert
 *   - 23505-fejl fanges → returnerer eksisterende svar uændret
 */

import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { asTrimmedString, type AdminSupabaseClient } from "@/app/api/bonus/_shared";

export const runtime = "edge";

// ============================================================================
// Typer (interne — aldrig til klienten direkte)
// ============================================================================

type SubmitBonusAnswerBody = {
  bonusSessionId?: unknown;
  questionId?: unknown;
  questionIndex?: unknown;
  selectedIndex?: unknown;
};

type BonusSessionForAnswer = {
  id: string;
  gps_run_id: string;
  status: string;
  score: number;
  current_index: number;
  total_questions: number;
};

/** Inkluderer correct_index — KUN brugt internt til sammenligning */
type BonusQuestionForAnswer = {
  id: string;
  gps_run_id: string;
  question_index: number;
  correct_index: number;   // ⚠️ ALDRIG returneret til klient
  points: number;
};

type ExistingBonusAnswer = {
  id: string;
  question_index: number;
  selected_index: number | null;
  is_correct: boolean;
  points_awarded: number;
};

// ============================================================================
// DB-hjælpere
// ============================================================================

async function fetchBonusSessionForAnswer(
  bonusSessionId: string,
  adminSupabase: AdminSupabaseClient
): Promise<BonusSessionForAnswer | null> {
  const { data, error } = await adminSupabase
    .from("bonus_sessions")
    .select("id,gps_run_id,status,score,current_index,total_questions")
    .eq("id", bonusSessionId)
    .maybeSingle<BonusSessionForAnswer>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function fetchBonusQuestionForAnswer(
  questionId: string,
  adminSupabase: AdminSupabaseClient
): Promise<BonusQuestionForAnswer | null> {
  const { data, error } = await adminSupabase
    .from("bonus_questions")
    .select("id,gps_run_id,question_index,correct_index,points")
    .eq("id", questionId)
    .maybeSingle<BonusQuestionForAnswer>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function fetchExistingAnswer(
  bonusSessionId: string,
  questionIndex: number,
  adminSupabase: AdminSupabaseClient
): Promise<ExistingBonusAnswer | null> {
  const { data, error } = await adminSupabase
    .from("bonus_answers")
    .select("id,question_index,selected_index,is_correct,points_awarded")
    .eq("bonus_session_id", bonusSessionId)
    .eq("question_index", questionIndex)
    .maybeSingle<ExistingBonusAnswer>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function insertBonusAnswer(
  bonusSessionId: string,
  questionId: string,
  questionIndex: number,
  selectedIndex: number,
  isCorrect: boolean,
  pointsAwarded: number,
  adminSupabase: AdminSupabaseClient
): Promise<{ ok: true } | { ok: false; isDuplicate: boolean }> {
  const { error } = await adminSupabase
    .from("bonus_answers")
    .insert({
      bonus_session_id: bonusSessionId,
      question_id: questionId,
      question_index: questionIndex,
      selected_index: selectedIndex,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
    });

  if (error) {
    if (error.code === "23505") return { ok: false, isDuplicate: true };
    throw new Error(error.message);
  }
  return { ok: true };
}

async function updateBonusSessionAfterAnswer(
  bonusSessionId: string,
  newScore: number,
  newCurrentIndex: number,
  adminSupabase: AdminSupabaseClient
): Promise<BonusSessionForAnswer | null> {
  const { data, error } = await adminSupabase
    .from("bonus_sessions")
    .update({
      score: newScore,
      current_index: newCurrentIndex,
    })
    .eq("id", bonusSessionId)
    .select("id,gps_run_id,status,score,current_index,total_questions")
    .single<BonusSessionForAnswer>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

// ============================================================================
// Route handler
// ============================================================================

export async function POST(request: NextRequest) {
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: SubmitBonusAnswerBody;
  try {
    body = (await request.json()) as SubmitBonusAnswerBody;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON i request body." }, { status: 400 });
  }

  const bonusSessionId = asTrimmedString(body.bonusSessionId);
  const questionId = asTrimmedString(body.questionId);
  const questionIndex =
    typeof body.questionIndex === "number" && Number.isInteger(body.questionIndex)
      ? body.questionIndex
      : null;
  const selectedIndex =
    typeof body.selectedIndex === "number" && Number.isInteger(body.selectedIndex)
      ? body.selectedIndex
      : null;

  // ── Validering ────────────────────────────────────────────────────────────
  if (!bonusSessionId) {
    return NextResponse.json({ error: "bonusSessionId mangler." }, { status: 400 });
  }
  if (!questionId) {
    return NextResponse.json({ error: "questionId mangler." }, { status: 400 });
  }
  if (questionIndex === null || questionIndex < 1 || questionIndex > 15) {
    return NextResponse.json(
      { error: "questionIndex skal være et heltal mellem 1 og 15." },
      { status: 400 }
    );
  }
  if (selectedIndex === null || selectedIndex < 0 || selectedIndex > 3) {
    return NextResponse.json(
      { error: "selectedIndex skal være et heltal mellem 0 og 3." },
      { status: 400 }
    );
  }

  try {
    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
    }

    // ── 1. Find og validér bonus-session ──────────────────────────────────────
    const session = await fetchBonusSessionForAnswer(bonusSessionId, adminSupabase);
    if (!session) {
      return NextResponse.json({ error: "Bonus-session ikke fundet." }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json(
        { error: "Bonus-session er allerede afsluttet.", reason: "session_finished" },
        { status: 409 }
      );
    }

    // ── 2. Find og validér bonus-spørgsmål ────────────────────────────────────
    const question = await fetchBonusQuestionForAnswer(questionId, adminSupabase);
    if (!question) {
      return NextResponse.json({ error: "Bonusspørgsmål ikke fundet." }, { status: 404 });
    }
    if (question.gps_run_id !== session.gps_run_id) {
      return NextResponse.json(
        { error: "Bonusspørgsmål hører ikke til dette løb." },
        { status: 400 }
      );
    }
    if (question.question_index !== questionIndex) {
      return NextResponse.json(
        { error: "questionIndex matcher ikke bonusspørgsmålets index." },
        { status: 400 }
      );
    }

    // ── 3. Check for eksisterende svar (idempotens) ───────────────────────────
    const existingAnswer = await fetchExistingAnswer(bonusSessionId, questionIndex, adminSupabase);
    if (existingAnswer) {
      // Duplicate submit — returnér eksisterende resultat uden at ændre score
      const nextQuestionIndex = questionIndex + 1;
      const isFinished = session.current_index >= session.total_questions;
      return NextResponse.json(
        {
          isCorrect: existingAnswer.is_correct,
          pointsAwarded: existingAnswer.points_awarded,
          score: session.score,
          currentIndex: session.current_index,
          isFinished,
          nextQuestionIndex,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── 4. Beregn korrekthed server-side ──────────────────────────────────────
    // correct_index bruges KUN her — returneres ALDRIG til klient
    const isCorrect = selectedIndex === question.correct_index;
    const pointsAwarded = isCorrect ? question.points : 0;

    // ── 5. Gem svar (med atomic lock) ─────────────────────────────────────────
    const insertResult = await insertBonusAnswer(
      bonusSessionId,
      questionId,
      questionIndex,
      selectedIndex,
      isCorrect,
      pointsAwarded,
      adminSupabase
    );

    if (!insertResult.ok && insertResult.isDuplicate) {
      // Race condition: anden request inserter svar på samme tid
      const raceAnswer = await fetchExistingAnswer(bonusSessionId, questionIndex, adminSupabase);
      const nextQuestionIndex = questionIndex + 1;
      const isFinished = session.current_index >= session.total_questions;
      return NextResponse.json(
        {
          isCorrect: raceAnswer?.is_correct ?? false,
          pointsAwarded: raceAnswer?.points_awarded ?? 0,
          score: session.score,
          currentIndex: session.current_index,
          isFinished,
          nextQuestionIndex,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── 6. Opdater session-score og current_index ─────────────────────────────
    const newScore = session.score + pointsAwarded;
    // current_index går fremad, men aldrig over total_questions
    const newCurrentIndex = Math.min(
      Math.max(session.current_index, questionIndex),
      session.total_questions
    );

    const updatedSession = await updateBonusSessionAfterAnswer(
      bonusSessionId,
      newScore,
      newCurrentIndex,
      adminSupabase
    );

    const finalScore = updatedSession?.score ?? newScore;
    const finalCurrentIndex = updatedSession?.current_index ?? newCurrentIndex;
    const totalQuestions = updatedSession?.total_questions ?? session.total_questions;
    const isFinished = finalCurrentIndex >= totalQuestions;
    const nextQuestionIndex = questionIndex + 1;

    return NextResponse.json(
      {
        isCorrect,
        pointsAwarded,
        score: finalScore,
        currentIndex: finalCurrentIndex,
        isFinished,
        nextQuestionIndex,
        // correct_index: RETURNERES ALDRIG
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Fejl i POST /api/bonus/answer:", error);
    await logHandledServerError({
      route: "/api/bonus/answer",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Kunne ikke gemme bonus-svar." },
      { status: 500 }
    );
  }
}
