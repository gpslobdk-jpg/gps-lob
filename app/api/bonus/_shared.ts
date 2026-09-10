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

/**
 * A participant row as far as the bonus game needs to know it. Bonus data has
 * historically been name-based, so this deliberately contains no more student
 * data than is needed to keep a removed participant out of the side game.
 */
export type BonusParticipantRow = {
  id: string;
  session_id: string;
  student_name: string | null;
  removed_at: string | null;
};

/**
 * Bonus was originally allowed to be entirely anonymous. New play links carry
 * a participant id, while a legacy URL is only associated when its name maps
 * unambiguously to one active participant in this session. A legacy URL may
 * be anonymous only in an otherwise participant-free session; it must not be
 * a way to sidestep a removed participant by changing the displayed name.
 */
export type BonusParticipantAccess =
  | { kind: "active"; participantId: string; studentName: string }
  | { kind: "anonymous"; studentName: string }
  | { kind: "removed" }
  | { kind: "missing" }
  | { kind: "ambiguous" };

// ============================================================================
// Rene hjælpefunktioner (ingen side-effects)
// ============================================================================

/** Sikker trimmet string — identisk med mønstret i play/_shared.ts */
export function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedBonusStudentName(value: unknown) {
  return asTrimmedString(value).toLocaleLowerCase("da-DK");
}

/**
 * Resolve whether a bonus request belongs to an active participant. The
 * fallback intentionally never resumes a name that also belongs to a removed
 * participant: without a durable id, that would make soft removal reversible.
 */
export async function resolveBonusParticipantAccess(
  sessionId: string,
  requestedParticipantId: string | null | undefined,
  requestedStudentName: string,
  adminSupabase: AdminSupabaseClient
): Promise<BonusParticipantAccess> {
  const participantId = asTrimmedString(requestedParticipantId);

  if (participantId) {
    const { data, error } = await adminSupabase
      .from("participants")
      .select("id,session_id,student_name,removed_at")
      .eq("id", participantId)
      .eq("session_id", sessionId)
      .maybeSingle<BonusParticipantRow>();

    if (error) throw new Error(error.message);
    if (!data?.id) return { kind: "missing" };
    if (data.removed_at) return { kind: "removed" };

    return {
      kind: "active",
      participantId: data.id,
      studentName: asTrimmedString(data.student_name) || requestedStudentName,
    };
  }

  const { data, error } = await adminSupabase
    .from("participants")
    .select("id,session_id,student_name,removed_at")
    .eq("session_id", sessionId);

  if (error) throw new Error(error.message);

  const sessionParticipants = (data ?? []) as BonusParticipantRow[];
  const requestedName = normalizedBonusStudentName(requestedStudentName);
  const matchingParticipants = sessionParticipants.filter(
    (participant) => normalizedBonusStudentName(participant.student_name) === requestedName
  );
  if (matchingParticipants.some((participant) => Boolean(participant.removed_at))) {
    return { kind: "removed" };
  }

  const activeParticipants = matchingParticipants.filter((participant) => Boolean(participant.id));
  if (activeParticipants.length === 1) {
    const participant = activeParticipants[0]!;
    return {
      kind: "active",
      participantId: participant.id,
      studentName: asTrimmedString(participant.student_name) || requestedStudentName,
    };
  }

  if (activeParticipants.length > 1) return { kind: "ambiguous" };
  if (sessionParticipants.length > 0) return { kind: "missing" };
  return { kind: "anonymous", studentName: requestedStudentName };
}

/** Re-check an established bonus session before it can change score or state. */
export async function resolveBonusSessionParticipantAccess(
  session: Pick<BonusSessionRow, "live_session_id" | "participant_id" | "student_name">,
  adminSupabase: AdminSupabaseClient
) {
  return resolveBonusParticipantAccess(
    session.live_session_id,
    session.participant_id,
    session.student_name,
    adminSupabase
  );
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
  participant_id?: string | null;
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

/**
 * Soft removal must also remove a participant from the optional bonus result.
 * A legacy row with no participant id remains visible only when its name does
 * not collide with a removed participant in the same live session.
 */
export function filterRemovedBonusLeaderboardRows(
  rows: BonusLeaderboardRow[],
  participants: BonusParticipantRow[]
) {
  const activeParticipantIds = new Set(
    participants.filter((participant) => !participant.removed_at).map((participant) => participant.id)
  );
  const removedNames = new Set(
    participants
      .filter((participant) => Boolean(participant.removed_at))
      .map((participant) => normalizedBonusStudentName(participant.student_name))
      .filter(Boolean)
  );

  return rows.filter((row) => {
    const participantId = asTrimmedString(row.participant_id);
    if (participantId) return activeParticipantIds.has(participantId);
    return !removedNames.has(normalizedBonusStudentName(row.student_name));
  });
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
