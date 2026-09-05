import { expect, test, type Page } from "@playwright/test";

import { FOCUS_MODE_POLL_MS } from "@/lib/focusMode";

import {
  DEFAULT_STANDARD_QUESTIONS,
  openHarnessedPlay,
  STANDARD_PLAY_POST_LAT,
  STANDARD_PLAY_POST_LNG,
  type StandardPlayHarnessState,
} from "./helpers/standardPlayV2Harness";

test.use({ serviceWorkers: "block" });

type FocusMock = {
  available: boolean;
  enabled: boolean;
  exempt: boolean;
  tracking: boolean;
  revision: string;
  failGet: boolean;
  failPost: boolean;
  failRealtime: boolean;
  events: Array<Record<string, unknown>>;
  gets: number;
};

type FocusObservation = { pendingReads: number; reads: number; tracking: boolean; revision: string | null };
type FocusHarnessWindow = typeof window & {
  __setFocusVisibility?: (next: DocumentVisibilityState) => void;
  __focusObservation: FocusObservation;
};

async function installFocusHarness(page: Page, initial?: Partial<FocusMock>) {
  // iOS already shows a dismissible fullscreen tip above the play controls.
  // Close it as a pupil would, before interacting with the separate focus notice.
  await page.addLocatorHandler(page.getByRole("button", { name: "Luk advarsel", exact: true }), async (button) => {
    await button.click();
  });
  const focus: FocusMock = {
    available: true, enabled: true, exempt: false, tracking: true,
    revision: "90000000-0000-4000-8000-000000000001:0",
    failGet: false, failPost: false, failRealtime: false, events: [], gets: 0,
    ...initial,
  };
  await page.addInitScript(({ failRealtime }) => {
    // Only the explicit resilience case stresses existing core reconnects.
    // Focus itself has no realtime subscription; other cases use the existing
    // standard-play harness without an added stream of channel errors.
    if (failRealtime) {
      const NativeWebSocket = window.WebSocket;
      window.WebSocket = class extends NativeWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(/realtime|supabase/i.test(String(url)) ? "ws://127.0.0.1:1/synthetic-realtime-failure" : url, protocols);
        }
      };
    }
    // Observe when the application consumes a policy body, rather than merely
    // counting requests that may still be pending or cancelled during bootstrap.
    const observation = { pendingReads: 0, reads: 0, tracking: false, revision: null as string | null };
    (window as FocusHarnessWindow).__focusObservation = observation;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (!url.includes("/api/focus-mode/participant") || method !== "GET") return nativeFetch(input, init);
      observation.pendingReads += 1;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        observation.pendingReads -= 1;
      };
      try {
        const response = await nativeFetch(input, init);
        if (!response.ok) {
          finish();
          return response;
        }
        const nativeJson = response.json.bind(response);
        response.json = async () => {
          try {
            const data = await nativeJson();
            observation.reads += 1;
            observation.tracking = data?.tracking === true;
            observation.revision = typeof data?.policyRevision === "string" ? data.policyRevision : null;
            return data;
          } finally { finish(); }
        };
        return response;
      } catch (error) {
        finish();
        throw error;
      }
    };
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => visibility === "hidden" });
    (window as Window & { __setFocusVisibility?: (next: DocumentVisibilityState) => void }).__setFocusVisibility = (next) => {
      visibility = next;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  }, { failRealtime: focus.failRealtime });
  await page.route("**/api/focus-mode/participant**", async (route) => {
    const isPost = route.request().method() === "POST";
    if (isPost) focus.events.push(route.request().postDataJSON());
    else focus.gets += 1;
    await route.fulfill({
      status: (isPost ? focus.failPost : focus.failGet) ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(isPost ? { ok: !focus.failPost } : {
        available: focus.available,
        enabled: focus.enabled,
        exempt: focus.exempt,
        tracking: focus.enabled && !focus.exempt && focus.tracking,
        policyRevision: focus.revision,
        graceMs: 3_000,
      }),
    });
  });
  return focus;
}

async function visibility(page: Page, next: DocumentVisibilityState) {
  await page.evaluate((state) => {
    (window as Window & { __setFocusVisibility?: (next: DocumentVisibilityState) => void }).__setFocusVisibility?.(state);
  }, next);
}

async function settleFocusPolicy(page: Page, expectedRevision: string) {
  // The notice is intentionally visible before gameplay starts. Let the first
  // active render and its canTrack effect settle before simulating an absence.
  const settleRender = () => page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await settleRender();
  await expect.poll(() => page.evaluate(() => (window as FocusHarnessWindow).__focusObservation.pendingReads)).toBe(0);
  const before = await page.evaluate(() => (window as FocusHarnessWindow).__focusObservation.reads);
  await visibility(page, "visible");
  await expect.poll(() => page.evaluate(() => (window as FocusHarnessWindow).__focusObservation.reads)).toBeGreaterThan(before);
  await settleRender();
  const consumed = await page.evaluate(() => (window as FocusHarnessWindow).__focusObservation);
  expect(consumed.revision).toBe(expectedRevision);
  expect(consumed.tracking).toBe(true);
}

async function leaveAndReturn(page: Page, durationMs = 3_150) {
  await visibility(page, "hidden");
  await page.waitForTimeout(durationMs);
  await visibility(page, "visible");
}

async function answerCurrentPost(page: Page, play: StandardPlayHarnessState, postIndex: number, answer: string) {
  // Returning to the page also starts the existing asynchronous core restore.
  // Its authoritative snapshot may close an unanswered question back to the
  // map. Reopen only that unanswered post through its visible control. Match
  // openStandardQuestion's DOM click so an entrance animation does not consume
  // the entire WebKit timeout while the core snapshot replaces the element.
  await expect(async () => {
    if (play.answeredPostIndexes.has(postIndex)) return;
    const openPost = page.getByRole("button", { name: "Åbn post", exact: true });
    if (await openPost.isVisible()) {
      await expect(openPost).toBeEnabled({ timeout: 1200 });
      await openPost.evaluate((button) => (button as HTMLButtonElement).click(), undefined, { timeout: 1200 });
    }
    await expect(page.getByText(DEFAULT_STANDARD_QUESTIONS[postIndex].text, { exact: true })).toBeVisible({ timeout: 1200 });
    const answerButton = page.getByRole("button", { name: answer, exact: true });
    await expect(answerButton).toBeVisible({ timeout: 1200 });
    await expect(answerButton).toBeEnabled({ timeout: 1200 });
    await answerButton.evaluate((button) => (button as HTMLButtonElement).click(), undefined, { timeout: 1200 });
    await expect.poll(() => play.answeredPostIndexes.has(postIndex), { timeout: 1500 }).toBe(true);
  }).toPass({ timeout: 20_000, intervals: [500, 1000] });
}

async function completeTwoPostRun(page: Page, play: StandardPlayHarnessState) {
  await answerCurrentPost(page, play, 0, "Sommerfuglen");
  // A concurrent authoritative snapshot can advance immediately, replacing
  // the optional success/next panel. Both supported paths must reach post 2.
  const next = page.getByRole("button", { name: /gå til næste post/i });
  const secondPost = page.getByText("Post 2 af 2", { exact: true });
  await expect(next.or(secondPost).first()).toBeVisible();
  if (await next.isVisible()) {
    await next.click({ timeout: 1500 }).catch(async () => {
      await expect(secondPost).toBeVisible();
    });
  }
  await expect(secondPost).toBeVisible();
  await answerCurrentPost(page, play, 1, "8");
  const results = page.getByRole("button", { name: /se resultat/i });
  await expect(results.or(page.getByText(/Løbet er slut\./i))).toBeVisible();
  if (await results.isVisible()) {
    // The authoritative finish snapshot can replace this optional button while
    // Playwright waits for its animation. Completion itself remains required.
    await results.click({ timeout: 1500 }).catch(async () => {
      await expect(page.getByText(/Løbet er slut\./i)).toBeVisible();
    });
  }
  await expect(page.getByText(/Løbet er slut\./i)).toBeVisible();
  expect([...play.answeredPostIndexes].sort()).toEqual([0, 1]);
  expect(play.submitRequests).toHaveLength(2);
}

test("active notice is clear and dismissible; duplicate visibility and resume yield one event", async ({ page }) => {
  const focus = await installFocusHarness(page);
  const play = await openHarnessedPlay(page, { sessionId: "focus-active-return" });
  await expect(page.getByTestId("standard-play-v2")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByText("Fokusmode er aktiv", { exact: true })).toBeVisible();
  await expect(page.getByText("SkoleGPS kan ikke se, hvilke apps eller hjemmesider du åbner.")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("focus-notice.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Skjul information om Fokusmode" }).click();
  await settleFocusPolicy(page, focus.revision);
  await leaveAndReturn(page, 100);
  await settleFocusPolicy(page, focus.revision);
  expect(focus.events).toHaveLength(0);
  await visibility(page, "hidden");
  await visibility(page, "hidden");
  await page.waitForTimeout(3_150);
  await visibility(page, "visible");
  await visibility(page, "visible");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect.poll(() => focus.events.length).toBe(1);
  expect(focus.events[0].durationMs).toBeGreaterThanOrEqual(3_000);
  expect(Object.keys(focus.events[0]).sort()).toEqual([
    "durationMs", "eventId", "hiddenAt", "participantId", "policyRevision", "returnedAt", "sessionId",
  ]);
  await completeTwoPostRun(page, play);
  await expect(page.getByTestId("student-focus-mode")).toHaveCount(0);
});

for (const scenario of ["off", "missing", "api-failure"] as const) {
  test(`${scenario} leaves legacy play, answers, progression and finish usable`, async ({ page }) => {
    const focus = await installFocusHarness(page, {
      enabled: scenario !== "off",
      available: scenario !== "missing",
      failGet: scenario === "api-failure",
    });
    const play = await openHarnessedPlay(page, { sessionId: `focus-${scenario}` });
    await expect(page.getByTestId("standard-play-v2")).toBeVisible({ timeout: 35_000 });
    await expect.poll(() => focus.gets).toBeGreaterThan(0);
    await expect(page.getByTestId("student-focus-mode")).toHaveCount(0);
    await leaveAndReturn(page);
    await completeTwoPostRun(page, play);
    expect(focus.events).toHaveLength(0);
    expect([...play.answeredPostIndexes]).toEqual([0, 1]);
  });
}

test("failed focus event and unavailable realtime leave GPS, post and completion usable", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: STANDARD_PLAY_POST_LAT + 0.0005, longitude: STANDARD_PLAY_POST_LNG, accuracy: 8 });
  const focus = await installFocusHarness(page, { failPost: true, failRealtime: true });
  const play = await openHarnessedPlay(page, {
    sessionId: "focus-gps-fail-open", gpsOverride: false,
    questions: [DEFAULT_STANDARD_QUESTIONS[0]],
  });
  await expect(page.getByTestId("standard-play-v2")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByText("Fokusmode er aktiv", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skjul information om Fokusmode" }).click();
  const allowLocation = page.getByRole("button", { name: "Tillad placering", exact: true });
  if (await allowLocation.isVisible()) await allowLocation.click();
  // A previously granted browser permission may already have started GPS.
  // Require an actual production marker in either path before testing failure.
  await expect(page.locator(".gpslob-player-dot-icon")).toBeVisible({ timeout: 20_000 });
  await settleFocusPolicy(page, focus.revision);
  await leaveAndReturn(page);
  await expect.poll(() => focus.events.length).toBe(1);
  // Walk approximately 28 m into the post radius. A kilometre-scale teleport
  // would correctly be rejected by the existing GPS jump protection.
  await context.setGeolocation({ latitude: STANDARD_PLAY_POST_LAT + 0.00025, longitude: STANDARD_PLAY_POST_LNG, accuracy: 8 });
  await answerCurrentPost(page, play, 0, "Sommerfuglen");
  const results = page.getByRole("button", { name: /se resultat/i });
  await expect(results.or(page.getByText(/Løbet er slut\./i))).toBeVisible();
  if (await results.isVisible()) {
    await results.click({ timeout: 1500 }).catch(async () => {
      await expect(page.getByText(/Løbet er slut\./i)).toBeVisible();
    });
  }
  await expect(page.getByText(/Løbet er slut\./i)).toBeVisible();
  expect([...play.answeredPostIndexes]).toEqual([0]);
  expect(play.submitRequests).toHaveLength(1);
});

test("session toggles and participant exemption cancel a hidden interval and update the notice", async ({ page }) => {
  const focus = await installFocusHarness(page);
  const play = await openHarnessedPlay(page, { sessionId: "focus-toggle-exempt" });
  await expect(page.getByTestId("standard-play-v2")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByTestId("student-focus-mode")).toBeVisible();
  await settleFocusPolicy(page, focus.revision);
  await visibility(page, "hidden");
  focus.revision = "90000000-0000-4000-8000-000000000002:0";
  await page.waitForTimeout(3_150);
  await visibility(page, "visible");
  await settleFocusPolicy(page, focus.revision);
  expect(focus.events).toHaveLength(0);

  focus.exempt = true;
  focus.revision = "90000000-0000-4000-8000-000000000002:1";
  await visibility(page, "visible");
  await expect(page.getByTestId("student-focus-mode")).toHaveCount(0, { timeout: FOCUS_MODE_POLL_MS + 5_000 });
  focus.exempt = false;
  focus.revision = "90000000-0000-4000-8000-000000000002:2";
  await visibility(page, "visible");
  await expect(page.getByTestId("student-focus-mode")).toBeVisible({ timeout: FOCUS_MODE_POLL_MS + 5_000 });
  focus.enabled = false;
  await visibility(page, "visible");
  await expect(page.getByTestId("student-focus-mode")).toHaveCount(0, { timeout: FOCUS_MODE_POLL_MS + 5_000 });
  await completeTwoPostRun(page, play);
});

test("native file picker, pagehide and reload discard ambiguous hidden intervals", async ({ page }) => {
  const focus = await installFocusHarness(page);
  await openHarnessedPlay(page, { sessionId: "focus-lifecycle-noise" });
  await expect(page.getByTestId("standard-play-v2")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByTestId("student-focus-mode")).toBeVisible();
  await settleFocusPolicy(page, focus.revision);
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.addEventListener("click", (event) => event.preventDefault());
    document.body.append(input);
    input.click();
    input.remove();
  });
  await leaveAndReturn(page);
  expect(focus.events).toHaveLength(0);
  await visibility(page, "hidden");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await page.waitForTimeout(3_150);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await visibility(page, "visible");
  expect(focus.events).toHaveLength(0);
  await visibility(page, "hidden");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("student-focus-mode")).toBeVisible();
  expect(focus.events).toHaveLength(0);
});

test("waiting students see the notice before start without registering waiting time", async ({ page }) => {
  const focus = await installFocusHarness(page, { tracking: false });
  await openHarnessedPlay(page, { sessionId: "focus-waiting", sessionStatus: "waiting" });
  await expect(page.getByText("Fokusmode er aktiv", { exact: true })).toBeVisible();
  await leaveAndReturn(page);
  expect(focus.events).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Skjul information om Fokusmode" })).toBeEnabled();
});
