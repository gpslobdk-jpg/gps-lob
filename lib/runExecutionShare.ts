import { RACE_TYPES, type RaceType } from "@/utils/gpsRuns";

export const RUN_EXECUTION_SHARE_PATH = "/del/afvikling";
export const RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY = "skolegps_run_execution_share_token";

export const SUPPORTED_RUN_EXECUTION_SHARE_RACE_TYPES = [
  RACE_TYPES.MANUEL,
  RACE_TYPES.DANSK,
  RACE_TYPES.ENGELSK,
  RACE_TYPES.MATEMATIK,
  RACE_TYPES.FOTO,
] as const satisfies readonly RaceType[];

const SUPPORTED_RACE_TYPE_SET = new Set<RaceType>(
  SUPPORTED_RUN_EXECUTION_SHARE_RACE_TYPES
);
const RUN_EXECUTION_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isRunExecutionSharingEnabled() {
  return process.env.NEXT_PUBLIC_RUN_EXECUTION_SHARING_ENABLED === "true";
}

export function isSupportedRunExecutionShareRaceType(
  value: unknown
): value is (typeof SUPPORTED_RUN_EXECUTION_SHARE_RACE_TYPES)[number] {
  return typeof value === "string" && SUPPORTED_RACE_TYPE_SET.has(value as RaceType);
}

export function normalizeRunExecutionShareToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  return RUN_EXECUTION_SHARE_TOKEN_PATTERN.test(token) ? token : null;
}

export function buildRunExecutionShareLink(origin: string, tokenValue: unknown) {
  const token = normalizeRunExecutionShareToken(tokenValue);
  if (!token) return null;

  try {
    const url = new URL(RUN_EXECUTION_SHARE_PATH, new URL(origin).origin);
    url.hash = token;
    return url.toString();
  } catch {
    return null;
  }
}
