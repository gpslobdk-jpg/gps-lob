/**
 * POST /api/bonus/session
 *
 * Opretter eller genoptager en bonus-session for en elev.
 * Idempotent: to identiske requests returnerer samme session.
 *
 * Request body (JSON):
 *   sessionId    string  — live session UUID (required)
 *   studentName  string  — elevens navn (required, max 100 tegn)
 *   participantId string — valgfrit UUID til fremtidig disambiguation
 *
 * Respons:
 *   bonusSessionId, status, currentIndex, score, totalQuestions,
 *   isFinished, startedAt, finishedAt
 *
 * Sikkerhed:
 *   - Ingen FK til participants eller answers — isolation er garanteret
 *   - bonus_enabled skal være true på gps_runs
 *   - Race condition (23505) håndteres med SELECT-retry
 *   - Al DB-adgang via createAdminClient() (service_role)
 */

import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import {
  asTrimmedString,
  fetchGpsRunForBonus,
  fetchLiveSessionRunId,
  MAX_STUDENT_NAME_LENGTH,
  type AdminSupabaseClient,
  type BonusSessionRow,
} from "@/app/api/bonus/_shared";

export const runtime = "edge";

// ============================================================================
// Typer
// ============================================================================

type CreateBonusSessionBody = {
  sessionId?: unknown;
  studentName?: unknown;
  participantId?: unknown;
};

type BonusSessionResponseBody = {
  bonusSessionId: string;
  status: string;
  currentIndex: number;
  score: number;
  totalQuestions: number;
  isFinished: boolean;
  startedAt: string;
  finishedAt: string | null;
};

// ============================================================================
// Hjælpere
// ============================================================================

const SESSION_SELECT =
  "id,live_session_id,gps_run_id,student_name,participant_id,current_index,score,total_questions,status,started_at,finished_at";

function toBonusSessionResponse(row: BonusSessionRow): BonusSessionResponseBody {
  return {
    bonusSessionId: row.id,
    status: row.status,
    currentIndex: row.current_index,
    score: row.score,
    totalQuestions: row.total_questions,
    isFinished: row.status === "finished",
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
  };
}

async function fetchBonusQuestionsCount(
  runId: string,
  adminSupabase: AdminSupabaseClient
): Promise<number> {
  const { count, error } = await adminSupabase
    .from("bonus_questions")
    .select("id", { count: "exact", head: true })
    .eq("gps_run_id", runId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Find eksisterende session eller opret ny.
 * Håndterer race condition (23505) med SELECT-retry.
 */
async function findOrCreateBonusSession(
  liveSessionId: string,
  runId: string,
  studentName: string,
  totalQuestions: number,
  participantId: string | null,
  adminSupabase: AdminSupabaseClient
): Promise<BonusSessionRow> {
  // ── Forsøg at finde eksisterende session (genoptagelse) ───────────────────
  const { data: existing, error: selectError } = await adminSupabase
    .from("bonus_sessions")
    .select(SESSION_SELECT)
    .eq("live_session_id", liveSessionId)
    .eq("student_name", studentName)
    .maybeSingle<BonusSessionRow>();

  if (selectError) throw new Error(selectError.message);
  if (existing) return existing;

  // ── Opret ny session ──────────────────────────────────────────────────────
  const { data: created, error: insertError } = await adminSupabase
    .from("bonus_sessions")
    .insert({
      live_session_id: liveSessionId,
      gps_run_id: runId,
      student_name: studentName,
      total_questions: totalQuestions,
      participant_id: participantId,
      // status, score, current_index bruger DB-defaults ('active', 0, 0)
    })
    .select(SESSION_SELECT)
    .single<BonusSessionRow>();

  if (insertError) {
    // Race condition: to samtidige requests → unique constraint violation
    // Hent den session, der vandt racet
    if (insertError.code === "23505") {
      const { data: raceWinner, error: retryError } = await adminSupabase
        .from("bonus_sessions")
        .select(SESSION_SELECT)
        .eq("live_session_id", liveSessionId)
        .eq("student_name", studentName)
        .maybeSingle<BonusSessionRow>();

      if (retryError) throw new Error(retryError.message);
      if (raceWinner) return raceWinner;
    }
    throw new Error(insertError.message);
  }

  if (!created) throw new Error("Kunne ikke oprette bonus-session.");
  return created;
}

// ============================================================================
// Route handler
// ============================================================================

export async function POST(request: NextRequest) {
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: CreateBonusSessionBody;
  try {
    body = (await request.json()) as CreateBonusSessionBody;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON i request body." }, { status: 400 });
  }

  const sessionId = asTrimmedString(body.sessionId);
  const studentName = asTrimmedString(body.studentName);
  const participantId = asTrimmedString(body.participantId) || null;

  // ── Validering ────────────────────────────────────────────────────────────
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId mangler." }, { status: 400 });
  }
  if (!studentName) {
    return NextResponse.json({ error: "studentName mangler." }, { status: 400 });
  }
  if (studentName.length > MAX_STUDENT_NAME_LENGTH) {
    return NextResponse.json(
      { error: `studentName må maks være ${MAX_STUDENT_NAME_LENGTH} tegn.` },
      { status: 400 }
    );
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

    // ── 3. Hent antal bonus-spørgsmål (til total_questions i session) ─────────
    // Bemærk: 0 er muligt hvis spørgsmål endnu ikke er genereret.
    // Klienten bør kalde GET /api/bonus/questions INDEN denne route.
    const totalQuestions = await fetchBonusQuestionsCount(runId, adminSupabase);

    // ── 4. Find eller opret bonus-session ─────────────────────────────────────
    const session = await findOrCreateBonusSession(
      sessionId,
      runId,
      studentName,
      totalQuestions,
      participantId,
      adminSupabase
    );

    return NextResponse.json(toBonusSessionResponse(session), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Fejl i POST /api/bonus/session:", error);
    await logHandledServerError({
      route: "/api/bonus/session",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Kunne ikke oprette bonus-session." },
      { status: 500 }
    );
  }
}
