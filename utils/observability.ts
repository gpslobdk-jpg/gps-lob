import * as Sentry from "@sentry/nextjs";
import { sendTelemetry } from "@/utils/telemetry";

let bugsnagClient: any = null;

export function ensureBugsnag(): void {
  if (typeof window === "undefined") return;
  if (bugsnagClient) return;

  const key = process.env.NEXT_PUBLIC_BUGSNAG_API_KEY;
  if (!key) return;

  // Lazy/dynamic import so missing env or package won't break the build/runtime.
  void import("@bugsnag/js")
    .then((mod) => {
      try {
        const Bugsnag = (mod as any).default ?? mod;
        bugsnagClient = Bugsnag.start({
          apiKey: key,
          appVersion: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
          releaseStage: process.env.NODE_ENV || "development",
          onError(event: any) {
            // Drop unhandled SW registration rejections.
            // @ducanh2912/next-pwa injects navigator.serviceWorker.register()
            // without a .catch(), so iOS private browsing, MDM restrictions,
            // storage quota errors etc. surface as unhandled promise rejections.
            // The app works normally (NetworkOnly fallback); this is pure noise.
            // Mirrors the equivalent beforeSend filter in instrumentation-client.ts.
            if (event.unhandledRejection === true) {
              const isSwRejection = (event.errors ?? []).some(
                (e: any) =>
                  e.errorMessage?.includes("serviceWorker") ||
                  e.errorMessage?.includes("sw.js") ||
                  (e.errorClass === "SecurityError" &&
                    (e.errorMessage?.includes("sw") ||
                      e.errorMessage?.includes("register")))
              );
              if (isSwRejection) return false;
            }
          },
        });
      } catch (_) {
        // best-effort
      }
    })
    .catch(() => {});
}

function isSensitiveKey(key: string) {
  const lower = key.toLowerCase();
  // Allow session/participant id fields to pass through (IDs are often useful),
  // but redact raw session objects or keys that directly contain sensitive data.
  if (lower === "sessionid" || lower === "session_id" || lower === "participantid" || lower === "participant_id") {
    return false;
  }

  return /(^|_|-|\b)(name|student|pin|token|access_token|refresh_token|jwt|gps|lat|lng|latitude|longitude|coords|location|session|participant|supabase|answer|photo|image|file)/i.test(
    key
  );
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    let s = value;
    s = s.replace(/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "<redacted-token>");
    s = s.replace(/\b[A-Za-z0-9+/=_-]{40,}\b/g, "<redacted-base64>");
    s = s.replace(/\b0x?[A-Fa-f0-9]{32,}\b/g, "<redacted-hex>");
    s = s.replace(/\b[A-Za-z0-9]{33,}\b/g, "<redacted-long>");
    s = s.replace(/\s+/g, " ").trim();
    if (s.length > 300) s = s.slice(0, 300) + "…";
    return s;
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === "object" && value !== null) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        obj[k] = typeof v === "string" ? "[redacted]" : null;
      } else {
        obj[k] = sanitizeValue(v);
      }
    }
    return obj;
  }

  return null;
}

export function sanitizePayload(payload: unknown): unknown {
  return sanitizeValue(payload);
}

export function captureAppError(error: unknown, context?: Record<string, unknown>): void {
  try {
    const safeContext = sanitizePayload(context ?? {}) as Record<string, unknown>;
    const safeErrorMessage = typeof error === "string" ? (sanitizeValue(error) as string) : error instanceof Error ? (sanitizeValue(error.message) as string) : undefined;

    try {
      Sentry.withScope((scope) => {
        try {
          scope.setExtras({ ...(safeContext as { [key: string]: unknown }), sanitized_message: safeErrorMessage });
        } catch (_) {}
        Sentry.captureException(error as Error);
      });
    } catch (_) {}

    try {
      ensureBugsnag();
      if (bugsnagClient && typeof bugsnagClient.notify === "function") {
        bugsnagClient.notify(error, { metaData: { context: safeContext, sanitized_message: safeErrorMessage } });
      }
    } catch (_) {}
  } catch (_) {}
}

export function captureAppMessage(message: string, context?: Record<string, unknown>): void {
  try {
    const safeContext = sanitizePayload(context ?? {}) as Record<string, unknown>;
    const safeMessage = typeof message === "string" ? (sanitizeValue(message) as string) : String(message);

    try {
      Sentry.withScope((scope) => {
        try {
          scope.setExtras(safeContext as { [key: string]: unknown });
        } catch (_) {}
        Sentry.captureMessage(safeMessage);
      });
    } catch (_) {}

    try {
      ensureBugsnag();
      if (bugsnagClient && typeof bugsnagClient.notify === "function") {
        bugsnagClient.notify(new Error(safeMessage), { metaData: { context: safeContext } });
      }
    } catch (_) {}
  } catch (_) {}
}

export function leaveAppBreadcrumb(name: string, data?: Record<string, unknown>): void {
  try {
    const safeData = sanitizePayload(data ?? {}) as Record<string, unknown>;

    try {
      if (typeof Sentry.addBreadcrumb === "function") {
        Sentry.addBreadcrumb({ category: "app", message: name, data: safeData });
      }
    } catch (_) {}

    try {
      ensureBugsnag();
      if (bugsnagClient && typeof bugsnagClient.leaveBreadcrumb === "function") {
        bugsnagClient.leaveBreadcrumb(name, safeData);
      }
    } catch (_) {}
  } catch (_) {}
}

export function trackAppEvent(eventName: string, data?: Record<string, unknown>): void {
  try {
    const safeData = sanitizePayload(data ?? {}) as Record<string, unknown>;

    try {
      // Reuse existing client-side sendTelemetry which posts to /api/telemetry
      // Server has an allowlist; we keep using it to avoid duplicate server-side changes.
      sendTelemetry(eventName, {
        session_id: typeof (safeData as any).sessionId === "string" ? (safeData as any).sessionId : undefined,
        participant_id:
          typeof (safeData as any).participantId === "string" ? (safeData as any).participantId : undefined,
        message: JSON.stringify(safeData),
      });
    } catch (_) {}

    try {
      // Also leave a breadcrumb so that events are visible in both Sentry and Bugsnag timelines
      leaveAppBreadcrumb(eventName, safeData as Record<string, unknown>);
    } catch (_) {}
  } catch (_) {}
}

export default {
  ensureBugsnag,
  captureAppError,
  captureAppMessage,
  leaveAppBreadcrumb,
  trackAppEvent,
  sanitizePayload,
};
