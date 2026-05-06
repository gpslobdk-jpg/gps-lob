/**
 * POST /api/bonus/finish
 *
 * Markerer en bonus-session som afsluttet.
 *
 * Request body (JSON):
 *   bonusSessionId  string  — bonus_sessions UUID (required)
 *
 * Idempotent: Allerede afsluttede sessioner returnerer eksisterende data.
 *
 * Sikkerhed:
 *   - Rører IKKE participants, answers eller normal score
 *   - Sætter kun status='finished' og finished_at på bonus_sessions
 */

import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import { asTrimmedString, type AdminSupabaseClient } from "@/app/api/bonus/_shared";

export const runtime = "edge";

// ============================================================================
// Typer
// ============================================================================

type FinishBonusSessionBody = {
  bonusSessionId?: unknown;
};

type BonusSessionForFinish = {
  id: string;
  status: string;
  score: number;
  total_questions: number;
  finished_at: string | null;
};

// ============================================================================
// DB-hjælpere
// ============================================================================

async function fetchBonusSessionForFinish(
  bonusSessionId: string,
  adminSupabase: AdminSupabaseClient
): Promise<BonusSessionForFinish | null> {
  const { data, error } = await adminSupabase
    .from("bonus_sessions")
    .select("id,status,score,total_questions,finished_at")
    .eq("id", bonusSessionId)
    .maybeSingle<BonusSessionForFinish>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function finishBonusSession(
  bonusSessionId: string,
  adminSupabase: AdminSupabaseClient
): Promise<BonusSessionForFinish | null> {
  const { data, error } = await adminSupabase
    .from("bonus_sessions")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
    })
    .eq("id", bonusSessionId)
    .eq("status", "active")   // Guard: opdatér kun aktive sessioner
    .select("id,status,score,total_questions,finished_at")
    .maybeSingle<BonusSessionForFinish>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

// ============================================================================
// Route handler
// ============================================================================

export async function POST(request: NextRequest) {
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: FinishBonusSessionBody;
  try {
    body = (await request.json()) as FinishBonusSessionBody;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON i request body." }, { status: 400 });
  }

  const bonusSessionId = asTrimmedString(body.bonusSessionId);

  if (!bonusSessionId) {
    return NextResponse.json({ error: "bonusSessionId mangler." }, { status: 400 });
  }

  try {
    const adminSupabase = createAdminClient();
    if (!adminSupabase) {
      throw new Error(ADMIN_ACCESS_MISSING_MESSAGE);
    }

    // ── 1. Find session ───────────────────────────────────────────────────────
    const session = await fetchBonusSessionForFinish(bonusSessionId, adminSupabase);
    if (!session) {
      return NextResponse.json({ error: "Bonus-session ikke fundet." }, { status: 404 });
    }

    // ── 2. Allerede afsluttet — returnér idempotent ───────────────────────────
    if (session.status === "finished") {
      return NextResponse.json(
        {
          bonusSessionId: session.id,
          status: session.status,
          score: session.score,
          totalQuestions: session.total_questions,
          finishedAt: session.finished_at,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── 3. Afslut sessionen ───────────────────────────────────────────────────
    // Bruger eq("status", "active")-guard i SQL → idempotent ved race condition
    const finished = await finishBonusSession(bonusSessionId, adminSupabase);

    // Hvis finished er null: race condition — en anden request nåede det først.
    // Hent den opdaterede session.
    const result = finished ?? (await fetchBonusSessionForFinish(bonusSessionId, adminSupabase));

    if (!result) {
      throw new Error("Kunne ikke hente bonus-session efter afslutning.");
    }

    return NextResponse.json(
      {
        bonusSessionId: result.id,
        status: result.status,
        score: result.score,
        totalQuestions: result.total_questions,
        finishedAt: result.finished_at,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Fejl i POST /api/bonus/finish:", error);
    await logHandledServerError({
      route: "/api/bonus/finish",
      method: "POST",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Kunne ikke afslutte bonus-session." },
      { status: 500 }
    );
  }
}
