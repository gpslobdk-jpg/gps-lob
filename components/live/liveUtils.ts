import type {
  AnswerRow,
  LiveAnswer,
  LiveStudentLocation,
  RunQuestion,
  StudentRow,
} from "@/components/live/types";
import { DEFAULT_QUESTION_POINTS } from "@/utils/questionPoints";

export const DEFAULT_TEACHER_MAP_CENTER: [number, number] = [55.3959, 10.3883];

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toLocation(row: StudentRow): LiveStudentLocation | null {
  const name = normalizeName(row.student_name);
  if (!name) return null;

  const lat = toFiniteNumber(row.lat ?? row.latitude);
  const lng = toFiniteNumber(row.lng ?? row.longitude);
  const baseId = row.id ?? `${row.session_id ?? "session"}-${name}`;

  return {
    id: String(baseId),
    name,
    student_name: name,
    lat,
    lng,
    updated_at: row.updated_at ?? null,
    run_started_at: row.run_started_at ?? null,
    finished_at: row.finished_at ?? null,
    startOffset: toFiniteNumber(row.start_offset),
  };
}

export function upsertLocation(
  previous: LiveStudentLocation[],
  nextLocation: LiveStudentLocation
): LiveStudentLocation[] {
  const index = previous.findIndex((item) => item.id === nextLocation.id);
  if (index === -1) return [...previous, nextLocation];

  const next = [...previous];
  const current = previous[index];
  next[index] = {
    ...current,
    ...nextLocation,
    // Keep the last known coordinates if a fallback row arrives without location data.
    lat: nextLocation.lat ?? current.lat,
    lng: nextLocation.lng ?? current.lng,
    updated_at: nextLocation.updated_at ?? current.updated_at ?? null,
    run_started_at: nextLocation.run_started_at ?? current.run_started_at ?? null,
    finished_at: nextLocation.finished_at ?? current.finished_at ?? null,
    startOffset: nextLocation.startOffset ?? current.startOffset,
  };
  return next;
}

export function toLiveAnswer(row: AnswerRow): LiveAnswer | null {
  const studentName = normalizeName(row.student_name);
  if (!studentName) return null;

  const rawIndex = toFiniteNumber(row.post_index ?? row.question_index);
  const postNumber = rawIndex === null ? null : rawIndex >= 1 ? rawIndex : rawIndex + 1;
  const createdAt = row.answered_at ?? row.created_at ?? null;
  const idSource = row.id ?? `${studentName}-${createdAt ?? Date.now()}-${postNumber ?? "?"}`;
  const imageUrl = typeof row.image_url === "string" ? row.image_url.trim() : "";
  const participantId =
    row.participant_id === null || row.participant_id === undefined ? null : String(row.participant_id);
  const storedAwardedPoints = toFiniteNumber(row.awarded_points);
  const awardedPoints =
    row.is_correct === true
      ? storedAwardedPoints !== null
        ? Math.max(0, Math.round(storedAwardedPoints))
        : DEFAULT_QUESTION_POINTS
      : 0;

  return {
    id: String(idSource),
    participantId,
    studentName,
    postNumber,
    isCorrect: typeof row.is_correct === "boolean" ? row.is_correct : null,
    awardedPoints,
    image_url: imageUrl || null,
    createdAt,
  };
}

export function prependAnswer(previous: LiveAnswer[], nextAnswer: LiveAnswer): LiveAnswer[] {
  const deduped = previous.filter((item) => item.id !== nextAnswer.id);
  return [nextAnswer, ...deduped];
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function getTeacherMapCenter(runQuestions: RunQuestion[]): [number, number] {
  const firstRunQuestionWithCoords = runQuestions.find((question) => {
    const lat = toFiniteNumber(question.lat);
    const lng = toFiniteNumber(question.lng);
    return lat !== null && lng !== null;
  });

  if (!firstRunQuestionWithCoords) return DEFAULT_TEACHER_MAP_CENTER;

  return [
    Number(firstRunQuestionWithCoords.lat),
    Number(firstRunQuestionWithCoords.lng),
  ];
}
