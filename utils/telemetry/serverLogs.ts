import { createAdminClient } from "@/utils/supabase/admin";

const TELEMETRY_MESSAGE_LIMIT = 500;

export const PUBLIC_TELEMETRY_EVENTS = [
  "session_drop",
  "auth_error",
  "auth_lock_abort",
  "auth_lock_retry_failed",
  "auth_lock_retry_success",
  "gps_died",
  "gps_warmup_timeout",
  "gps_fallback_activated",
  "jwt_refresh_failed",
  "join_connection_check",
  "join_failed",
  "join_lookup",
  "join_lookup_timeout",
  "join_network_error",
  "join_register",
  "join_register_timeout",
  "join_webview_detected",
  "kick_false_positive",
  "participant_auth_refresh_recovered",
  "participant_auth_rebind_recovered",
  "participant_restore_exhausted",
  "wake_reconnect_recovered",
  "wake_reconnect_failed",
  "answer_submission_max_retries",
] as const;

export const PUBLIC_TELEMETRY_EVENT_SET = new Set<string>(PUBLIC_TELEMETRY_EVENTS);

type TelemetryInsertInput = {
  eventType: string;
  participantId?: string | null;
  sessionId?: string | null;
  message?: string | null;
};

type ServerErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  digest?: unknown;
};

type ServerLogInput = {
  route: string;
  method: string;
  status: number;
  error?: unknown;
  requestPath?: string | null;
  routeType?: string | null;
  context?: string | null;
  source?: string;
  participantId?: string | null;
  sessionId?: string | null;
  digest?: string | null;
};

function clip(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return "";
  }

  return value
    .replace(/[\r\n|]/g, " ")
    .replace(/=/g, ":")
    .trim()
    .slice(0, maxLength);
}

function buildStructuredMessage(fields: Array<[string, string]>) {
  const payload = fields
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join("|");

  return `meta:${payload}`.slice(0, TELEMETRY_MESSAGE_LIMIT);
}

function getErrorParts(error: unknown) {
  if (error instanceof Error) {
    const candidate = error as Error & { digest?: unknown };

    return {
      message: clip(candidate.message, 140),
      code: "",
      details: "",
      digest: clip(candidate.digest, 48),
    };
  }

  if (error && typeof error === "object") {
    const candidate = error as ServerErrorLike;

    return {
      message: clip(candidate.message, 140) || "Ukendt serverfejl",
      code: clip(candidate.code, 32),
      details: clip(candidate.details, 80),
      digest: clip(candidate.digest, 48),
    };
  }

  if (typeof error === "string") {
    return {
      message: clip(error, 140),
      code: "",
      details: "",
      digest: "",
    };
  }

  return {
    message: "Ukendt serverfejl",
    code: "",
    details: "",
    digest: "",
  };
}

function normalizeMessage(message?: string | null) {
  return typeof message === "string" && message.trim() ? message.slice(0, TELEMETRY_MESSAGE_LIMIT) : null;
}

export async function writeTelemetryLog({
  eventType,
  participantId = null,
  sessionId = null,
  message = null,
}: TelemetryInsertInput) {
  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return;
  }

  const { error } = await adminSupabase.from("telemetry_logs").insert({
    event_type: eventType,
    participant_id: participantId,
    session_id: sessionId,
    message: normalizeMessage(message),
  });

  if (error) {
    console.info("[telemetry] telemetry_logs not writable:", eventType, error.message);
  }
}

export async function logServerResponseError({
  route,
  method,
  status,
  error,
  requestPath,
  participantId = null,
  sessionId = null,
  source = "route-response",
}: ServerLogInput) {
  const errorParts = getErrorParts(error);

  await writeTelemetryLog({
    eventType: "server_response_error",
    participantId,
    sessionId,
    message: buildStructuredMessage([
      ["kind", "response"],
      ["source", clip(source, 24)],
      ["route", clip(route, 96)],
      ["path", clip(requestPath, 140)],
      ["method", clip(method, 12)],
      ["status", clip(status, 4)],
      ["msg", errorParts.message],
      ["code", errorParts.code],
      ["details", errorParts.details],
    ]),
  });
}

export async function logHandledServerError({
  route,
  method,
  status,
  error,
  requestPath,
  routeType,
  context,
  participantId = null,
  sessionId = null,
  source = "route-catch",
  digest = null,
}: ServerLogInput) {
  const errorParts = getErrorParts(error);

  await writeTelemetryLog({
    eventType: "server_handled_error",
    participantId,
    sessionId,
    message: buildStructuredMessage([
      ["kind", "handled"],
      ["source", clip(source, 24)],
      ["route", clip(route, 96)],
      ["path", clip(requestPath, 140)],
      ["method", clip(method, 12)],
      ["status", clip(status, 4)],
      ["type", clip(routeType, 16)],
      ["context", clip(context, 64)],
      ["msg", errorParts.message],
      ["code", errorParts.code],
      ["details", errorParts.details],
      ["digest", clip(digest, 48) || errorParts.digest],
    ]),
  });
}

export async function logInstrumentationException({
  route,
  method,
  status,
  error,
  requestPath,
  routeType,
  source = "next-instrumentation",
  digest = null,
}: ServerLogInput) {
  const errorParts = getErrorParts(error);

  await writeTelemetryLog({
    eventType: "server_exception",
    message: buildStructuredMessage([
      ["kind", "exception"],
      ["source", clip(source, 24)],
      ["route", clip(route, 96)],
      ["path", clip(requestPath, 140)],
      ["method", clip(method, 12)],
      ["status", clip(status, 4)],
      ["type", clip(routeType, 16)],
      ["msg", errorParts.message],
      ["code", errorParts.code],
      ["details", errorParts.details],
      ["digest", clip(digest, 48) || errorParts.digest],
    ]),
  });
}