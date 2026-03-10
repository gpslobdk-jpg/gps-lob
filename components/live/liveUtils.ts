import type {
  AnswerRow,
  LiveAnswer,
  LiveStudentLocation,
  RunQuestion,
  StudentRow,
} from "@/components/live/types";

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
    finished_at: row.finished_at ?? null,
  };
}

export function upsertLocation(
  previous: LiveStudentLocation[],
  nextLocation: LiveStudentLocation
): LiveStudentLocation[] {
  const index = previous.findIndex((item) => item.id === nextLocation.id);
  if (index === -1) return [...previous, nextLocation];

  const next = [...previous];
  next[index] = nextLocation;
  return next;
}

export function toLiveAnswer(row: AnswerRow): LiveAnswer | null {
  const studentName = normalizeName(row.student_name);
  if (!studentName) return null;

  const rawIndex = toFiniteNumber(row.post_index ?? row.question_index);
  const postNumber = rawIndex === null ? null : rawIndex >= 1 ? rawIndex : rawIndex + 1;
  const createdAt = row.answered_at ?? row.created_at ?? null;
  const idSource = row.id ?? `${studentName}-${createdAt ?? Date.now()}-${postNumber ?? "?"}`;

  return {
    id: String(idSource),
    studentName,
    postNumber,
    isCorrect: typeof row.is_correct === "boolean" ? row.is_correct : null,
    createdAt,
  };
}

export function prependAnswer(previous: LiveAnswer[], nextAnswer: LiveAnswer): LiveAnswer[] {
  const deduped = previous.filter((item) => item.id !== nextAnswer.id);
  return [nextAnswer, ...deduped].slice(0, 40);
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
