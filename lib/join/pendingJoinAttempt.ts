export const PENDING_JOIN_ATTEMPT_STORAGE_KEY = "gpslob_pending_join_attempt";
const JOIN_ATTEMPT_LOCK_PREFIX = "gpslob_pending_join_lock";
const JOIN_ATTEMPT_LOCK_LEASE_MS = 30_000;
const JOIN_ATTEMPT_LOCK_RETRY_MS = 60;
const JOIN_ATTEMPT_LOCK_MAX_WAIT_MS = 12_000;

export type PendingJoinAttempt = {
  participantId: string;
  sessionId: string;
  studentName: string;
  createdAt: string;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createAttemptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error("Browseren kan ikke oprette en sikker tilmeldingsidentitet.");
}

export function readPendingJoinAttempt(): PendingJoinAttempt | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PENDING_JOIN_ATTEMPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingJoinAttempt>;
    const participantId = asTrimmedString(parsed.participantId);
    const sessionId = asTrimmedString(parsed.sessionId);
    const studentName = asTrimmedString(parsed.studentName);
    const createdAt = asTrimmedString(parsed.createdAt);

    if (!participantId || !sessionId || !studentName || !createdAt) return null;
    return { participantId, sessionId, studentName, createdAt };
  } catch {
    return null;
  }
}

export function getOrCreatePendingJoinAttempt(
  sessionId: string,
  studentName: string,
  now = new Date().toISOString()
): PendingJoinAttempt {
  const normalizedSessionId = asTrimmedString(sessionId);
  const normalizedStudentName = asTrimmedString(studentName);
  if (!normalizedSessionId || !normalizedStudentName) {
    throw new Error("Session eller holdnavn mangler.");
  }

  const existing = readPendingJoinAttempt();
  if (
    existing &&
    existing.sessionId === normalizedSessionId &&
    existing.studentName === normalizedStudentName
  ) {
    return existing;
  }

  const next: PendingJoinAttempt = {
    participantId: createAttemptId(),
    sessionId: normalizedSessionId,
    studentName: normalizedStudentName,
    createdAt: now,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PENDING_JOIN_ATTEMPT_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Kunne ikke gemme tilmeldingsforsøget lokalt:", error);
    }
  }

  return next;
}

/** Clear only the confirmed attempt so another active join is never erased. */
export function clearPendingJoinAttempt(participantId?: string | null) {
  if (typeof window === "undefined") return;

  try {
    const existing = readPendingJoinAttempt();
    if (participantId && existing?.participantId !== participantId) return;
    window.localStorage.removeItem(PENDING_JOIN_ATTEMPT_STORAGE_KEY);
  } catch (error) {
    console.warn("Kunne ikke rydde tilmeldingsforsøget lokalt:", error);
  }
}

type JoinAttemptLock = {
  owner: string;
  expiresAt: number;
};

function readJoinAttemptLock(key: string): JoinAttemptLock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JoinAttemptLock>;
    if (typeof parsed.owner !== "string" || typeof parsed.expiresAt !== "number") return null;
    return { owner: parsed.owner, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function waitForJoinAttemptLock(delayMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

/**
 * Serializes the same pending join in tabs sharing this browser. The database
 * still enforces the final id collision boundary; this only prevents two tabs
 * from racing their first participant-auth cookie.
 */
export async function withPendingJoinAttemptLock<T>(
  participantId: string,
  task: () => Promise<T>
): Promise<T> {
  if (typeof window === "undefined") return await task();

  const lockName = `${JOIN_ATTEMPT_LOCK_PREFIX}:${participantId}`;
  const lockManager = (navigator as Navigator & {
    locks?: { request: <TResult>(name: string, callback: () => Promise<TResult>) => Promise<TResult> };
  }).locks;

  if (lockManager?.request) {
    return await lockManager.request(lockName, task);
  }

  const storageKey = lockName;
  const owner = createAttemptId();
  const deadline = Date.now() + JOIN_ATTEMPT_LOCK_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const existing = readJoinAttemptLock(storageKey);
    if (!existing || existing.expiresAt <= Date.now()) {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ owner, expiresAt: Date.now() + JOIN_ATTEMPT_LOCK_LEASE_MS })
        );
      } catch {
        return await task();
      }

      // Let a simultaneous writer settle before treating the lease as ours.
      await waitForJoinAttemptLock(16);
      if (readJoinAttemptLock(storageKey)?.owner === owner) {
        try {
          return await task();
        } finally {
          try {
            if (readJoinAttemptLock(storageKey)?.owner === owner) {
              window.localStorage.removeItem(storageKey);
            }
          } catch {
            // An expired local lease is safe to leave for its short lifetime.
          }
        }
      }
    }

    await waitForJoinAttemptLock(JOIN_ATTEMPT_LOCK_RETRY_MS);
  }

  // Availability wins after a bounded wait. The server-side participant id
  // collision and auth ownership checks still prevent a second participant.
  return await task();
}
