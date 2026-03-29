export const DEFAULT_QUESTION_POINTS = 10;

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeQuestionPoints(value: unknown) {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return DEFAULT_QUESTION_POINTS;
  }

  return Math.max(0, Math.round(parsed));
}

export function getQuestionPoints(rawQuestion: unknown) {
  if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
    return DEFAULT_QUESTION_POINTS;
  }

  const candidate = rawQuestion as Record<string, unknown>;
  return normalizeQuestionPoints(candidate.points);
}

export function getAwardedPoints(rawQuestion: unknown, isCorrect: boolean) {
  return isCorrect ? getQuestionPoints(rawQuestion) : 0;
}