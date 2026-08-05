import { createHash, randomBytes } from "node:crypto";

import { normalizeRunExecutionShareToken } from "@/lib/runExecutionShare";

export function generateRunExecutionShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashRunExecutionShareToken(tokenValue: unknown) {
  const token = normalizeRunExecutionShareToken(tokenValue);
  if (!token) return null;

  return createHash("sha256").update(token, "utf8").digest("hex");
}
