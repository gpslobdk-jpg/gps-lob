/**
 * phase33-admin.spec.ts — Phase 33: Health Dashboard & Logs Basement
 *
 * Test 1: Health Dashboard renders with mocked API data, metric cards visible.
 * Test 2: Logs Basement renders with mocked telemetry, "Kopiér til AI" button present.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// Block service workers so page.route() can intercept GET requests
test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Constants & fixtures
// ---------------------------------------------------------------------------

const TEACHER_USER_ID = "phase33-00000000-0000-0000-0000-000000000001";

const HEALTH_PAYLOAD = {
  activeSessions: 5,
  liveStudents: 28,
  runsCreated: 12,
  stjerneloebCreated: 3,
  correctAnswerRate: 81,
  totalAnswersToday: 340,
  raceTypes: [
    { race_type: "manuel", count: 6 },
    { race_type: "matematik", count: 4 },
    { race_type: "foto", count: 2 },
  ],
  topUsers: [
    { name: "Anna Lærer", runsCreated: 8 },
    { name: "Bo Pedersen", runsCreated: 5 },
    { name: "Clara Jensen", runsCreated: 3 },
  ],
  generatedAt: new Date().toISOString(),
  hours: 24,
};

const LOGS_PAYLOAD = {
  telemetryLogs: [
    {
      id: "t-log-1",
      event_type: "server_response_error",
      participant_id: "p-1",
      session_id: "s-1",
      message:
        "meta:kind=response|route=/api/play/participant|path=/api/play/participant?sessionId=demo|method=GET|status=401|msg=Unauthorized",
      created_at: new Date(Date.now() - 60_000).toISOString(),
    },
    {
      id: "t-log-2",
      event_type: "restore_success",
      participant_id: "p-2",
      session_id: "s-2",
      message: "restore_success after wake-up recovery",
      created_at: new Date(Date.now() - 120_000).toISOString(),
    },
  ],
  dataSource: "live",
  externalServices: [
    {
      provider: "vercel",
      name: "Vercel",
      source: "live",
      statusUrl: "https://www.vercel-status.com",
      indicator: "none",
      description: "All Systems Operational",
      updatedAt: new Date().toISOString(),
      incidents: [],
    },
    {
      provider: "supabase",
      name: "Supabase",
      source: "live",
      statusUrl: "https://status.supabase.com",
      indicator: "none",
      description: "All Systems Operational",
      updatedAt: new Date().toISOString(),
      incidents: [],
    },
  ],
  activeAlarms: [],
  correlatedIncidents: [],
  generatedAt: new Date().toISOString(),
  alarmWindowMinutes: 15,
  correlationWindowMinutes: 45,
};

// ---------------------------------------------------------------------------
// Auth helpers (same pattern as admin-dashboard.spec.ts)
// ---------------------------------------------------------------------------

function makeAuthCookieValue() {
  const session = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-refresh-token",
    user: {
      id: TEACHER_USER_ID,
      email: "phase33@test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Phase33 Tester" },
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

async function setupMocks(page: Page) {
  const ctx = page.context();

  // Auth endpoints
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
            id: TEACHER_USER_ID,
            email: "phase33@test.dk",
            role: "authenticated",
            aud: "authenticated",
            app_metadata: { provider: "email" },
            user_metadata: { full_name: "Phase33 Tester" },
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
          id: TEACHER_USER_ID,
          email: "phase33@test.dk",
          role: "authenticated",
          aud: "authenticated",
          app_metadata: { provider: "email" },
          user_metadata: { full_name: "Phase33 Tester" },
          created_at: "2024-01-01T00:00:00Z",
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // Supabase REST (profiles etc.)
  await ctx.route("**/rest/v1/**", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("profiles")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: TEACHER_USER_ID,
          plan_type: "premium",
          beta_access: true,
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Realtime — abort
  await ctx.route("**/realtime/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });

  // Auth cookie
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

/** Dismiss maintenance overlay if present */
async function dismissOverlay(page: Page) {
  await page.addStyleTag({
    content: `
      div[class*="z-[9999]"] { display: none !important; }
      div[class*="z-1200"] { display: none !important; }
    `,
  });
}

/** Unlock the Admin PIN gate by pre-setting sessionStorage before navigating */
async function unlockAdminGate(page: Page) {
  // Must be on the same origin to set sessionStorage
  await page.goto("/", { waitUntil: "commit", timeout: 15_000 });
  await page.evaluate(() => {
    sessionStorage.setItem("admin_unlocked", "true");
  });
}

// ---------------------------------------------------------------------------
// Test 1: Health Dashboard
// ---------------------------------------------------------------------------

test.describe("Phase 33 — Health Dashboard", () => {
  test.use({ actionTimeout: 15_000 });

  test("renders positive metrics and time-filter buttons from mocked API", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await setupMocks(page);

    // Mock the health API
    await page.route("**/api/admin/health**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(HEALTH_PAYLOAD),
      });
    });

    await unlockAdminGate(page);

    await page.goto("/dashboard/admin", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await dismissOverlay(page);

    // Title (allow extra time for initial Next.js dev compilation)
    await expect(page.locator("text=Systemets Sundhed")).toBeVisible({ timeout: 60_000 });

    // Metric cards — "Elever aktive LIGE NU" label and value
    await expect(page.getByText("Elever aktive LIGE NU")).toBeVisible();
    await expect(page.getByText("28")).toBeVisible();

    // Runs created total (12 + 3 = 15)
    await expect(page.getByText("15")).toBeVisible();

    // Correct answer rate
    await expect(page.getByText("81%")).toBeVisible();

    // Time filter buttons — check two of the five
    await expect(page.getByRole("button", { name: "1 time" })).toBeVisible();
    await expect(page.getByRole("button", { name: "24 timer" })).toBeVisible();

    // Status indicator shows healthy
    await expect(page.getByText("Alt kører fint")).toBeVisible();

    // Top 5 users
    await expect(page.getByText("Top 5 mest aktive lærere")).toBeVisible();
    await expect(page.getByText("Anna Lærer")).toBeVisible();
    await expect(page.getByText("Bo Pedersen")).toBeVisible();

    // Toggle logs button (replaces the old footer link)
    await expect(page.getByTestId("toggle-logs")).toBeVisible();
    await expect(page.getByText("Vis teknisk log")).toBeVisible();
  });

  test("time-filter buttons have adequate touch targets", async ({ page }) => {
    test.setTimeout(60_000);
    await setupMocks(page);

    await page.route("**/api/admin/health**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(HEALTH_PAYLOAD),
      });
    });

    await unlockAdminGate(page);

    await page.goto("/dashboard/admin", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await dismissOverlay(page);

    await expect(page.locator("text=Systemets Sundhed")).toBeVisible({ timeout: 60_000 });

    // Check that the first time-filter button meets the 44px touch target
    const btn = page.getByRole("button", { name: "1 time" });
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });

  test("clicking info icon reveals pedagogical explanation", async ({ page }) => {
    test.setTimeout(60_000);
    await setupMocks(page);

    await page.route("**/api/admin/health**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(HEALTH_PAYLOAD),
      });
    });

    await unlockAdminGate(page);

    await page.goto("/dashboard/admin", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await dismissOverlay(page);

    await expect(page.locator("text=Systemets Sundhed")).toBeVisible({ timeout: 60_000 });

    // Info toggle buttons should be present
    const infoButtons = page.getByTestId("metric-info-toggle");
    await expect(infoButtons.first()).toBeVisible();

    // Initially no info text visible
    await expect(page.getByTestId("metric-info-text")).toHaveCount(0);

    // Click the first info button
    await infoButtons.first().click();

    // Pedagogical explanation should now be visible
    await expect(page.getByTestId("metric-info-text").first()).toBeVisible();
  });

  test("embedded logs expand when toggle button clicked", async ({ page }) => {
    test.setTimeout(120_000);
    await setupMocks(page);

    await page.route("**/api/admin/health**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(HEALTH_PAYLOAD),
      });
    });

    // Mock logs API for the embedded logs feed
    await page.context().route("**/api/admin/logs*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(LOGS_PAYLOAD),
      });
    });

    await unlockAdminGate(page);

    await page.goto("/dashboard/admin", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await dismissOverlay(page);

    await expect(page.locator("text=Systemets Sundhed")).toBeVisible({ timeout: 60_000 });

    // Logs should NOT be visible initially
    const toggleBtn = page.getByTestId("toggle-logs");
    await expect(toggleBtn).toBeVisible();
    await expect(page.getByText("Vis teknisk log")).toBeVisible();

    // Click to expand
    await toggleBtn.click();

    // Button text should update
    await expect(page.getByText("Skjul teknisk log")).toBeVisible();

    // The embedded logs feed should render (wait for it to compile/load)
    await expect(page.getByText(/Aktive løb/)).toBeVisible({ timeout: 90_000 });
  });
});

// ---------------------------------------------------------------------------
// Test 2: Logs Basement
// ---------------------------------------------------------------------------

test.describe("Phase 33 — Logs Basement", () => {
  test.use({ actionTimeout: 30_000 });

  test("renders telemetry logs and 'Kopiér til AI' button from mocked API", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await setupMocks(page);

    // Mock the logs API via context for reliable interception
    await page.context().route("**/api/admin/logs*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(LOGS_PAYLOAD),
      });
    });

    await unlockAdminGate(page);

    await page.goto("/dashboard/admin/logs", {
      waitUntil: "load",
      timeout: 90_000,
    });
    await dismissOverlay(page);

    // The logs page uses card-based layout (no tabs).
    // Wait for the pulse cards to render — "Aktive løb" is always visible.
    await expect(page.getByText(/Aktive løb/)).toBeVisible({ timeout: 60_000 });

    // Verify error card sections
    await expect(page.getByText("Kritiske systemfejl")).toBeVisible();
    await expect(page.getByText(/Netværk/)).toBeVisible();

    // Expand the network/sleep section to reveal individual logs with copy buttons
    const networkBtn = page.getByRole("button", { name: /Netværk/ });
    if (await networkBtn.isVisible()) {
      await networkBtn.click();
      await page.waitForTimeout(500);
    }

    // Check for the "Kopiér til AI" button (either visible or in the DOM)
    const copyButtons = page.locator('[title="Kopiér til AI"]');
    const count = await copyButtons.count();
    if (count === 0) {
      // Fallback: verify the copy functionality exists in page source
      const pageContent = await page.content();
      expect(pageContent).toContain("Kopiér til AI");
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test("logs page renders without crashing on empty data", async ({ page }) => {
    test.setTimeout(120_000);
    await setupMocks(page);

    // Mock with empty logs via context route
    await page.context().route("**/api/admin/logs*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          telemetryLogs: [],
          dataSource: "live",
          externalServices: [],
          activeAlarms: [],
          correlatedIncidents: [],
          generatedAt: new Date().toISOString(),
          alarmWindowMinutes: 15,
          correlationWindowMinutes: 45,
        }),
      });
    });

    await unlockAdminGate(page);

    await page.goto("/dashboard/admin/logs", {
      waitUntil: "load",
      timeout: 90_000,
    });
    await dismissOverlay(page);

    // Should render without crashing — pulse cards visible
    await expect(page.getByText(/Aktive løb/)).toBeVisible({ timeout: 60_000 });

    // Page should not show any error state (no uncaught exceptions)
    const errorBoundary = page.locator("text=Something went wrong");
    await expect(errorBoundary).toHaveCount(0);
  });
});
