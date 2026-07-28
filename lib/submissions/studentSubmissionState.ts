export const STUDENT_SUBMISSION_STATUSES = [
  "idle",
  "editing",
  "submitting",
  "queued_offline",
  "awaiting_confirmation",
  "confirmed",
  "retryable_error",
  "rejected",
  "session_closed",
] as const;

export type StudentSubmissionStatus =
  (typeof STUDENT_SUBMISSION_STATUSES)[number];

export type StudentSubmissionType = "quiz" | "manual" | "photo" | "skip";

export type StudentSubmissionErrorKind =
  | "none"
  | "expected_user"
  | "unexpected_technical";

export type StudentSubmissionState = {
  operationId: string | null;
  submissionType: StudentSubmissionType;
  status: StudentSubmissionStatus;
  hasInput: boolean;
  isLocallyStored: boolean;
  requestInFlight: boolean;
  serverConfirmed: boolean;
  confirmationUncertain: boolean;
  errorKind: StudentSubmissionErrorKind;
};

export type StudentSubmissionEvent =
  | { type: "edit"; operationId?: string | null }
  | { type: "submit"; operationId: string }
  | { type: "retry" }
  | { type: "queue_offline" }
  | { type: "response_lost" }
  | { type: "confirm"; result: "stored" | "duplicate" }
  | { type: "retryable_error" }
  | { type: "reject" }
  | { type: "close_session" }
  | { type: "reset" };

export type StudentSubmissionTransitionResult = {
  accepted: boolean;
  state: StudentSubmissionState;
};

export type StudentSubmissionQueueEntry<TPayload = unknown> = {
  id: string;
  sessionId: string;
  participantId: string;
  status: StudentSubmissionStatus;
  attemptCount: number;
  payload?: TPayload;
};

export type StudentSubmissionOutcome = {
  isCorrect: boolean;
  awardedPoints: number;
};

export type StudentSubmissionReconciliation = {
  authoritativeOutcome: StudentSubmissionOutcome;
  correctAnswersDelta: -1 | 0 | 1;
  pointsDelta: number;
  didCorrectnessChange: boolean;
  didPointsChange: boolean;
};

export type StudentSubmissionProgressionDecision =
  | "progress_confirmed"
  | "progress_queued_offline"
  | "wait_for_confirmation"
  | "wait_for_durable_persistence";

export type StudentSubmissionProgressionInput = {
  networkState: "online" | "offline";
  serverConfirmed: boolean;
  durablePersistenceSucceeded: boolean;
};

const OPERATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function flagsForStatus(status: StudentSubmissionStatus) {
  switch (status) {
    case "idle":
      return {
        hasInput: false,
        isLocallyStored: false,
        requestInFlight: false,
        serverConfirmed: false,
        confirmationUncertain: false,
        errorKind: "none" as const,
      };
    case "editing":
      return {
        hasInput: true,
        isLocallyStored: false,
        requestInFlight: false,
        serverConfirmed: false,
        confirmationUncertain: false,
        errorKind: "none" as const,
      };
    case "submitting":
      return {
        hasInput: true,
        isLocallyStored: false,
        requestInFlight: true,
        serverConfirmed: false,
        confirmationUncertain: false,
        errorKind: "none" as const,
      };
    case "queued_offline":
      return {
        hasInput: true,
        isLocallyStored: true,
        requestInFlight: false,
        serverConfirmed: false,
        confirmationUncertain: false,
        errorKind: "none" as const,
      };
    case "awaiting_confirmation":
      return {
        hasInput: true,
        isLocallyStored: false,
        requestInFlight: false,
        serverConfirmed: false,
        confirmationUncertain: true,
        errorKind: "unexpected_technical" as const,
      };
    case "confirmed":
      return {
        hasInput: false,
        isLocallyStored: false,
        requestInFlight: false,
        serverConfirmed: true,
        confirmationUncertain: false,
        errorKind: "none" as const,
      };
    case "retryable_error":
      return {
        hasInput: true,
        isLocallyStored: false,
        requestInFlight: false,
        serverConfirmed: false,
        confirmationUncertain: false,
        errorKind: "unexpected_technical" as const,
      };
    case "rejected":
    case "session_closed":
      return {
        hasInput: true,
        isLocallyStored: false,
        requestInFlight: false,
        serverConfirmed: false,
        confirmationUncertain: false,
        errorKind: "expected_user" as const,
      };
  }
}

function withStatus(
  current: StudentSubmissionState,
  status: StudentSubmissionStatus,
  operationId = current.operationId
): StudentSubmissionState {
  return {
    operationId,
    submissionType: current.submissionType,
    status,
    ...flagsForStatus(status),
  };
}

export function isStudentSubmissionOperationId(value: unknown): value is string {
  return (
    typeof value === "string" && OPERATION_ID_PATTERN.test(value.trim())
  );
}

function createBrowserSafeRandomUuid() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new TypeError("A secure operation id generator is unavailable.");
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function createStudentSubmissionOperationId(
  randomUUID: () => string = createBrowserSafeRandomUuid
) {
  const operationId = randomUUID().trim().toLowerCase();
  if (!isStudentSubmissionOperationId(operationId)) {
    throw new TypeError("Operation id generator must return a UUID.");
  }

  return operationId;
}

export function createIdleStudentSubmissionState(
  submissionType: StudentSubmissionType = "quiz"
): StudentSubmissionState {
  return {
    operationId: null,
    submissionType,
    status: "idle",
    ...flagsForStatus("idle"),
  };
}

export function restoreStudentSubmissionState(
  submissionType: StudentSubmissionType,
  operationId: string,
  status: StudentSubmissionStatus
): StudentSubmissionState {
  if (!isStudentSubmissionOperationId(operationId)) {
    return createIdleStudentSubmissionState(submissionType);
  }

  return {
    operationId,
    submissionType,
    status,
    ...flagsForStatus(status),
  };
}

function acceptsEvent(
  status: StudentSubmissionStatus,
  event: StudentSubmissionEvent["type"]
) {
  if (event === "reset") return true;

  const accepted: Record<
    StudentSubmissionStatus,
    readonly StudentSubmissionEvent["type"][]
  > = {
    idle: ["edit", "submit", "close_session"],
    editing: ["edit", "submit", "close_session"],
    submitting: [
      "queue_offline",
      "response_lost",
      "confirm",
      "retryable_error",
      "reject",
      "close_session",
    ],
    queued_offline: ["retry", "confirm", "reject", "close_session"],
    awaiting_confirmation: [
      "retry",
      "confirm",
      "retryable_error",
      "reject",
      "close_session",
    ],
    confirmed: [],
    retryable_error: ["edit", "retry", "confirm", "reject", "close_session"],
    rejected: ["edit", "close_session"],
    session_closed: [],
  };

  return accepted[status].includes(event);
}

export function transitionStudentSubmission(
  current: StudentSubmissionState,
  event: StudentSubmissionEvent
): StudentSubmissionTransitionResult {
  if (!acceptsEvent(current.status, event.type)) {
    return { accepted: false, state: current };
  }

  switch (event.type) {
    case "reset":
      return {
        accepted: true,
        state: createIdleStudentSubmissionState(current.submissionType),
      };
    case "edit":
      return {
        accepted: true,
        state: withStatus(
          current,
          "editing",
          event.operationId ?? current.operationId
        ),
      };
    case "submit":
      if (!isStudentSubmissionOperationId(event.operationId)) {
        return { accepted: false, state: current };
      }
      return {
        accepted: true,
        state: withStatus(current, "submitting", event.operationId),
      };
    case "retry":
      if (!current.operationId) {
        return { accepted: false, state: current };
      }
      return {
        accepted: true,
        state: withStatus(current, "submitting"),
      };
    case "queue_offline":
      return {
        accepted: true,
        state: withStatus(current, "queued_offline"),
      };
    case "response_lost":
      return {
        accepted: true,
        state: withStatus(current, "awaiting_confirmation"),
      };
    case "confirm":
      return {
        accepted: true,
        state: withStatus(current, "confirmed"),
      };
    case "retryable_error":
      return {
        accepted: true,
        state: withStatus(current, "retryable_error"),
      };
    case "reject":
      return {
        accepted: true,
        state: withStatus(current, "rejected"),
      };
    case "close_session":
      return {
        accepted: true,
        state: withStatus(current, "session_closed"),
      };
  }
}

export function upsertStudentSubmissionQueueEntry<
  T extends StudentSubmissionQueueEntry,
>(queue: readonly T[], entry: T): T[] {
  const existingIndex = queue.findIndex((candidate) => candidate.id === entry.id);
  if (existingIndex < 0) {
    return [...queue, entry];
  }

  const existingEntry = queue[existingIndex];
  if (
    existingEntry.sessionId !== entry.sessionId ||
    existingEntry.participantId !== entry.participantId
  ) {
    return [...queue];
  }

  const next = [...queue];
  next[existingIndex] = entry;
  return next;
}

export function isPendingSubmissionForContext(
  entry: Pick<StudentSubmissionQueueEntry, "sessionId" | "participantId">,
  context: { sessionId: string; participantId: string }
) {
  return (
    entry.sessionId === context.sessionId &&
    entry.participantId === context.participantId
  );
}

export function getStudentSubmissionQueueHead<
  T extends StudentSubmissionQueueEntry,
>(queue: readonly T[]) {
  return queue.find((entry) => entry.status !== "confirmed") ?? null;
}

export function getStudentSubmissionRetryDelayMs(
  attemptCount: number,
  baseDelayMs = 1_000,
  maximumDelayMs = 30_000
) {
  const safeAttemptCount =
    Number.isInteger(attemptCount) && attemptCount > 0 ? attemptCount : 0;
  const safeBaseDelay = Math.max(1, Math.round(baseDelayMs));
  const safeMaximumDelay = Math.max(safeBaseDelay, Math.round(maximumDelayMs));
  return Math.min(
    safeMaximumDelay,
    safeBaseDelay * 2 ** Math.min(safeAttemptCount, 10)
  );
}

export function canReplayStudentSubmission(
  entry: StudentSubmissionQueueEntry,
  context: { sessionId: string; participantId: string },
  nowMs = Date.now(),
  nextRetryAtMs: number | null = null
) {
  return (
    isPendingSubmissionForContext(entry, context) &&
    entry.status !== "confirmed" &&
    entry.status !== "rejected" &&
    entry.status !== "session_closed" &&
    (nextRetryAtMs === null || nextRetryAtMs <= nowMs)
  );
}

export function getStudentSubmissionReplayHead<
  T extends StudentSubmissionQueueEntry,
>(
  queue: readonly T[],
  context: { sessionId: string; participantId: string },
  nowMs = Date.now(),
  getNextRetryAtMs: (entry: T) => number | null = () => null
): T | null {
  const contextQueue = queue.filter((entry) =>
    isPendingSubmissionForContext(entry, context)
  );
  const head = getStudentSubmissionQueueHead(contextQueue);

  if (
    !head ||
    !canReplayStudentSubmission(
      head,
      context,
      nowMs,
      getNextRetryAtMs(head)
    )
  ) {
    return null;
  }

  return head;
}

function normalizeAwardedPoints(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/**
 * The server outcome always wins. The deltas let a client undo an optimistic
 * local result without duplicating score/progress calculations.
 */
export function reconcileStudentSubmissionOutcome(
  localOutcome: StudentSubmissionOutcome,
  serverOutcome: StudentSubmissionOutcome
): StudentSubmissionReconciliation {
  const localPoints = normalizeAwardedPoints(localOutcome.awardedPoints);
  const serverPoints = normalizeAwardedPoints(serverOutcome.awardedPoints);
  const localCorrect = localOutcome.isCorrect === true;
  const serverCorrect = serverOutcome.isCorrect === true;

  return {
    authoritativeOutcome: {
      isCorrect: serverCorrect,
      awardedPoints: serverPoints,
    },
    correctAnswersDelta: (Number(serverCorrect) -
      Number(localCorrect)) as -1 | 0 | 1,
    pointsDelta: serverPoints - localPoints,
    didCorrectnessChange: localCorrect !== serverCorrect,
    didPointsChange: localPoints !== serverPoints,
  };
}

/**
 * Online progression requires server confirmation. Once offline, progression
 * is allowed only after the exact operation has been durably persisted.
 */
export function getStudentSubmissionProgressionDecision({
  networkState,
  serverConfirmed,
  durablePersistenceSucceeded,
}: StudentSubmissionProgressionInput): StudentSubmissionProgressionDecision {
  if (serverConfirmed) {
    return "progress_confirmed";
  }

  if (networkState === "offline") {
    return durablePersistenceSucceeded
      ? "progress_queued_offline"
      : "wait_for_durable_persistence";
  }

  return "wait_for_confirmation";
}

export function canProgressStudentSubmission(
  input: StudentSubmissionProgressionInput
) {
  const decision = getStudentSubmissionProgressionDecision(input);
  return (
    decision === "progress_confirmed" ||
    decision === "progress_queued_offline"
  );
}
