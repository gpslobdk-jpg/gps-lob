/**
 * GET /api/bonus/questions
 *
 * Henter (eller auto-genererer) bonusspørgsmål for et givet løb.
 *
 * Query-params:
 *   sessionId  — live session UUID (required)
 *
 * Sikkerhed:
 *   - correct_index sendes ALDRIG til klienten (strippes via toClientSafeQuestion)
 *   - bonus_enabled skal være true på gps_runs
 *   - Al DB-adgang via createAdminClient() (service_role)
 *
 * Idempotens:
 *   - Spørgsmål genereres én gang pr. gps_run og caches derefter
 *   - Race condition ved parallel generering håndteres via 23505-catch
 *
 * Cache:
 *   - Første generering: no-store (sikrer friske data)
 *   - Efterfølgende hentning: public, s-maxage=60
 */

import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { generateBonusQuestions, type SourceQuestion } from "@/utils/bonus/generateBonusQuestions";
import {
  asTrimmedString,
  fetchGpsRunForBonus,
  fetchLiveSessionRunId,
  runIdToSeed,
  toClientSafeQuestion,
  type AdminSupabaseClient,
  type BonusQuestionRow,
} from "@/app/api/bonus/_shared";

export const runtime = "edge";

// ============================================================================
// Interne typer
// ============================================================================

type BonusQuestionInsertRow = {
  gps_run_id: string;
  question_index: number;
  source_post_index: number | null;
  variant: string;
  question_text: string;
  answers: string[];
  correct_index: number;
  points: number;
  media_url: string | null;
};

const QUESTION_SELECT =
  "id,gps_run_id,question_index,source_post_index,variant,question_text,answers,correct_index,points,media_url,created_at";

// ============================================================================
// DB-hjælpere
// ============================================================================

async function fetchExistingBonusQuestions(
  runId: string,
  adminSupabase: AdminSupabaseClient
): Promise<BonusQuestionRow[] | null> {
  const { data, error } = await adminSupabase
    .from("bonus_questions")
    .select(QUESTION_SELECT)
    .eq("gps_run_id", runId)
    .order("question_index", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return data as BonusQuestionRow[];
}

/**
 * Indsætter genererede spørgsmål i bonus_questions.
 * Håndterer race condition (23505) ved at hente eksisterende rækker.
 */
async function insertOrFetchBonusQuestions(
  rows: BonusQuestionInsertRow[],
  runId: string,
  adminSupabase: AdminSupabaseClient
): Promise<BonusQuestionRow[]> {
  const { data, error } = await adminSupabase
    .from("bonus_questions")
    .insert(rows)
    .select(QUESTION_SELECT)
    .order("question_index", { ascending: true });

  if (error) {
    // Unique constraint violation: en anden request genererede allerede spørgsmålene
    if (error.code === "23505") {
      const existing = await fetchExistingBonusQuestions(runId, adminSupabase);
      if (existing && existing.length > 0) return existing;
    }
    throw new Error(error.message);
  }

  return (data ?? []) as BonusQuestionRow[];
}

// ============================================================================
// Route handler
// ============================================================================

export async function GET(request: NextRequest) {
  const sessionId = asTrimmedString(request.nextUrl.searchParams.get("sessionId"));
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId mangler." }, { status: 400 });
  }

  try {
    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
    }

    // ── 1. Find run via live session ──────────────────────────────────────────
    const runId = await fetchLiveSessionRunId(sessionId, adminSupabase);
    if (!runId) {
      return NextResponse.json({ error: "Session ikke fundet." }, { status: 404 });
    }

    // ── 2. Check bonus_enabled ────────────────────────────────────────────────
    const run = await fetchGpsRunForBonus(runId, adminSupabase);
    if (!run) {
      return NextResponse.json({ error: "Løbet ikke fundet." }, { status: 404 });
    }
    if (!run.bonus_enabled) {
      return NextResponse.json(
        { error: "Bonusspil er ikke aktiveret for dette løb.", reason: "bonus_disabled" },
        { status: 403 }
      );
    }

    // ── 3. Returnér eksisterende spørgsmål (allerede genereret) ───────────────
    const existing = await fetchExistingBonusQuestions(runId, adminSupabase);
    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          questions: existing.map(toClientSafeQuestion),
          totalQuestions: existing.length,
        },
        {
          headers: {
            // Cachebart — spørgsmålene ændrer sig ikke efter første generering
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        }
      );
    }

    // ── 4. Generer nye spørgsmål fra gps_run.questions ────────────────────────
    const sourceQuestions: SourceQuestion[] = Array.isArray(run.questions)
      ? (run.questions as SourceQuestion[])
      : [];

    const seed = runIdToSeed(runId);
    const generated = generateBonusQuestions(sourceQuestions, { seed });

    if (!generated.ok) {
      return NextResponse.json(
        {
          error:
            generated.reason === "no_usable_questions"
              ? "Løbet har ingen brugbare spørgsmål til bonusquiz."
              : "Løbet har ikke nok poster til bonusquiz (minimum 3 kræves).",
          reason: generated.reason,
        },
        { status: 422 }
      );
    }

    // ── 5. Gem i DB og returnér (correct_index strippes inden svar) ───────────
    const insertRows: BonusQuestionInsertRow[] = generated.questions.map((q) => ({
      gps_run_id: runId,
      question_index: q.questionIndex,
      source_post_index: q.sourcePostIndex,
      variant: q.variant,
      question_text: q.questionText,
      answers: q.answers,
      correct_index: q.correctIndex,   // Gemmes i DB — sendes ALDRIG til klient
      points: q.points,
      media_url: null,
    }));

    const saved = await insertOrFetchBonusQuestions(insertRows, runId, adminSupabase);

    return NextResponse.json(
      {
        questions: saved.map(toClientSafeQuestion),
        totalQuestions: saved.length,
      },
      {
        headers: {
          // Første generering: undgå stale cache
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Fejl i GET /api/bonus/questions:", error);
    await logHandledServerError({
      route: "/api/bonus/questions",
      method: "GET",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Kunne ikke hente bonusspørgsmål." },
      { status: 500 }
    );
  }
}
