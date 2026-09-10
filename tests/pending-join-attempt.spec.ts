import { expect, test } from "@playwright/test";

import {
  clearPendingJoinAttempt,
  getOrCreatePendingJoinAttempt,
  PENDING_JOIN_ATTEMPT_STORAGE_KEY,
  readPendingJoinAttempt,
} from "@/lib/join/pendingJoinAttempt";

type FakeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createFakeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: FakeStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  return { storage, values };
}

function withFakeWindow<T>(storage: FakeStorage, callback: () => T) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });

  try {
    return callback();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test.describe("pending join attempt", () => {
  test("samme session og holdnavn beholder samme UUID ved retry og reload", () => {
    const { storage } = createFakeStorage();

    withFakeWindow(storage, () => {
      const first = getOrCreatePendingJoinAttempt(
        "session-a",
        "Hold Grøn",
        "2026-09-10T10:00:00.000Z"
      );
      const retry = getOrCreatePendingJoinAttempt(
        "session-a",
        "Hold Grøn",
        "2026-09-10T10:01:00.000Z"
      );

      expect(first.participantId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(retry).toEqual(first);
      expect(readPendingJoinAttempt()).toEqual(first);
    });
  });

  test("en anden session eller et bevidst andet holdnavn får ikke den gamle tilmelding", () => {
    const { storage } = createFakeStorage();

    withFakeWindow(storage, () => {
      const first = getOrCreatePendingJoinAttempt("session-a", "Hold Rød");
      const anotherName = getOrCreatePendingJoinAttempt("session-a", "Hold Blå");
      const anotherSession = getOrCreatePendingJoinAttempt("session-b", "Hold Blå");

      expect(anotherName.participantId).not.toBe(first.participantId);
      expect(anotherSession.participantId).not.toBe(anotherName.participantId);
      expect(readPendingJoinAttempt()).toEqual(anotherSession);
    });
  });

  test("clear fjerner kun det bekræftede forsøg og beskytter et senere forsøg", () => {
    const laterAttempt = {
      participantId: "99999999-9999-4999-8999-999999999999",
      sessionId: "session-later",
      studentName: "Hold Senere",
      createdAt: "2026-09-10T10:00:00.000Z",
    };
    const { storage, values } = createFakeStorage({
      [PENDING_JOIN_ATTEMPT_STORAGE_KEY]: JSON.stringify(laterAttempt),
    });

    withFakeWindow(storage, () => {
      clearPendingJoinAttempt("11111111-1111-4111-8111-111111111111");
      expect(readPendingJoinAttempt()).toEqual(laterAttempt);

      clearPendingJoinAttempt(laterAttempt.participantId);
      expect(values.has(PENDING_JOIN_ATTEMPT_STORAGE_KEY)).toBe(false);
      expect(readPendingJoinAttempt()).toBeNull();
    });
  });

  test("ugyldig gemt data genbruges aldrig som deltageridentitet", () => {
    const { storage } = createFakeStorage({
      [PENDING_JOIN_ATTEMPT_STORAGE_KEY]: JSON.stringify({ participantId: "", sessionId: "session-a" }),
    });

    withFakeWindow(storage, () => {
      expect(readPendingJoinAttempt()).toBeNull();
      const created = getOrCreatePendingJoinAttempt("session-a", "Hold Ny");
      expect(created.participantId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(created.studentName).toBe("Hold Ny");
    });
  });
});
