/**
 * app/api/bonus/_shared.ts
 *
 * Delte typer og hjælpefunktioner til bonus-API-ruter.
 * Ingen Supabase-kald i denne fil — kun rene typer og pure helpers.
 *
 * SIKKERHEDSREGEL: correct_index MÅ ALDRIG returneres til klienten.
 * Brug toClientSafeQuestion() til at strenge dette.
 */

import { createAdminClient } from "@/utils/supabase/admin";

// ============================================================================
// Konstanter
// ============================================================================

export const MAX_STUDENT_NAME_LENGTH = 100;

// ============================================================================
// Typer
// ============================================================================

export type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

/** Rå DB-rad fra bonus_questions — indeholder correct_index */
export type BonusQuestionRow = {
  id: string;
  gps_run_id: string;
  question_index: number;
  source_post_index: number | null;
  variant: string;
  question_text: string;
  answers: unknown;           // jsonb → string[] efter parsing
  correct_index: number;      // ⚠️ ALDRIG til klienten
  points: number;
  media_url: string | null;
  created_at: string;
};

/** Klientsikker version af bonus_questions — uden correct_index */
export type BonusQuestionClientSafe = {
  id: string;
  questionIndex: number;
  sourcePostIndex: number | null;
  variant: string;
  questionText: string;
  answers: string[];
  points: number;
  mediaUrl: string | null;
};

/** Rå DB-rad fra live_sessions til bonus-opslag */
export type LiveSessionBonusRow = {
  run_id: string | null;
};

/** Rå DB-rad fra gps_runs til bonus-opslag */
export type GpsRunBonusRow = {
  bonus_enabled: boolean | null;
  questions: unknown;
  race_type: string | null;
};

/** Rå DB-rad fra bonus_sessions */
export type BonusSessionRow = {
  id: string;
  live_session_id: string;
  gps_run_id: string;
  student_name: string;
  participant_id: string | null;
  current_index: number;
  score: number;
  total_questions: number;
  status: string;
  started_at: string;
  finished_at: string | null;
};

// ============================================================================
// Rene hjælpefunktioner (ingen side-effects)
// ============================================================================

/** Sikker trimmet string — identisk med mønstret i play/_shared.ts */
export function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Omdanner en gps_run UUID til et deterministisk heltalsseed.
 * Samme runId → samme seed → samme spørgsmålsrækkefølge for alle elever.
 *
 * Algoritme: tag de første 8 hex-cifre af UUID'et (uden bindestreger),
 * parse som hexadecimalt tal.
 */
export function runIdToSeed(runId: string): number {
  const hex = runId.replace(/-/g, "").slice(0, 8);
  const parsed = parseInt(hex, 16);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 42;
}

/**
 * Fjerner correct_index og mapper snake_case til camelCase.
 * Dette er det eneste sted, vi stripper correct_index fra.
 * Kald denne funktion på ALLE bonus_questions-rækker inden de sendes til klienten.
 */
export function toClientSafeQuestion(row: BonusQuestionRow): BonusQuestionClientSafe {
  return {
    id: row.id,
    questionIndex: row.question_index,
    sourcePostIndex: row.source_post_index ?? null,
    variant: row.variant,
    questionText: row.question_text,
    answers: Array.isArray(row.answers) ? [...(row.answers as string[])] : [],
    points: row.points,
    mediaUrl: row.media_url ?? null,
    // correct_index: UDELADT BEVIDST
  };
}

// ============================================================================
// Leaderboard-typer og ren helper (eksporteres til tests og leaderboard/route.ts)
// ============================================================================

/** Rå DB-rad fra bonus_sessions til leaderboard */
export type BonusLeaderboardRow = {
  id: string;
  student_name: string;
  score: number;
  total_questions: number;
  finished_at: string | null;
};

/** Klientsikkert leaderboard-entry (camelCase) */
export type LeaderboardEntry = {
  rank: number;
  studentName: string;
  score: number;
  totalQuestions: number;
  finishedAt: string | null;
};

/**
 * Tildeler 1-baserede rang-numre til en liste af bonus-sessions.
 * Forudsætter at arrayet allerede er sorteret (score desc, finished_at asc).
 * Ren funktion uden side-effects — testbar uden Supabase.
 */
export function rankBonusLeaderboard(rows: BonusLeaderboardRow[]): LeaderboardEntry[] {
  return rows.map((row, idx) => ({
    rank: idx + 1,
    studentName: row.student_name,
    score: row.score,
    totalQuestions: row.total_questions,
    finishedAt: row.finished_at ?? null,
  }));
}

// ============================================================================
// DB-hjælpefunktioner (bruger adminSupabase)
// ============================================================================

/**
 * Finder run_id for en live_session.
 * Returnerer null hvis session ikke eksisterer.
 * Kaster ved DB-fejl.
 */
export async function fetchLiveSessionRunId(
  sessionId: string,
  adminSupabase: AdminSupabaseClient
): Promise<string | null> {
  const { data, error } = await adminSupabase
    .from("live_sessions")
    .select("run_id")
    .eq("id", sessionId)
    .maybeSingle<LiveSessionBonusRow>();

  if (error) throw new Error(error.message);
  return asTrimmedString(data?.run_id) || null;
}

/**
 * Henter gps_run med bonus-relevante felter.
 * Returnerer null hvis run ikke eksisterer.
 * Kaster ved DB-fejl.
 */
export async function fetchGpsRunForBonus(
  runId: string,
  adminSupabase: AdminSupabaseClient
): Promise<GpsRunBonusRow | null> {
  const { data, error } = await adminSupabase
    .from("gps_runs")
    .select("bonus_enabled, questions, race_type")
    .eq("id", runId)
    .maybeSingle<GpsRunBonusRow>();

  if (error) throw new Error(error.message);
  return data ?? null;
}
