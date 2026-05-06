/**
 * GET /api/bonus/leaderboard
 *
 * Henter bonus-ranglisten for en live session.
 * Kun afsluttede bonus-sessioner inkluderes.
 *
 * Query-params:
 *   sessionId  string  — live session UUID (required)
 *
 * Sikkerhed:
 *   - Bruger KUN bonus_sessions — ingen participants, ingen answers
 *   - Returnerer IKKE correct_index (bonus_answers hentes ikke)
 *   - bonus_enabled er irrelevant her — leaderboard er offentlig bonus-data
 *
 * Sortering:
 *   1. score DESC (højest score øverst)
 *   2. finished_at ASC (tidligst færdig ved pointlighed)
 *
 * Cache:
 *   - 5 sekunders polling-cache (leaderboard opdateres løbende)
 */

import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ACCESS_MISSING_MESSAGE, createAdminClient } from "@/utils/supabase/admin";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";
import {
  asTrimmedString,
  rankBonusLeaderboard,
  type AdminSupabaseClient,
  type BonusLeaderboardRow,
} from "@/app/api/bonus/_shared";

export const runtime = "edge";

// ============================================================================
// DB-hjælpere
// ============================================================================

async function fetchBonusLeaderboard(
  liveSessionId: string,
  adminSupabase: AdminSupabaseClient
): Promise<BonusLeaderboardRow[]> {
  // Hent kun afsluttede sessioner, sorteret i DB
  const { data, error } = await adminSupabase
    .from("bonus_sessions")
    .select("id,student_name,score,total_questions,finished_at")
    .eq("live_session_id", liveSessionId)
    .eq("status", "finished")
    .order("score", { ascending: false })
    .order("finished_at", { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as BonusLeaderboardRow[];
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

    // Bemærk: Vi validerer ikke om live_session eksisterer —
    // en tom leaderboard er et gyldigt svar for en session uden bonus-deltagere.
    // Dette reducerer latency og DB-kald for polling-scenariet.

    const rows = await fetchBonusLeaderboard(sessionId, adminSupabase);
    const leaderboard = rankBonusLeaderboard(rows);

    return NextResponse.json(
      {
        leaderboard,
        totalParticipants: leaderboard.length,
      },
      {
        headers: {
          // 5-sekunders polling-cache — leaderboard er ikke realtime
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === ADMIN_ACCESS_MISSING_MESSAGE) {
      return NextResponse.json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, { status: 503 });
    }

    console.error("Fejl i GET /api/bonus/leaderboard:", error);
    await logHandledServerError({
      route: "/api/bonus/leaderboard",
      method: "GET",
      status: 500,
      error,
      requestPath,
      routeType: "route",
    });
    return NextResponse.json(
      { error: "Kunne ikke hente bonus-ranglisten." },
      { status: 500 }
    );
  }
}
