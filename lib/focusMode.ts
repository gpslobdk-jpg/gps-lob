/** Optional visibility information. These settings never control gameplay. */
export const FOCUS_MODE_GRACE_MS = 3_000;
export const FOCUS_MODE_MAX_DURATION_MS = 30 * 60_000;
export const FOCUS_MODE_POLICY_MAX_AGE_MS = 30_000;
export const FOCUS_MODE_POLL_MS = 10_000;

export type FocusParticipantPolicy = {
  available: boolean;
  enabled: boolean;
  exempt: boolean;
  tracking: boolean;
  policyRevision: string | null;
  graceMs: number;
};

export type FocusParticipantSummary = {
  participantId: string;
  displayName: string;
  excluded: boolean;
  eventCount: number;
  latestEventAt: string | null;
  latestDurationMs: number | null;
};

export const FOCUS_MODE_UNAVAILABLE: FocusParticipantPolicy = {
  available: false,
  enabled: false,
  exempt: false,
  tracking: false,
  policyRevision: null,
  graceMs: FOCUS_MODE_GRACE_MS,
};

export function isFocusUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type FocusReturnEvent = {
  eventId: string;
  hiddenAt: string;
  returnedAt: string;
  durationMs: number;
  policyRevision: string;
};

/** Reject delayed/replayed/noisy intervals; no URLs or device information are accepted. */
export function parseFocusReturnEvent(value: unknown, nowMs = Date.now()): FocusReturnEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (!isFocusUuid(item.eventId) || typeof item.policyRevision !== "string") return null;
  const [sessionRevision, participantRevision, extra] = item.policyRevision.split(":");
  if (!isFocusUuid(sessionRevision) || !/^\d{1,9}$/.test(participantRevision ?? "") || extra !== undefined) return null;
  if (typeof item.hiddenAt !== "string" || typeof item.returnedAt !== "string") return null;
  if (typeof item.durationMs !== "number" || !Number.isSafeInteger(item.durationMs)) return null;
  const hiddenMs = Date.parse(item.hiddenAt);
  const returnedMs = Date.parse(item.returnedAt);
  const duration = returnedMs - hiddenMs;
  if (!Number.isFinite(hiddenMs) || !Number.isFinite(returnedMs)) return null;
  if (duration < FOCUS_MODE_GRACE_MS || duration > FOCUS_MODE_MAX_DURATION_MS) return null;
  if (Math.abs(duration - item.durationMs) > 1_000) return null;
  if (returnedMs > nowMs + 5_000 || returnedMs < nowMs - 60_000) return null;
  return {
    eventId: item.eventId,
    hiddenAt: new Date(hiddenMs).toISOString(),
    returnedAt: new Date(returnedMs).toISOString(),
    durationMs: Math.round(duration),
    policyRevision: item.policyRevision,
  };
}
