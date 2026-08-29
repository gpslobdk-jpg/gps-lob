import { createHmac, timingSafeEqual } from "node:crypto";

type StopTokenPayload = {
  callId: string;
  participantBinding: string;
  sessionBinding: string;
  postIndex: number;
  expiresAtMs: number;
};

const CALL_ID_PATTERN = /^[a-zA-Z0-9_-]{1,200}$/;

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

function encodePayload(payload: StopTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string) {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.callId !== "string" ||
      !CALL_ID_PATTERN.test(candidate.callId) ||
      typeof candidate.participantBinding !== "string" ||
      typeof candidate.sessionBinding !== "string" ||
      typeof candidate.postIndex !== "number" ||
      !Number.isInteger(candidate.postIndex) ||
      candidate.postIndex < 0 ||
      typeof candidate.expiresAtMs !== "number" ||
      !Number.isFinite(candidate.expiresAtMs)
    ) {
      return null;
    }

    return candidate as StopTokenPayload;
  } catch {
    return null;
  }
}

export function createCharacterRealtimeRateLimitFingerprint({
  secret,
  authUserId,
  participantId,
  sessionId,
}: {
  secret: string;
  authUserId: string;
  participantId: string;
  sessionId: string;
}) {
  return hmac(
    secret,
    `pilen-realtime-rate:${authUserId}:${participantId}:${sessionId}`,
  );
}

export function readRealtimeCallId(locationHeader: string | null) {
  if (!locationHeader) return null;
  try {
    const pathname = new URL(locationHeader, "https://api.openai.com").pathname;
    const candidate = pathname.split("/").filter(Boolean).at(-1) ?? "";
    return CALL_ID_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function createCharacterRealtimeStopToken({
  secret,
  callId,
  participantId,
  sessionId,
  postIndex,
  expiresAtMs,
}: {
  secret: string;
  callId: string;
  participantId: string;
  sessionId: string;
  postIndex: number;
  expiresAtMs: number;
}) {
  if (!CALL_ID_PATTERN.test(callId)) return null;

  const encodedPayload = encodePayload({
    callId,
    participantBinding: hmac(secret, `participant:${participantId}`),
    sessionBinding: hmac(secret, `session:${sessionId}`),
    postIndex,
    expiresAtMs,
  });
  const signature = hmac(secret, `stop-token:${encodedPayload}`);
  return `${encodedPayload}.${signature}`;
}

export function verifyCharacterRealtimeStopToken({
  secret,
  token,
  participantId,
  sessionId,
  nowMs = Date.now(),
}: {
  secret: string;
  token: string;
  participantId: string;
  sessionId: string;
  nowMs?: number;
}) {
  const [encodedPayload, suppliedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra.length > 0) return null;

  const expectedSignature = hmac(secret, `stop-token:${encodedPayload}`);
  const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload || payload.expiresAtMs < nowMs) return null;
  if (
    payload.participantBinding !== hmac(secret, `participant:${participantId}`) ||
    payload.sessionBinding !== hmac(secret, `session:${sessionId}`)
  ) {
    return null;
  }

  return {
    callId: payload.callId,
    postIndex: payload.postIndex,
    expiresAtMs: payload.expiresAtMs,
  };
}
