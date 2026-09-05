import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { FOCUS_MODE_GRACE_MS, type FocusParticipantPolicy, type FocusParticipantSummary, type FocusReturnEvent } from "@/lib/focusMode";

export type FocusDatabase = NonNullable<ReturnType<typeof createAdminClient>>;
export type FocusSession = { id: string; run_id: string; teacher_id: string; status: string; created_at: string };
type FocusSessionSettings = { session_id: string; enabled: boolean; revision: string; expires_at: string };
type FocusParticipantRow = {
  participant_id: string;
  excluded: boolean;
  revision: number;
  event_count: number;
  latest_event_at: string | null;
  latest_duration_ms: number | null;
};
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;
const ACTIVE_STATUSES = new Set(["waiting", "scheduled", "running", "active", "paused"]);

export function isFocusModeAvailable() {
  return process.env.FOCUS_MODE_DISABLED?.trim().toLowerCase() !== "true";
}

export async function readFocusRun(db: FocusDatabase, runId: string) {
  const { data, error } = await db.from("focus_run_settings").select("enabled").eq("run_id", runId).maybeSingle<{ enabled: boolean }>();
  if (error) throw new Error("Focus settings unavailable");
  return data?.enabled === true;
}

export async function writeFocusRun(db: FocusDatabase, runId: string, enabled: boolean) {
  const { error } = await db.from("focus_run_settings").upsert({ run_id: runId, enabled, updated_at: new Date().toISOString() }, { onConflict: "run_id" });
  if (error) throw new Error("Focus settings unavailable");
}

export async function readFocusSession(db: FocusDatabase, sessionId: string): Promise<FocusSession | null> {
  const { data, error } = await db.from("live_sessions").select("id,run_id,teacher_id,status,created_at").eq("id", sessionId).maybeSingle<FocusSession>();
  if (error) throw new Error("Focus session unavailable");
  return data;
}

/** Lazy, isolated snapshot. Never called from join/session creation or GPS routes. */
export async function ensureFocusSession(db: FocusDatabase, session: FocusSession): Promise<FocusSessionSettings | null> {
  const expiresAtMs = Date.parse(session.created_at) + SESSION_TTL_MS;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;
  const existing = await db.from("focus_session_settings").select("session_id,enabled,revision,expires_at").eq("session_id", session.id).maybeSingle<FocusSessionSettings>();
  if (existing.error) throw new Error("Focus settings unavailable");
  if (existing.data) return existing.data;
  if (!ACTIVE_STATUSES.has(session.status)) return null;
  const enabled = await readFocusRun(db, session.run_id);
  const { error } = await db.from("focus_session_settings").upsert({
    session_id: session.id, enabled, expires_at: new Date(expiresAtMs).toISOString(),
  }, { onConflict: "session_id", ignoreDuplicates: true });
  if (error) throw new Error("Focus settings unavailable");
  const result = await db.from("focus_session_settings").select("session_id,enabled,revision,expires_at").eq("session_id", session.id).maybeSingle<FocusSessionSettings>();
  if (result.error) throw new Error("Focus settings unavailable");
  return result.data;
}

export async function readFocusParticipantPolicy(db: FocusDatabase, session: FocusSession, participantId: string): Promise<FocusParticipantPolicy> {
  const settings = await ensureFocusSession(db, session);
  const [summary, participant] = await Promise.all([
    db.from("focus_participant_state").select("excluded,revision").eq("session_id", session.id).eq("participant_id", participantId).maybeSingle<Pick<FocusParticipantRow, "excluded" | "revision">>(),
    db.from("participants").select("finished_at").eq("session_id", session.id).eq("id", participantId).maybeSingle<{ finished_at: string | null }>(),
  ]);
  if (summary.error || participant.error) throw new Error("Focus policy unavailable");
  const enabled = settings?.enabled === true && Date.parse(settings.expires_at) > Date.now();
  const exempt = summary.data?.excluded === true;
  return {
    available: true, enabled, exempt,
    tracking: enabled && !exempt && ["running", "active"].includes(session.status) && !!participant.data && !participant.data.finished_at,
    policyRevision: settings ? `${settings.revision}:${summary.data?.revision ?? 0}` : null,
    graceMs: FOCUS_MODE_GRACE_MS,
  };
}

export async function readFocusTeacherSession(db: FocusDatabase, session: FocusSession) {
  const settings = await ensureFocusSession(db, session);
  const [states, participants] = await Promise.all([
    db.from("focus_participant_state").select("participant_id,excluded,revision,event_count,latest_event_at,latest_duration_ms").eq("session_id", session.id),
    db.from("participants").select("id,student_name").eq("session_id", session.id),
  ]);
  if (states.error || participants.error) throw new Error("Focus summary unavailable");
  const byId = new Map((states.data as FocusParticipantRow[] ?? []).map(row => [row.participant_id, row]));
  const summaries: FocusParticipantSummary[] = (participants.data ?? []).map(participant => {
    const state = byId.get(participant.id);
    return {
      participantId: participant.id, displayName: participant.student_name,
      excluded: state?.excluded === true, eventCount: state?.event_count ?? 0,
      latestEventAt: state?.latest_event_at ?? null, latestDurationMs: state?.latest_duration_ms ?? null,
    };
  });
  return { available: true, enabled: settings?.enabled === true, participants: summaries };
}

export async function writeFocusSession(db: FocusDatabase, session: FocusSession, enabled: boolean) {
  const settings = await ensureFocusSession(db, session);
  if (!settings || !ACTIVE_STATUSES.has(session.status)) throw new Error("Focus session unavailable");
  const { error } = await db.from("focus_session_settings").update({ enabled, revision: randomUUID() }).eq("session_id", session.id);
  if (error) throw new Error("Focus settings unavailable");
}

export async function writeFocusExclusion(db: FocusDatabase, session: FocusSession, participantId: string, excluded: boolean) {
  const settings = await ensureFocusSession(db, session);
  if (!settings || !ACTIVE_STATUSES.has(session.status)) throw new Error("Focus session unavailable");
  const { data, error } = await db.rpc("set_focus_participant_excluded", { p_session_id: session.id, p_participant_id: participantId, p_excluded: excluded });
  if (error || data !== true) throw new Error("Focus participant unavailable");
}

export async function recordFocusReturn(db: FocusDatabase, sessionId: string, participantId: string, event: FocusReturnEvent) {
  const [sessionRevision, participantRevision] = event.policyRevision.split(":");
  const { data, error } = await db.rpc("record_focus_return", {
    p_session_id: sessionId, p_participant_id: participantId, p_event_id: event.eventId,
    p_hidden_at: event.hiddenAt, p_returned_at: event.returnedAt,
    p_session_revision: sessionRevision, p_participant_revision: Number(participantRevision),
  });
  if (error) throw new Error("Focus event unavailable");
  return data === true;
}
