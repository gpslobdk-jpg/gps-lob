import { expect, test } from "@playwright/test";

import {
  buildStoredParticipantFromJoin,
  isFreshParticipantHandoff,
  resolveParticipantStartOffset,
  resolveRestoredPostIndex,
} from "@/components/play/participantHandoff";
import type { StoredActiveParticipant } from "@/components/play/types";
import {
  ACTIVE_PARTICIPANT_STORAGE_KEY,
  getNextRoutePostIndex,
  readStoredActiveParticipant,
} from "@/components/play/playUtils";
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

  test("fresh join passes the disabled avatar gate while preserving registered identity and start offset", () => {
    const stored = buildStoredParticipantFromJoin({
      registration: {
        participantId: "participant-fresh",
        sessionId: "session-fresh",
        studentName: "Hold Blå",
        startOffset: 3,
        teamId: "team-blue",
        teamColor: "blue",
      },
      existingParticipant: null,
      preserveExistingParticipant: false,
      sessionStatus: "running",
      joinedAt: JOINED_AT,
    });

    expect(stored).toEqual({
      participantId: "participant-fresh",
      sessionId: "session-fresh",
      studentName: "Hold Blå",
      startOffset: 3,
      savedAt: JOINED_AT,
      teamId: "team-blue",
      teamColor: "blue",
      avatarUrl: null,
      sessionStatus: "running",
      hasCompletedAvatarGate: true,
    });
  });

  test("rebound legacy false avatar gate is normalized while preserving avatar and server-assigned route", () => {
    const existing: StoredActiveParticipant = {
      participantId: "participant-legacy",
      sessionId: "session-legacy",
      studentName: "Hold Grøn",
      startOffset: 1,
      savedAt: "2026-07-26T09:00:00.000Z",
      avatarUrl: "/avatars/green-star.svg",
      hasCompletedAvatarGate: false,
    };
    const stored = buildStoredParticipantFromJoin({
      registration: {
        participantId: existing.participantId,
        sessionId: existing.sessionId,
        studentName: existing.studentName,
        startOffset: 4,
        teamId: "team-green",
        teamColor: "green",
      },
      existingParticipant: existing,
      preserveExistingParticipant: true,
      sessionStatus: "running",
      joinedAt: JOINED_AT,
    });

    expect(stored).toEqual({
      ...existing,
      startOffset: 4,
      teamId: "team-green",
      teamColor: "green",
      sessionStatus: "running",
      hasCompletedAvatarGate: true,
    });
    expect(existing.hasCompletedAvatarGate).toBe(false);
  });

  test("reload normalizes legacy false avatar gate without changing stored identity, offset or avatar", () => {
    const legacy: StoredActiveParticipant = {
      participantId: "participant-reload",
      sessionId: "session-reload",
      studentName: "Hold Lilla",
      startOffset: 2,
      savedAt: JOINED_AT,
      teamId: "team-purple",
      teamColor: "purple",
      avatarUrl: "/avatars/purple-star.svg",
      sessionStatus: "running",
      hasCompletedAvatarGate: false,
    };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => key === ACTIVE_PARTICIPANT_STORAGE_KEY ? JSON.stringify(legacy) : null,
        },
      },
    });

    try {
      expect(readStoredActiveParticipant()).toEqual({ ...legacy, hasCompletedAvatarGate: true });
      expect(legacy.hasCompletedAvatarGate).toBe(false);
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
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

  test("an all-complete fixed route restores as finished instead of restarting at post zero", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [0, 1, 2, 3, 4],
        answeredPostIndexes: [0, 1, 2, 3, 4],
        snapshotCurrentPostIndex: 4,
        enforceRouteOrder: false,
      })
    ).toBeNull();
  });

  test("an all-complete distributed route restores as finished instead of restarting at its offset", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [3, 4, 0, 1, 2],
        answeredPostIndexes: [0, 1, 2, 3, 4],
        snapshotCurrentPostIndex: 2,
        enforceRouteOrder: true,
      })
    ).toBeNull();
  });

  test("a completed one-post route restores as finished", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [0],
        answeredPostIndexes: [0],
        snapshotCurrentPostIndex: 0,
        enforceRouteOrder: false,
      })
    ).toBeNull();
  });

  test("an invalid empty route fails closed instead of inventing post zero", () => {
    expect(() =>
      resolveRestoredPostIndex({
        routeOrder: [],
        answeredPostIndexes: [],
        snapshotCurrentPostIndex: 0,
        enforceRouteOrder: true,
      })
    ).toThrow("Restore route is empty or invalid");
  });

  test("out-of-order completion selects the first actually unresolved route post", () => {
    expect(getNextRoutePostIndex([0, 1, 2, 3, 4], new Set([0, 1, 3]))).toBe(2);
  });

  test("standard fixed restore ignores a stale later snapshot and selects the first unresolved post", () => {
    expect(
      resolveRestoredPostIndex({
        routeOrder: [0, 1, 2, 3],
        answeredPostIndexes: [],
        snapshotCurrentPostIndex: 2,
        enforceRouteOrder: true,
      })
    ).toBe(0);
  });

  test("legacy special-game snapshots retain the existing permissive restore behavior", () => {
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
