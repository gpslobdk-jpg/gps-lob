export const PARTICIPANT_UPLOADS_BUCKET = "participant-uploads";

export const PHOTO_SIGNED_URL_TTL_SECONDS = 60;
export const GPS_LOCATION_TTL_MINUTES = 15;
export const GPS_LOCATION_TTL_MS = GPS_LOCATION_TTL_MINUTES * 60 * 1000;
export const PHOTO_RETENTION_DAYS = 30;
export const STUDENT_DATA_RETENTION_DAYS = 90;
export const SECURITY_LOG_RETENTION_DAYS = 30;

const ACTIVE_SESSION_STATUSES = new Set([
  "waiting",
  "running",
  "active",
  "paused",
]);

export function getProtectedAnswerPhotoUrl(answerId: string) {
  return `/api/teacher/answers/${encodeURIComponent(answerId)}/photo`;
}

export function isActiveStudentSessionStatus(status: unknown) {
  return (
    typeof status === "string" &&
    ACTIVE_SESSION_STATUSES.has(status.trim().toLowerCase())
  );
}

export function isFreshStudentLocation(
  lastUpdated: unknown,
  nowMs = Date.now()
) {
  if (typeof lastUpdated !== "string" || !lastUpdated.trim()) return false;

  const timestamp = Date.parse(lastUpdated);
  return (
    Number.isFinite(timestamp) &&
    timestamp <= nowMs &&
    nowMs - timestamp <= GPS_LOCATION_TTL_MS
  );
}

export function shouldExposeStudentLocation({
  sessionStatus,
  finishedAt,
  lastUpdated,
  nowMs = Date.now(),
}: {
  sessionStatus: unknown;
  finishedAt: unknown;
  lastUpdated: unknown;
  nowMs?: number;
}) {
  return (
    isActiveStudentSessionStatus(sessionStatus) &&
    !finishedAt &&
    isFreshStudentLocation(lastUpdated, nowMs)
  );
}

export function canTeacherAccessAnswerPhoto({
  teacherUserId,
  runOwnerId,
  answerId,
  photoAnswerId,
  answerSessionId,
  photoSessionId,
  answerParticipantId,
  photoParticipantId,
}: {
  teacherUserId: string | null | undefined;
  runOwnerId: string | null | undefined;
  answerId: string | null | undefined;
  photoAnswerId: string | null | undefined;
  answerSessionId: string | null | undefined;
  photoSessionId: string | null | undefined;
  answerParticipantId: string | null | undefined;
  photoParticipantId: string | null | undefined;
}) {
  return (
    Boolean(teacherUserId) &&
    teacherUserId === runOwnerId &&
    Boolean(answerId) &&
    answerId === photoAnswerId &&
    Boolean(answerSessionId) &&
    answerSessionId === photoSessionId &&
    (answerParticipantId ?? null) === (photoParticipantId ?? null)
  );
}
