import { expect, test } from "@playwright/test";
import { parseTeacherFocusState, requestTeacherFocus, saveRunFocusMode } from "@/lib/teacherFocusMode";

test.describe("teacher focus defensive requests", () => {
  test.describe.configure({ mode: "serial" });
  const originalFetch = globalThis.fetch;
  test.afterEach(() => { globalThis.fetch = originalFetch; });

  test("old or missing focus data has no invented active state", () => {
    for (const input of [null, undefined, {}, { enabled: true }, { available: false, enabled: true, participants: [] }]) {
      expect(parseTeacherFocusState(input)).toBeNull();
    }
  });

  test("missing optional participant statistics use safe defaults", () => {
    expect(parseTeacherFocusState({ available: true, enabled: false, participants: [null, {}, { participantId: "test-participant" }] })).toEqual({
      available: true,
      enabled: false,
      participants: [{ participantId: "test-participant", displayName: "Deltager", excluded: false, eventCount: 0, latestEventAt: null, latestDurationMs: null }],
    });
  });

  test("network errors and invalid JSON resolve harmlessly", async () => {
    globalThis.fetch = async () => { throw new Error("synthetic offline"); };
    expect(await requestTeacherFocus("session", { sessionId: "synthetic-session" })).toBeNull();
    expect(await saveRunFocusMode("synthetic-run", true)).toBe(false);
    globalThis.fetch = async () => new Response("not json", { status: 200 });
    expect(await requestTeacherFocus("session", { sessionId: "synthetic-session" })).toBeNull();
  });

  test("unavailable or mismatched saved state never claims a successful setting", async () => {
    for (const [status, body] of [[503, {}], [200, { available: false }], [200, { available: true, enabled: false }]] as const) {
      globalThis.fetch = async () => Response.json(body, { status });
      expect(await saveRunFocusMode("synthetic-run", true)).toBe(false);
    }
  });

  test("setting saves are limited to the dedicated focus API", async () => {
    const requests: Array<{ url: string; method?: string; body: unknown }> = [];
    globalThis.fetch = async (input, init) => {
      requests.push({ url: String(input), method: init?.method, body: JSON.parse(String(init?.body)) });
      return Response.json({ available: true, enabled: true });
    };
    expect(await saveRunFocusMode("synthetic-run", true)).toBe(true);
    expect(requests).toEqual([{ url: "/api/focus-mode/run", method: "PATCH", body: { runId: "synthetic-run", enabled: true } }]);
  });
});
