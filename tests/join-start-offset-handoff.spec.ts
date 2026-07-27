import { expect, test } from "@playwright/test";

import {
  buildStoredParticipantFromJoin,
  isFreshParticipantHandoff,
  resolveParticipantStartOffset,
  resolveRestoredPostIndex,
} from "@/components/play/participantHandoff";
import type { StoredActiveParticipant } from "@/components/play/types";
import { buildCircularRouteOrder } from "@/lib/routes/postOrderPolicy";

const JOINED_AT = "2026-07-26T10:00:00.000Z";

test.describe("normal join start-offset handoff", () => {
  test("persists the server-assigned nonzero offset for the fresh /join -> /play handoff", () => {
    const stored = buildStoredParticipantFromJoin({
      registration: {
        participantId: "participant-1",
        sessionId: "session-1",
        studentName: "Hold Grøn",
        startOffset: 3,
        teamId: null,
        teamColor: null,
      },
      existingParticipant: null,
      preserveExistingParticipant: false,
      sessionStatus: "running",
      joinedAt: JOINED_AT,
    });

    expect(stored).toMatchObject({
      participantId: "participant-1",
      sessionId: "session-1",
      studentName: "Hold Grøn",
      startOffset: 3,
      savedAt: JOINED_AT,
      sessionStatus: "running",
    });
    expect(isFreshParticipantHandoff(stored.savedAt, false, Date.parse(JOINED_AT) + 1_000)).toBe(
      true
    );
  });

  test("treats a stored play snapshot as reload and lets restore use the server value", () => {
    expect(isFreshParticipantHandoff(JOINED_AT, true, Date.parse(JOINED_AT) + 1_000)).toBe(false);
  });

  test("reload keeps the same circular route and lets the DB offset win", () => {
    const storedOffset = 2;
    const routeBeforeReload = buildCircularRouteOrder(5, storedOffset);
    const restoredOffset = resolveParticipantStartOffset("2", 4);
    const routeAfterReload = buildCircularRouteOrder(5, restoredOffset);

    expect(restoredOffset).toBe(2);
    expect(routeAfterReload).toEqual(routeBeforeReload);
    expect(routeAfterReload).toEqual([2, 3, 4, 0, 1]);
  });

  test("server offset is authoritative when an existing participant is rebound", () => {
    const existingParticipant: StoredActiveParticipant = {
      participantId: "participant-1",
      sessionId: "session-1",
      studentName: "Hold Grøn",
      startOffset: 1,
      savedAt: "2026-07-26T09:00:00.000Z",
    };

    const stored = buildStoredParticipantFromJoin({
      registration: {
        participantId: "participant-1",
        sessionId: "session-1",
        studentName: "Hold Grøn",
        startOffset: 4,
      },
      existingParticipant,
      preserveExistingParticipant: true,
      sessionStatus: "running",
      joinedAt: JOINED_AT,
    });

    expect(stored.startOffset).toBe(4);
    expect(stored.savedAt).toBe(existingParticipant.savedAt);
  });

  test("an immediate startup snapshot at post zero cannot override a distributed route", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [3, 4, 0, 1, 2],
        answeredPostIndexes: [],
        snapshotCurrentPostIndex: 0,
        enforceRouteOrder: true,
      })
    ).toBe(3);
  });

  test("a progressed distributed snapshot resumes at the next unresolved route post", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [3, 4, 0, 1, 2],
        answeredPostIndexes: [3],
        snapshotCurrentPostIndex: 4,
        enforceRouteOrder: true,
      })
    ).toBe(4);
  });

  test("answered offline progress sanitizes the snapshot to the next route post", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [3, 4, 0, 1, 2],
        answeredPostIndexes: [3],
        snapshotCurrentPostIndex: 3,
        enforceRouteOrder: true,
      })
    ).toBe(4);
  });

  test("a progressed distributed route may legitimately wrap around to post zero", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [3, 4, 0, 1, 2],
        answeredPostIndexes: [3, 4],
        snapshotCurrentPostIndex: 0,
        enforceRouteOrder: true,
      })
    ).toBe(0);
  });

  test("fixed and special-game snapshots retain the existing permissive restore behavior", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [0, 1, 2, 3],
        answeredPostIndexes: [],
        snapshotCurrentPostIndex: 2,
        enforceRouteOrder: false,
      })
    ).toBe(2);
  });

  test("uses the existing offset only when a rebound response omits the server value", () => {
    const stored = buildStoredParticipantFromJoin({
      registration: {
        participantId: "participant-1",
        sessionId: "session-1",
        studentName: "Hold Grøn",
      },
      existingParticipant: {
        participantId: "participant-1",
        sessionId: "session-1",
        studentName: "Hold Grøn",
        startOffset: 2,
        savedAt: "2026-07-26T09:00:00.000Z",
      },
      preserveExistingParticipant: true,
      sessionStatus: "running",
      joinedAt: JOINED_AT,
    });

    expect(stored.startOffset).toBe(2);
  });
});
