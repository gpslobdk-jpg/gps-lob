/**
 * ios-join-ui.spec.ts – iPhone 14 WebKit: /join page UI contract
 *
 * Verifies that the /join page on iPhone 14 WebKit presents the calm
 * two-step student flow and nothing that
 * would confuse a student:
 *
 *  1. Code input is visible.
 *  2. Name input is hidden until the code is accepted.
 *  3. QR scanner button is visible.
 *  4. "Fortsæt" is the first primary action.
 *  5. No admin / dashboard / teacher navigation links are visible.
 *  6. No horizontal overflow (page fits the iPhone 14 viewport width).
 *  7. No uncaught JS errors.
 *
 * All fetch calls that would hit a real server are mocked via addInitScript
 * so the mock survives Next.js HMR full reloads on WebKit.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Block realtime WebSocket traffic and intercept fetch calls that would
 *  reach Supabase or the telemetry endpoint. Done via addInitScript so it
 *  is injected before any page script and survives HMR reloads on WebKit. */
async function blockExternalFetch(page: Page) {
  await page.addInitScript(() => {
    // Clear any stored participant so the auto-redirect to /play does NOT fire.
    window.localStorage.clear();

    const _origFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;

      // Absorb telemetry silently.
      if (url.includes("/api/telemetry")) {
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Absorb Supabase calls silently.
      if (url.includes("supabase") || url.includes("realtime")) {
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/join")) {
        return new Response(
          JSON.stringify({
            kind: "active",
            sessionId: "ios-ui-session",
            sessionStatus: "running",
            runTitle: "Skovløbet",
            schedule: null,
            scheduleGate: "active",
            raceType: "quiz",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return _origFetch(input, init);
    };
  });
}

/** Remove maintenance/pause overlay if it appears. */
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

/** Wait for the /join form to be fully stable (handles Next.js HMR reload). */
async function waitForJoinPage(page: Page) {
  const pinInput = page.locator("#join-code");
  await expect(pinInput).toBeVisible({ timeout: 30_000 });

  // If Next.js triggers an HMR reload after initial render, wait for it.
  try {
    await page.waitForEvent("framenavigated", { timeout: 15_000 });
    // Reload happened — wait for re-render.
    await expect(pinInput).toBeVisible({ timeout: 20_000 });
  } catch {
    // No HMR reload within 15 s — page is already stable.
  }

  await page.waitForFunction(() => {
    const input = document.querySelector("#join-code");
    return (
      input !== null &&
      Object.keys(input).some((key) => key.startsWith("__reactProps$"))
    );
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("iOS /join UI contract", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test(
    "/join shows the two-step student controls on iPhone 14",
    async ({ page }) => {
      await blockExternalFetch(page);

      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await page.goto("/join");
      await dismissMaintenanceOverlay(page);
      await waitForJoinPage(page);

      // 1. Pin code input
      const pinInput = page.locator("#join-code");
      await expect(pinInput).toBeVisible();

      // 2. Name input is deferred until a valid code has been looked up.
      const nameInput = page.locator("#join-name");
      await expect(nameInput).toBeHidden();

      // 3. QR scanner button (rendered by QRScannerModal)
      const qrButton = page.getByRole("button", { name: /scan qr/i });
      await expect(qrButton).toBeVisible();

      // 4. Submit button
      const continueButton = page.getByRole("button", { name: /^fortsæt$/i });
      await expect(continueButton).toBeVisible();

      await pinInput.fill("492173");
      await pinInput.press("Enter");
      await expect(nameInput).toBeVisible();
      await expect(page.getByRole("button", { name: /deltag i løbet/i })).toBeVisible();

      // 5. No teacher / admin / dashboard links visible
      //    The join page has no such links in the main form; verify this holds.
      await expect(page.getByRole("link", { name: /dashboard/i })).not.toBeVisible();
      await expect(page.getByRole("link", { name: /opret løb/i })).not.toBeVisible();
      await expect(page.getByRole("link", { name: /admin/i })).not.toBeVisible();

      // 6. No horizontal overflow — page must fit iPhone 14 viewport width (390 px)
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow, "Horizontal overflow detected on /join").toBe(false);

      // 7. No critical uncaught JS errors
      const criticalErrors = pageErrors.filter(
        (msg) =>
          msg.includes("TypeError") ||
          msg.includes("SyntaxError") ||
          msg.includes("ReferenceError"),
      );
      expect(criticalErrors, `Uncaught JS errors: ${criticalErrors.join(", ")}`).toHaveLength(0);
    },
  );
});
