/**
 * offlineSync.ts – Offline answer queue with automatic retry.
 *
 * When a submit-answer or validate-answer request fails due to connectivity,
 * the answer payload is stored in localStorage. A retry loop flushes the
 * queue whenever:
 *   • navigator.onLine transitions from false → true
 *   • every 10 seconds while items remain in the queue
 *
 * The queue is keyed per session + participant so multiple students on
 * the same device don't collide.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OfflineQueueEntry {
  id: string;
  /** The full request body that was originally sent to /api/play/submit-answer. */
  payloads: Record<string, unknown>[];
  /** ISO timestamp when the student originally answered. */
  submittedAt: string;
  /** Post index for dedup/display purposes. */
  postIndex: number;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "gpslob_offline_answer_queue";

function readQueue(): OfflineQueueEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineQueueEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full — silently ignore; the in-memory queue is still intact.
  }
}

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

let memoryQueue: OfflineQueueEntry[] = readQueue();
let listeners: Array<(queue: OfflineQueueEntry[]) => void> = [];

function notify() {
  for (const fn of listeners) {
    try { fn([...memoryQueue]); } catch { /* listener error */ }
  }
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribeToQueue(fn: (queue: OfflineQueueEntry[]) => void): () => void {
  listeners.push(fn);
  // Immediately notify with current state.
  fn([...memoryQueue]);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/** Enqueue a failed answer for later retry. */
export function enqueueAnswer(entry: OfflineQueueEntry): void {
  // Prevent duplicate entries for the same post.
  if (memoryQueue.some((e) => e.id === entry.id)) return;
  memoryQueue.push(entry);
  writeQueue(memoryQueue);
  notify();
}

/** Remove a successfully synced entry. */
function dequeueAnswer(id: string): void {
  memoryQueue = memoryQueue.filter((e) => e.id !== id);
  writeQueue(memoryQueue);
  notify();
}

/** Number of pending entries (for UI badge). */
export function getPendingCount(): number {
  return memoryQueue.length;
}

// ---------------------------------------------------------------------------
// Network error detection
// ---------------------------------------------------------------------------

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network request failed") ||
      msg.includes("load failed")
    );
  }
  if (err instanceof DOMException && err.name === "AbortError") return true;
  return false;
}

// ---------------------------------------------------------------------------
// Flush loop – tries to POST each queued entry
// ---------------------------------------------------------------------------

let flushInProgress = false;

async function flushQueue(): Promise<void> {
  if (flushInProgress) return;
  if (memoryQueue.length === 0) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  flushInProgress = true;

  try {
    // Process a snapshot so new items added mid-flush don't cause issues.
    const snapshot = [...memoryQueue];
    for (const entry of snapshot) {
      try {
        const res = await fetch("/api/play/submit-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payloads: entry.payloads }),
        });
        if (res.ok) {
          dequeueAnswer(entry.id);
        } else {
          // Non-network error (4xx/5xx) — keep trying later rather than discard.
          console.warn("[offlineSync] Server rejected queued answer:", res.status);
        }
      } catch (err) {
        if (isNetworkError(err)) {
          // Still offline — stop trying.
          break;
        }
        console.warn("[offlineSync] Unexpected flush error:", err);
      }
    }
  } finally {
    flushInProgress = false;
  }
}

// ---------------------------------------------------------------------------
// Auto-retry: online events + interval timer
// ---------------------------------------------------------------------------

let intervalId: ReturnType<typeof setInterval> | null = null;
let initialized = false;

/** Call once at app startup (idempotent). Sets up event listeners + timer. */
export function initOfflineSyncLoop(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;

  initialized = true;

  // Re-read from storage on init (in case another tab wrote).
  memoryQueue = readQueue();
  notify();

  // navigator.onLine → flush
  window.addEventListener("online", () => {
    void flushQueue();
  });

  // Periodic retry every 10 seconds
  intervalId = setInterval(() => {
    void flushQueue();
  }, 10_000);

  // Immediate first flush attempt
  void flushQueue();
}

/** Tear down (useful for tests / HMR). */
export function destroyOfflineSyncLoop(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  initialized = false;
}
