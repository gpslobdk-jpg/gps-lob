import { createHash, randomBytes } from "node:crypto";

import { normalizeOevekortShareToken } from "@/lib/oevekort";

export function generateOevekortShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOevekortShareToken(value: unknown) {
  const token = normalizeOevekortShareToken(value);
  if (!token) return null;

  return createHash("sha256").update(token, "utf8").digest("hex");
}
