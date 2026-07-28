import { expect, test } from "@playwright/test";

import {
  STUDENT_SUBMISSION_STATUSES,
  canProgressStudentSubmission,
  canReplayStudentSubmission,
  createIdleStudentSubmissionState,
  createStudentSubmissionOperationId,
  getStudentSubmissionProgressionDecision,
  getStudentSubmissionQueueHead,
  getStudentSubmissionReplayHead,
  getStudentSubmissionRetryDelayMs,
  isPendingSubmissionForContext,
  isStudentSubmissionOperationId,
  reconcileStudentSubmissionOutcome,
  restoreStudentSubmissionState,
  transitionStudentSubmission,
  upsertStudentSubmissionQueueEntry,
  type StudentSubmissionQueueEntry,
  type StudentSubmissionState,
} from "@/lib/submissions/studentSubmissionState";

const OPERATION_A = "00000000-0000-4000-8000-000000000001";
const OPERATION_B = "00000000-0000-4000-8000-000000000002";
const CONTEXT = {
  sessionId: "session-a",
  participantId: "participant-a",
};

function accepted(
  state: StudentSubmissionState,
  event: Parameters<typeof transitionStudentSubmission>[1]
) {
  const transition = transitionStudentSubmission(state, event);
  expect(transition.accepted).toBe(true);
  return transition.state;
}

function queueEntry(
  overrides: Partial<StudentSubmissionQueueEntry> = {}
): StudentSubmissionQueueEntry {
  return {
    id: OPERATION_A,
    sessionId: CONTEXT.sessionId,
    participantId: CONTEXT.participantId,
    status: "queued_offline",
    attemptCount: 0,
    ...overrides,
  };
}

test.describe("student submission state model", () => {
  test("declares the complete explicit status contract", () => {
    expect(STUDENT_SUBMISSION_STATUSES).toEqual([
      "idle",
      "editing",
      "submitting",
      "queued_offline",
      "awaiting_confirmation",
      "confirmed",
      "retryable_error",
      "rejected",
      "session_closed",
    ]);
  });

  test("moves from editing through submitting to server confirmation", () => {
    let state = createIdleStudentSubmissionState("quiz");

    expect(state).toMatchObject({
      status: "idle",
      operationId: null,
      hasInput: false,
      isLocallyStored: false,
      requestInFlight: false,
      serverConfirmed: false,
    });

    state = accepted(state, { type: "edit" });
    state = accepted(state, { type: "submit", operationId: OPERATION_A });

    expect(state).toMatchObject({
      status: "submitting",
      operationId: OPERATION_A,
      hasInput: true,
      isLocallyStored: false,
      requestInFlight: true,
      serverConfirmed: false,
      confirmationUncertain: false,
      errorKind: "none",
    });

    state = accepted(state, { type: "confirm", result: "stored" });
    expect(state).toMatchObject({
      status: "confirmed",
      operationId: OPERATION_A,
      hasInput: false,
      isLocallyStored: false,
      requestInFlight: false,
      serverConfirmed: true,
      confirmationUncertain: false,
      errorKind: "none",
    });
  });

  test("keeps one operation id through offline queue, retry and duplicate success", () => {
    let state = accepted(createIdleStudentSubmissionState("quiz"), {
      type: "submit",
      operationId: OPERATION_A,
    });
    state = accepted(state, { type: "queue_offline" });

    expect(state).toMatchObject({
      status: "queued_offline",
      operationId: OPERATION_A,
      isLocallyStored: true,
      requestInFlight: false,
      serverConfirmed: false,
    });

    state = accepted(state, { type: "retry" });
    expect(state).toMatchObject({
      status: "submitting",
      operationId: OPERATION_A,
      requestInFlight: true,
    });

    state = accepted(state, { type: "confirm", result: "duplicate" });
    expect(state).toMatchObject({
      status: "confirmed",
      operationId: OPERATION_A,
      serverConfirmed: true,
    });
  });

  test("distinguishes lost confirmation, retryable errors and expected rejection", () => {
    let uncertain = accepted(createIdleStudentSubmissionState("manual"), {
      type: "submit",
      operationId: OPERATION_A,
    });
    uncertain = accepted(uncertain, { type: "response_lost" });

    expect(uncertain).toMatchObject({
      status: "awaiting_confirmation",
      operationId: OPERATION_A,
      isLocallyStored: false,
      confirmationUncertain: true,
      errorKind: "unexpected_technical",
    });

    const retrying = accepted(uncertain, { type: "retry" });
    const retryable = accepted(retrying, { type: "retryable_error" });
    expect(retryable).toMatchObject({
      status: "retryable_error",
      operationId: OPERATION_A,
      isLocallyStored: false,
      errorKind: "unexpected_technical",
    });

    const rejected = accepted(retryable, { type: "reject" });
    expect(rejected).toMatchObject({
      status: "rejected",
      operationId: OPERATION_A,
      isLocallyStored: false,
      errorKind: "expected_user",
    });
  });

  test("session closure is terminal and reset deliberately starts fresh", () => {
    const submitting = accepted(createIdleStudentSubmissionState("photo"), {
      type: "submit",
      operationId: OPERATION_A,
    });
    const closed = accepted(submitting, { type: "close_session" });

    expect(closed).toMatchObject({
      status: "session_closed",
      operationId: OPERATION_A,
      submissionType: "photo",
      serverConfirmed: false,
      errorKind: "expected_user",
    });

    const terminalRetry = transitionStudentSubmission(closed, {
      type: "retry",
    });
    expect(terminalRetry.accepted).toBe(false);
    expect(terminalRetry.state).toBe(closed);

    const reset = transitionStudentSubmission(closed, { type: "reset" });
    expect(reset).toEqual({
      accepted: true,
      state: createIdleStudentSubmissionState("photo"),
    });
  });

  test("invalid transitions and invalid operation ids fail closed", () => {
    const idle = createIdleStudentSubmissionState("skip");

    for (const event of [
      { type: "retry" as const },
      { type: "confirm" as const, result: "stored" as const },
      { type: "queue_offline" as const },
      { type: "submit" as const, operationId: "participant-session-post" },
    ]) {
      const transition = transitionStudentSubmission(idle, event);
      expect(transition.accepted).toBe(false);
      expect(transition.state).toBe(idle);
    }
  });
});

test.describe("student submission operation ids", () => {
  test("normalizes a valid opaque UUID and rejects identifying or malformed values", () => {
    expect(
      createStudentSubmissionOperationId(() => OPERATION_A.toUpperCase())
    ).toBe(OPERATION_A);
    expect(isStudentSubmissionOperationId(OPERATION_A)).toBe(true);
    expect(isStudentSubmissionOperationId(OPERATION_A.toUpperCase())).toBe(
      true
    );

    for (const value of [
      "",
      "session-a:participant-a:post-1",
      "participant@example.test",
      "00000000-0000-0000-0000-000000000000",
    ]) {
      expect(isStudentSubmissionOperationId(value)).toBe(false);
    }

    expect(() =>
      createStudentSubmissionOperationId(() => "session-a:participant-a")
    ).toThrow("Operation id generator must return a UUID.");
  });

  test("restores the same operation and flags while malformed snapshots fail closed", () => {
    expect(
      restoreStudentSubmissionState(
        "quiz",
        OPERATION_A,
        "awaiting_confirmation"
      )
    ).toMatchObject({
      operationId: OPERATION_A,
      submissionType: "quiz",
      status: "awaiting_confirmation",
      isLocallyStored: false,
      confirmationUncertain: true,
    });

    expect(
      restoreStudentSubmissionState(
        "photo",
        "participant-a-photo-1",
        "queued_offline"
      )
    ).toEqual(createIdleStudentSubmissionState("photo"));
  });
});

test.describe("student submission queue policy", () => {
  test("upsert preserves FIFO position and the head skips confirmed entries", () => {
    const first = queueEntry();
    const second = queueEntry({
      id: OPERATION_B,
      status: "awaiting_confirmation",
    });
    const initial = [first, second];

    const replaced = upsertStudentSubmissionQueueEntry(initial, {
      ...first,
      status: "retryable_error",
      attemptCount: 2,
    });
    expect(replaced.map((entry) => entry.id)).toEqual([
      OPERATION_A,
      OPERATION_B,
    ]);
    expect(replaced[0]).toMatchObject({
      status: "retryable_error",
      attemptCount: 2,
    });

    const appended = upsertStudentSubmissionQueueEntry(replaced, {
      ...second,
      id: "00000000-0000-4000-8000-000000000003",
    });
    expect(appended.map((entry) => entry.id)).toEqual([
      OPERATION_A,
      OPERATION_B,
      "00000000-0000-4000-8000-000000000003",
    ]);

    expect(
      getStudentSubmissionQueueHead([
        { ...first, status: "confirmed" },
        second,
      ])
    ).toBe(second);
    expect(
      getStudentSubmissionQueueHead([
        { ...first, status: "confirmed" },
        { ...second, status: "confirmed" },
      ])
    ).toBeNull();
  });

  test("deduplication cannot move one operation to another context", () => {
    const existing = queueEntry();
    const queue = [existing];
    const mismatched = {
      ...existing,
      participantId: "participant-b",
      status: "retryable_error" as const,
    };

    const result = upsertStudentSubmissionQueueEntry(
      queue,
      mismatched
    );

    expect(result).not.toBe(queue);
    expect(result).toEqual(queue);
    expect(queue).toEqual([existing]);
  });

  test("replay fails closed for another context, terminal states and future retries", () => {
    const pending = queueEntry();
    expect(isPendingSubmissionForContext(pending, CONTEXT)).toBe(true);
    expect(
      isPendingSubmissionForContext(pending, {
        ...CONTEXT,
        participantId: "participant-b",
      })
    ).toBe(false);

    expect(canReplayStudentSubmission(pending, CONTEXT, 10_000, null)).toBe(
      true
    );
    expect(canReplayStudentSubmission(pending, CONTEXT, 10_000, 10_001)).toBe(
      false
    );
    expect(canReplayStudentSubmission(pending, CONTEXT, 10_000, 10_000)).toBe(
      true
    );

    for (const status of [
      "confirmed",
      "rejected",
      "session_closed",
    ] as const) {
      expect(
        canReplayStudentSubmission(
          queueEntry({ status }),
          CONTEXT,
          10_000,
          null
        )
      ).toBe(false);
    }

    expect(
      canReplayStudentSubmission(
        pending,
        { ...CONTEXT, sessionId: "session-b" },
        10_000,
        null
      )
    ).toBe(false);
  });

  test("retry backoff is exponential, sanitized and capped", () => {
    expect(getStudentSubmissionRetryDelayMs(-1)).toBe(1_000);
    expect(getStudentSubmissionRetryDelayMs(0)).toBe(1_000);
    expect(getStudentSubmissionRetryDelayMs(1)).toBe(2_000);
    expect(getStudentSubmissionRetryDelayMs(4)).toBe(16_000);
    expect(getStudentSubmissionRetryDelayMs(5)).toBe(30_000);
    expect(getStudentSubmissionRetryDelayMs(500)).toBe(30_000);
    expect(getStudentSubmissionRetryDelayMs(3, 250, 1_500)).toBe(1_500);
  });

  test("strict replay never overtakes a blocked head in the same context", () => {
    const blockedHead = queueEntry({
      id: OPERATION_A,
      attemptCount: 2,
      status: "retryable_error",
    });
    const readySecond = queueEntry({
      id: OPERATION_B,
      attemptCount: 0,
      status: "queued_offline",
    });

    expect(
      getStudentSubmissionReplayHead(
        [blockedHead, readySecond],
        CONTEXT,
        10_000,
        (entry) => (entry.id === OPERATION_A ? 10_001 : null)
      )
    ).toBeNull();

    expect(
      getStudentSubmissionReplayHead(
        [blockedHead, readySecond],
        CONTEXT,
        10_001,
        (entry) => (entry.id === OPERATION_A ? 10_001 : null)
      )
    ).toBe(blockedHead);
  });

  test("strict replay skips confirmed entries and scopes FIFO per context", () => {
    const otherContext = queueEntry({
      id: "00000000-0000-4000-8000-000000000003",
      participantId: "participant-b",
    });
    const confirmed = queueEntry({ status: "confirmed" });
    const pending = queueEntry({ id: OPERATION_B });

    expect(
      getStudentSubmissionReplayHead(
        [otherContext, confirmed, pending],
        CONTEXT,
        10_000
      )
    ).toBe(pending);
  });
});

test.describe("server-authoritative submission reconciliation", () => {
  test("reverses optimistic correctness and points when the server says wrong", () => {
    expect(
      reconcileStudentSubmissionOutcome(
        { isCorrect: true, awardedPoints: 10 },
        { isCorrect: false, awardedPoints: 0 }
      )
    ).toEqual({
      authoritativeOutcome: {
        isCorrect: false,
        awardedPoints: 0,
      },
      correctAnswersDelta: -1,
      pointsDelta: -10,
      didCorrectnessChange: true,
      didPointsChange: true,
    });
  });

  test("applies correctness and points when the server corrects a local wrong result", () => {
    expect(
      reconcileStudentSubmissionOutcome(
        { isCorrect: false, awardedPoints: 0 },
        { isCorrect: true, awardedPoints: 7 }
      )
    ).toEqual({
      authoritativeOutcome: {
        isCorrect: true,
        awardedPoints: 7,
      },
      correctAnswersDelta: 1,
      pointsDelta: 7,
      didCorrectnessChange: true,
      didPointsChange: true,
    });
  });

  test("computes a points-only correction without changing correctness", () => {
    expect(
      reconcileStudentSubmissionOutcome(
        { isCorrect: true, awardedPoints: 10 },
        { isCorrect: true, awardedPoints: 4 }
      )
    ).toEqual({
      authoritativeOutcome: {
        isCorrect: true,
        awardedPoints: 4,
      },
      correctAnswersDelta: 0,
      pointsDelta: -6,
      didCorrectnessChange: false,
      didPointsChange: true,
    });
  });
});

test.describe("durable progression decision", () => {
  test("online progression waits for server confirmation", () => {
    const input = {
      networkState: "online" as const,
      serverConfirmed: false,
      durablePersistenceSucceeded: true,
    };

    expect(getStudentSubmissionProgressionDecision(input)).toBe(
      "wait_for_confirmation"
    );
    expect(canProgressStudentSubmission(input)).toBe(false);
  });

  test("offline progression requires successful durable persistence", () => {
    const notDurable = {
      networkState: "offline" as const,
      serverConfirmed: false,
      durablePersistenceSucceeded: false,
    };
    const durable = {
      ...notDurable,
      durablePersistenceSucceeded: true,
    };

    expect(getStudentSubmissionProgressionDecision(notDurable)).toBe(
      "wait_for_durable_persistence"
    );
    expect(canProgressStudentSubmission(notDurable)).toBe(false);
    expect(getStudentSubmissionProgressionDecision(durable)).toBe(
      "progress_queued_offline"
    );
    expect(canProgressStudentSubmission(durable)).toBe(true);
  });

  test("server confirmation permits progression in either network state", () => {
    for (const networkState of ["online", "offline"] as const) {
      const input = {
        networkState,
        serverConfirmed: true,
        durablePersistenceSucceeded: false,
      };

      expect(getStudentSubmissionProgressionDecision(input)).toBe(
        "progress_confirmed"
      );
      expect(canProgressStudentSubmission(input)).toBe(true);
    }
  });
});
