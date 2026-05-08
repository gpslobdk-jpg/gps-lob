import * as Sentry from "@sentry/nextjs";
import { createClientTelemetryMessage, sendTelemetry } from "@/utils/telemetry";
import { leaveAppBreadcrumb } from "@/utils/observability";

const LOCK_FINGERPRINT = /lock|stolen|steal/i;

function sanitizeMessage(raw: string, maxLen = 160) {
  if (!raw) return "";
  let s = String(raw);

  // Replace common token-like patterns with safe placeholders
  // 1) JWT-like (three base64url parts separated by dots)
  s = s.replace(/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "<redacted-token>");

  // 2) Long base64/base64url-like strings
  s = s.replace(/\b[A-Za-z0-9+/=_-]{40,}\b/g, "<redacted-base64>");

  // 3) Long hex strings (optionally prefixed with 0x)
  s = s.replace(/\b0x?[A-Fa-f0-9]{32,}\b/g, "<redacted-hex>");

  // 4) Long alphanumeric sequences (>32 chars)
  s = s.replace(/\b[A-Za-z0-9]{33,}\b/g, "<redacted-long>");

  // Collapse whitespace and trim
  s = s.replace(/\s+/g, " ").trim();

  if (s.length > maxLen) {
    return s.slice(0, maxLen).trim() + "…";
  }

  return s;
}

export async function authWithLockRetry<T>(
  fn: () => Promise<T>,
  place = "unknown",
  metadata?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const message = String(error?.message ?? error ?? "");
    const isAbortLock = error?.name === "AbortError" && LOCK_FINGERPRINT.test(message);

    if (!isAbortLock) {
      throw error;
    }

    // Sanitize error message before sending anywhere
    const sanitized = sanitizeMessage(message);
    const telemetryMessage = createClientTelemetryMessage({
      ...(metadata ? { metadata } : {}),
      place,
      reason: sanitized,
    });

    try {
      sendTelemetry?.("auth_lock_abort", { message: telemetryMessage });
    } catch (_) {
      // swallow
    }

    try {
      if (typeof Sentry?.addBreadcrumb === "function") {
        Sentry.addBreadcrumb({
          category: "auth",
          message: "auth_lock_abort",
          data: { place, message: sanitized },
        });
      }
    } catch (_) {
      // swallow
    }

    try {
      leaveAppBreadcrumb("auth_lock_abort", { place, message: sanitized });
    } catch (_) {}

    // Short backoff then retry once
    await new Promise((r) => setTimeout(r, 250));

    try {
      const result = await fn();
      try {
        sendTelemetry?.("auth_lock_retry_success", {
          message: createClientTelemetryMessage({
            ...(metadata ? { metadata } : {}),
            place,
            reason: "retry_success",
          }),
        });
      } catch (_) {}
      try {
        if (typeof Sentry?.addBreadcrumb === "function") {
          Sentry.addBreadcrumb({ category: "auth", message: "auth_lock_retry_success", data: { place } });
        }
      } catch (_) {}
      try {
        leaveAppBreadcrumb("auth_lock_retry_success", { place });
      } catch (_) {}
      return result;
    } catch (err2: any) {
      try {
        const sanitizedErrMsg = sanitizeMessage(String(err2?.message ?? err2));
        sendTelemetry?.("auth_lock_retry_failed", {
          message: createClientTelemetryMessage({
            ...(metadata ? { metadata } : {}),
            place,
            reason: sanitizedErrMsg,
          }),
        });
      } catch (_) {}
      try {
        if (typeof Sentry?.addBreadcrumb === "function") {
          Sentry.addBreadcrumb({
            category: "auth",
            message: "auth_lock_retry_failed",
            data: { place, message: sanitizeMessage(String(err2?.message ?? err2)) },
          });
        }
      } catch (_) {}

      try {
        leaveAppBreadcrumb("auth_lock_retry_failed", { place, message: sanitizeMessage(String(err2?.message ?? err2)) });
      } catch (_) {}

      // rethrow so existing fallback logic still runs
      throw err2;
    }
  }
}

export default authWithLockRetry;
