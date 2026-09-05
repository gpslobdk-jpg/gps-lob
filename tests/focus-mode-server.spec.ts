import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { isFocusUuid, parseFocusReturnEvent, FOCUS_MODE_GRACE_MS, FOCUS_MODE_UNAVAILABLE } from "@/lib/focusMode";
import { ensureFocusSession, readFocusParticipantPolicy, readFocusRun, type FocusDatabase, type FocusSession } from "@/lib/focusModeServer";
import { ownedFocusRun, ownedFocusSession } from "@/app/api/focus-mode/_shared";
import { GET as getParticipant, POST as postParticipant } from "@/app/api/focus-mode/participant/route";

const sessionId = "11111111-1111-4111-8111-111111111111";
const participantId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const revision = "44444444-4444-4444-8444-444444444444";
const teacherId = "55555555-5555-4555-8555-555555555555";
const now = Date.now();

const session: FocusSession = { id: sessionId, run_id: runId, teacher_id: teacherId, status: "running", created_at: new Date(now - 60_000).toISOString() };

function validEvent(overrides = {}) {
  return {
    eventId: participantId, policyRevision: `${revision}:0`,
    hiddenAt: new Date(now - 10_000).toISOString(), returnedAt: new Date(now).toISOString(), durationMs: 10_000,
    ...overrides,
  };
}

function fakeDatabase(tables: Record<string, Array<Record<string, unknown>>>, errors: string[] = []) {
  const writes: string[] = [];
  const db = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        async maybeSingle() {
          return { data: (tables[table] ?? []).find(row => filters.every(([key, value]) => row[key] === value)) ?? null, error: errors.includes(table) ? { message: "synthetic unavailable" } : null };
        },
        async upsert(row: Record<string, unknown>) {
          writes.push(table);
          tables[table] = [...(tables[table] ?? []), { revision, ...row }];
          return { error: errors.includes(table) ? {} : null };
        },
      };
      return query;
    },
  } as unknown as FocusDatabase;
  return { db, writes };
}

test.describe("Focus Mode server boundaries", () => {
  test("requires a valid UUID and returns only allowlisted event metadata", () => {
    expect(isFocusUuid(sessionId)).toBe(true);
    for (const value of [null, "", "session", [], sessionId + "x"]) expect(isFocusUuid(value)).toBe(false);
    const parsed = parseFocusReturnEvent(validEvent({ url: "https://example.invalid", studentName: "synthetic" }), now);
    expect(parsed).toEqual(validEvent());
    expect(Object.keys(parsed!)).toEqual(["eventId", "hiddenAt", "returnedAt", "durationMs", "policyRevision"]);
  });

  test("rejects short, impossible, stale, oversized and malformed intervals", () => {
    for (const event of [
      validEvent({ hiddenAt: new Date(now - FOCUS_MODE_GRACE_MS + 1).toISOString(), durationMs: FOCUS_MODE_GRACE_MS - 1 }),
      validEvent({ durationMs: 1 }), validEvent({ durationMs: Infinity }),
      validEvent({ hiddenAt: new Date(now - 1_800_001).toISOString(), durationMs: 1_800_001 }),
      validEvent({ returnedAt: new Date(now - 61_000).toISOString() }),
      validEvent({ hiddenAt: new Date(now).toISOString(), returnedAt: new Date(now + 6_000).toISOString(), durationMs: 6_000 }),
      validEvent({ policyRevision: `${revision}:0:1` }), validEvent({ policyRevision: `${revision}:-1` }),
      validEvent({ hiddenAt: "invalid" }), validEvent({ eventId: "unsafe" }),
    ]) expect(parseFocusReturnEvent(event, now)).toBeNull();
    expect(parseFocusReturnEvent(validEvent({ hiddenAt: new Date(now - FOCUS_MODE_GRACE_MS).toISOString(), durationMs: FOCUS_MODE_GRACE_MS }), now)).not.toBeNull();
  });

  test("legacy runs default off and create only isolated focus settings", async () => {
    const { db, writes } = fakeDatabase({});
    expect(await readFocusRun(db, runId)).toBe(false);
    expect((await ensureFocusSession(db, session))?.enabled).toBe(false);
    expect(writes).toEqual(["focus_session_settings"]);
  });

  test("does not recreate focus data for closed or seven-day-old sessions", async () => {
    const { db, writes } = fakeDatabase({ focus_run_settings: [{ run_id: runId, enabled: true }] });
    expect(await ensureFocusSession(db, { ...session, status: "finished" })).toBeNull();
    expect(await ensureFocusSession(db, { ...session, created_at: new Date(now - 8 * 86_400_000).toISOString() })).toBeNull();
    expect(writes).toEqual([]);
  });

  test("run settings require material ownership; session controls require its executing teacher", async () => {
    const { db } = fakeDatabase({ live_sessions: [session], gps_runs: [{ id: runId, user_id: teacherId }] });
    expect(await ownedFocusRun({ db, userId: teacherId }, runId)).toBe(true);
    expect(await ownedFocusSession({ db, userId: teacherId }, sessionId)).toEqual(session);
    expect(await ownedFocusSession({ db, userId: participantId }, sessionId)).toBeNull();
    const differentOwner = fakeDatabase({ live_sessions: [session], gps_runs: [{ id: runId, user_id: participantId }] });
    expect(await ownedFocusRun({ db: differentOwner.db, userId: teacherId }, runId)).toBe(false);
    expect(await ownedFocusSession({ db: differentOwner.db, userId: teacherId }, sessionId)).toEqual(session);
  });

  test("tracking excludes waiting, paused, finished participants and exemptions", async () => {
    for (const scenario of [
      { status: "running", excluded: false, finished: false, expected: true },
      { status: "paused", excluded: false, finished: false, expected: false },
      { status: "waiting", excluded: false, finished: false, expected: false },
      { status: "running", excluded: true, finished: false, expected: false },
      { status: "running", excluded: false, finished: true, expected: false },
    ]) {
      const { db } = fakeDatabase({
        focus_session_settings: [{ session_id: sessionId, enabled: true, revision, expires_at: new Date(now + 60_000).toISOString() }],
        focus_participant_state: [{ session_id: sessionId, participant_id: participantId, excluded: scenario.excluded, revision: 4 }],
        participants: [{ id: participantId, session_id: sessionId, finished_at: scenario.finished ? new Date(now).toISOString() : null }],
      });
      const policy = await readFocusParticipantPolicy(db, { ...session, status: scenario.status }, participantId);
      expect(policy.tracking).toBe(scenario.expected);
      expect(policy.policyRevision).toBe(`${revision}:4`);
    }
  });

  test("missing migration fails independently before creating any side effects", async () => {
    const { db, writes } = fakeDatabase({}, ["focus_session_settings"]);
    await expect(ensureFocusSession(db, session)).rejects.toThrow("Focus settings unavailable");
    expect(writes).toEqual([]);
  });

  test("central rollback switch disables reads and event writes without needing auth or DB", async () => {
    const previous = process.env.FOCUS_MODE_DISABLED;
    process.env.FOCUS_MODE_DISABLED = "true";
    try {
      const response = await getParticipant(new NextRequest(`http://localhost/api/focus-mode/participant?sessionId=${sessionId}&participantId=${participantId}`));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(FOCUS_MODE_UNAVAILABLE);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      const post = await postParticipant(new NextRequest("http://localhost/api/focus-mode/participant", { method: "POST", body: JSON.stringify(validEvent()) }));
      expect(await post.json()).toEqual({ available: false, accepted: false });
    } finally {
      if (previous === undefined) delete process.env.FOCUS_MODE_DISABLED;
      else process.env.FOCUS_MODE_DISABLED = previous;
    }
  });
});
