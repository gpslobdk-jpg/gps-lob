/**
 * live-audit.spec.ts — Stjerneløb Widget Audit
 *
 * Verifies the Klassetrin widget on the Stjerneløb builder page renders
 * as GradeLevelMultiSelect (buttons) and NOT as a native <select>.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants & Auth helpers (mirrors grand-qa-tour.spec.ts)
// ---------------------------------------------------------------------------

const AUDIT_USER_ID = "audit-user-00000000-0000-0000-0000-000000000001";

function makeAuthCookieValue(): string {
  const session = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-refresh-token",
    user: {
      id: AUDIT_USER_ID,
      email: "audit@test.local",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Audit User" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };

  return (
    "base64-" +
    Buffer.from(JSON.stringify(session))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  );
}

async function injectAuthCookie(page: Page) {
  await page.context().addCookies([
    {
      name: "sb-xodrzahqdgbsssntupjt-auth-token.0",
      value: makeAuthCookieValue(),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

async function hideAccessOverlay(page: Page) {
  await page.addStyleTag({
    content: `div[class*="z-1200"] { display: none !important; }`,
  });
}

async function setupSupabaseMocks(page: Page) {
  const ctx = page.context();

  // Auth routes
  await ctx.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 36000,
          refresh_token: "mock-refresh-token",
          user: {
            id: AUDIT_USER_ID,
            email: "audit@test.local",
            role: "authenticated",
            aud: "authenticated",
            app_metadata: { provider: "email" },
            user_metadata: { full_name: "Audit User" },
            created_at: "2024-01-01T00:00:00Z",
          },
        }),
      });
      return;
    }
    if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: AUDIT_USER_ID,
          email: "audit@test.local",
          role: "authenticated",
          aud: "authenticated",
          app_metadata: { provider: "email" },
          user_metadata: { full_name: "Audit User" },
          created_at: "2024-01-01T00:00:00Z",
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // REST routes — return empty arrays
  await ctx.route("**/rest/v1/**", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // Realtime — abort to avoid hanging
  await ctx.route("**/realtime/**", (route: Route) => route.abort());
}

// ---------------------------------------------------------------------------
// TEST
// ---------------------------------------------------------------------------

test.describe("Stjerneløb Widget Audit", () => {
  test("Klassetrin uses GradeLevelMultiSelect, not native <select>", async ({ page }) => {
    await setupSupabaseMocks(page);
    await injectAuthCookie(page);

    await page.goto("/dashboard/opret/stjerneloeb", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await hideAccessOverlay(page);

    // Wait for React hydration
    await page.waitForTimeout(3_000);

    const finalUrl = page.url();
    console.log("[AUDIT] Final URL:", finalUrl);

    // Find all <select> elements on the page
    const selectElements = await page.locator("select").all();
    console.log(`[AUDIT] Found ${selectElements.length} <select> element(s) on page`);

    for (let i = 0; i < selectElements.length; i++) {
      const outerHTML = await selectElements[i].evaluate((el) => el.outerHTML);
      console.log(`[AUDIT] <select> #${i}:`, outerHTML.substring(0, 500));
    }

    // Find the Klassetrin label and inspect its sibling content
    const klassetrinLabel = page.locator("label", { hasText: "Klassetrin" });
    await expect(klassetrinLabel).toBeVisible({ timeout: 10_000 });

    const container = klassetrinLabel.first().locator("..");
    const containerHTML = await container.evaluate((el) => el.outerHTML);
    console.log("[AUDIT] Klassetrin container outerHTML:");
    console.log(containerHTML);

    // ASSERT: No native <select> under Klassetrin
    expect(containerHTML).not.toContain("<select");

    // ASSERT: GradeLevelMultiSelect renders buttons
    expect(containerHTML).toContain("<button");

    // There should be exactly 1 <select> on the page (for "Fag")
    expect(selectElements.length).toBe(1);

    console.log("[AUDIT] ✅ Klassetrin renders GradeLevelMultiSelect (buttons, no native <select>).");
  });
});
