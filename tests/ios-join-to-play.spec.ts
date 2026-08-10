/**
 * ios-join-to-play.spec.ts – iPhone 14 WebKit: full join flow redirects to /play
 *
 * Simulates a student entering code, continuing to the name step and joining.
 * Asserts the browser navigates to /play/[sessionId].
 *
 * Two-step join flow mocked via addInitScript:
 *   Step 1 – GET /api/join?pin=...  → lookup  → {kind:"active", sessionId, ...}
 *   Step 2 – POST /api/join         → register → {participantId, sessionId, ...}
 *
 * After a successful register the app calls router.push(/play/[sessionId]).
 * The test asserts the URL changes, proving the iOS Safari router.push() path
 * works without crashing.
 *
 * addInitScript is used so mocks survive any Next.js HMR full reload on WebKit.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = "ios-join-session-001";
const PARTICIPANT_ID = "ddddeeee-1111-2222-3333-ffffffffffff";
const STUDENT_NAME = "TestElev";
const PIN = "492173"; // 6-digit pin — matches JOIN_PIN_LENGTH

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inject join-flow fetch mocks via addInitScript (WebKit/HMR-proof).
 *  Also clears localStorage so the auto-redirect to /play doesn't fire. */
async function mountJoinMocks(page: Page) {
  await page.addInitScript(
    ({ sessionId, participantId, studentName }) => {
      // Clear stored participant to prevent auto-redirect.
      window.localStorage.clear();

      const _origFetch = window.fetch.bind(window);
      window.fetch = async function (input, init) {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;
        const method = ((init?.method as string) || "GET").toUpperCase();

        // Step 1 – GET /api/join?pin=… → lookup
        if (url.includes("/api/join") && method === "GET") {
          return new Response(
            JSON.stringify({
              kind: "active",
              sessionId,
              sessionStatus: "running",
              runTitle: "iOS Testløb",
              schedule: null,
              scheduleGate: "active",
              raceType: "quiz",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // Step 2 – POST /api/join → register
        if (url.includes("/api/join") && method === "POST") {
          return new Response(
            JSON.stringify({
              participantId,
              sessionId,
              studentName,
              sessionStatus: "running",
              teamId: null,
              teamName: null,
              teamColor: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // Absorb telemetry and Supabase silently.
        if (
          url.includes("/api/telemetry") ||
          url.includes("supabase") ||
          url.includes("realtime")
        ) {
          return new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return _origFetch(input, init);
      };
    },
    { sessionId: SESSION_ID, participantId: PARTICIPANT_ID, studentName: STUDENT_NAME },
  );
}

/** Remove maintenance overlay if present. */
async function dismissMaintenanceOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((el) => {
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.includes("fixed") && cls.includes("inset-0")) {
        const text = el.textContent ?? "";
        if (text.includes("lukke siden ned") || text.includes("Vi holder pause")) {
          el.remove();
        }
      }
    });
  });
}

/** Wait for the /join form to be fully stable, draining HMR reloads.
 *
 *  WebKit + Next.js dev server can trigger multiple full-page reloads while
 *  it compiles chunks. We drain framenavigated events until the page is
 *  quiet for 3 consecutive seconds OR until the 25-second budget expires —
 *  whichever comes first. This prevents the loop from consuming the entire
 *  test timeout. */
async function waitForJoinForm(page: Page) {
  const startButton = page.getByRole("button", {
    name: "Deltag i et løb",
    exact: true,
  });
  await expect(startButton).toBeVisible({ timeout: 30_000 });

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    try {
      await page.waitForEvent("framenavigated", { timeout: 3_000 });
      await expect(startButton).toBeVisible({ timeout: 15_000 });
    } catch {
      break; // No reload in 3 s → page is stable.
    }
  }

  await page.waitForFunction(() => {
    const input = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Deltag i et løb",
    );
    return (
      input !== undefined &&
      Object.keys(input).some((key) => key.startsWith("__reactProps$"))
    );
  });

  await startButton.click();
  await expect(page.locator("#join-code")).toBeVisible();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("iOS join → /play redirect", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("code then name navigates to /play/[sessionId]", async ({ page }) => {
    await mountJoinMocks(page);

    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/join");
    await dismissMaintenanceOverlay(page);
    await waitForJoinForm(page);

    const pinInput = page.locator("#join-code");
    const nameInput = page.locator("#join-name");

    // Keep the whole code → name → navigation sequence resilient to a
    // one-off WebKit dev-server reload.
    let navigationDone = false;
    for (let cycle = 0; cycle < 4 && !navigationDone; cycle++) {
      try {
        await expect(pinInput).toBeVisible({ timeout: 15_000 });
        await pinInput.fill(PIN);
        await expect(pinInput).toHaveValue(PIN);
        await pinInput.press("Enter");

        await expect(nameInput).toBeVisible({ timeout: 15_000 });
        await nameInput.fill(STUDENT_NAME);
        await expect(nameInput).toHaveValue(STUDENT_NAME);

        const navPromise = page.waitForURL(
          new RegExp(`/play/${SESSION_ID}`),
          { timeout: 45_000 },
        );
        await nameInput.press("Enter");
        await navPromise;
        navigationDone = true;
      } catch {
        await page.goto("/join");
        await dismissMaintenanceOverlay(page);
        await waitForJoinForm(page);
      }
    }
    expect(navigationDone, "Navigation to /play never happened").toBe(true);

    // Final assertion: we are on the correct /play path.
    expect(page.url()).toContain(`/play/${SESSION_ID}`);

    // No critical errors during the join flow.
    const criticalErrors = pageErrors.filter(
      (e) =>
        e.message.includes("TypeError") ||
        e.message.includes("SyntaxError") ||
        e.message.includes("Cannot read properties"),
    );
    expect(
      criticalErrors,
      `Uncaught errors: ${criticalErrors.map((e) => e.message).join("; ")}`,
    ).toHaveLength(0);
  });
});
