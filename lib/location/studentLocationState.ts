export const STUDENT_LOCATION_STALE_AFTER_MS = 15_000;
export const STUDENT_LOCATION_WEAK_ACCURACY_METERS = 120;
export const STUDENT_LOCATION_UNLOCK_MAX_ACCURACY_METERS = 250;

export type StudentLocationStatus =
  | "idle"
  | "requesting_permission"
  | "locating"
  | "ready"
  | "weak_accuracy"
  | "temporarily_unavailable"
  | "permission_denied"
  | "timed_out"
  | "unsupported"
  | "offline";

export type StudentLocationPermission =
  | "granted"
  | "prompt"
  | "denied"
  | "unknown";

export type StudentLocationError =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unknown";

export type StudentLocationAccuracyCategory = "good" | "weak" | "unknown";

export interface StudentLocationStateInput {
  enabled: boolean;
  supported: boolean;
  online: boolean;
  permission: StudentLocationPermission;
  requesting: boolean;
  locating: boolean;
  hasPosition: boolean;
  timestampMs: number | null;
  accuracyMeters: number | null;
  error: StudentLocationError | null;
  resumedAtMs: number | null;
  nowMs: number;
}

export interface StudentLocationState {
  status: StudentLocationStatus;
  accuracyCategory: StudentLocationAccuracyCategory;
  isFresh: boolean;
  canUsePositionForUnlock: boolean;
}

export type StudentLocationStateResult = StudentLocationState;

const STANDARD_STUDENT_LOCATION_RACE_TYPES = new Set([
  "manuel",
  "quiz",
  "manual",
  "manuelt",
  "dansk",
  "danish",
  "engelsk",
  "english",
  "matematik",
  "math",
  "foto",
  "photo",
]);

function isFiniteNonNegative(value: number | null): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function resolveAccuracyCategory(
  accuracyMeters: number | null
): StudentLocationAccuracyCategory {
  if (!isFiniteNonNegative(accuracyMeters)) {
    return "unknown";
  }

  return accuracyMeters <= STUDENT_LOCATION_WEAK_ACCURACY_METERS
    ? "good"
    : "weak";
}

function resolveFreshness({
  hasPosition,
  timestampMs,
  resumedAtMs,
  nowMs,
}: Pick<
  StudentLocationStateInput,
  "hasPosition" | "timestampMs" | "resumedAtMs" | "nowMs"
>): boolean {
  if (
    !hasPosition ||
    !isFiniteNonNegative(timestampMs) ||
    !isFiniteNonNegative(nowMs) ||
    timestampMs > nowMs
  ) {
    return false;
  }

  const hasValidResumeBoundary =
    resumedAtMs === null || isFiniteNonNegative(resumedAtMs);

  if (!hasValidResumeBoundary) {
    return false;
  }

  if (resumedAtMs !== null && timestampMs < resumedAtMs) {
    return false;
  }

  return nowMs - timestampMs <= STUDENT_LOCATION_STALE_AFTER_MS;
}

export function resolveStudentLocationState(
  input: StudentLocationStateInput
): StudentLocationState {
  const accuracyCategory = resolveAccuracyCategory(input.accuracyMeters);
  const isFresh = resolveFreshness(input);
  const hasUsableAccuracy =
    isFiniteNonNegative(input.accuracyMeters) &&
    input.accuracyMeters <= STUDENT_LOCATION_UNLOCK_MAX_ACCURACY_METERS;
  const canUsePositionForUnlock =
    input.enabled &&
    input.supported &&
    input.permission !== "denied" &&
    input.error === null &&
    isFresh &&
    hasUsableAccuracy;

  let status: StudentLocationStatus;

  if (!input.enabled) {
    status = "idle";
  } else if (!input.supported) {
    status = "unsupported";
  } else if (
    input.permission === "denied" ||
    input.error === "permission_denied"
  ) {
    status = "permission_denied";
  } else if (!input.online) {
    status = "offline";
  } else if (input.requesting) {
    status = "requesting_permission";
  } else if (input.error === "timeout") {
    status = "timed_out";
  } else if (
    input.error === "position_unavailable" ||
    input.error === "unknown"
  ) {
    status = "temporarily_unavailable";
  } else if (isFresh && accuracyCategory === "good") {
    status = "ready";
  } else if (isFresh && accuracyCategory === "weak") {
    status = "weak_accuracy";
  } else if (input.locating) {
    status = "locating";
  } else if (input.hasPosition || input.permission === "granted") {
    status = "temporarily_unavailable";
  } else {
    status = "idle";
  }

  return {
    status,
    accuracyCategory,
    isFresh,
    canUsePositionForUnlock,
  };
}

export function usesStandardStudentLocationExperience(
  rawRaceType: unknown
): boolean {
  if (typeof rawRaceType !== "string") {
    return false;
  }

  return STANDARD_STUDENT_LOCATION_RACE_TYPES.has(
    rawRaceType.trim().toLocaleLowerCase("da-DK")
  );
}
