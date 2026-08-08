import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { FAMILY_SSO_CLOCK_SKEW_SECONDS } from "./config";

export function digestFamilySsoValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function signFamilySsoBackchannel(body: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("base64url");
}

export function verifyFamilySsoBackchannel({
  body,
  timestamp,
  signature,
  secret,
  now = Date.now(),
}: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  now?: number;
}) {
  if (!timestamp || !signature || !/^\d{10,13}$/.test(timestamp)) return false;
  const parsedTimestamp = Number(timestamp);
  const timestampMs = timestamp.length === 10 ? parsedTimestamp * 1000 : parsedTimestamp;
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(now - timestampMs) > FAMILY_SSO_CLOCK_SKEW_SECONDS * 1000) return false;

  const expected = signFamilySsoBackchannel(body, timestamp, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
