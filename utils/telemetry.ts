// Telemetry: fire-and-forget client-side event logger.
// Two built-in guards keep this from spamming the server:
//   Klippekort — max SESSION_LIMIT calls per browser session (across all event types)
//   Karantæne  — same event_type can only be sent once per QUARANTINE_MS

const SESSION_LIMIT = 8;
const QUARANTINE_MS = 60_000;

let sessionCallCount = 0;
const lastSentAt = new Map<string, number>();

export function sendTelemetry(
  event_type: string,
  data: {
    participant_id?: string | null;
    session_id?: string | null;
    message?: string;
  } = {}
): void {
  // Klippekort: hard cap per browser session
  if (sessionCallCount >= SESSION_LIMIT) return;

  // Karantæne: same event_type may not fire more than once per 60s
  const last = lastSentAt.get(event_type);
  if (last !== undefined && Date.now() - last < QUARANTINE_MS) return;

  sessionCallCount++;
  lastSentAt.set(event_type, Date.now());

  const body = JSON.stringify({
    event_type,
    participant_id: data.participant_id ?? null,
    session_id: data.session_id ?? null,
    message: data.message ?? null,
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // Beacon: browser queues this outside the JS event loop — true fire-and-forget
      navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" }));
    } else {
      // Fallback: keepalive ensures the request survives page unload
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently swallow — telemetry must never throw or affect the caller
  }
}
