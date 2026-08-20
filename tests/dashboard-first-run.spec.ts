import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
  : "xodrzahqdgbsssntupjt";
const SUPABASE_COOKIE_NAME = `sb-${supabaseHostname}-auth-token`;
const ACTIVE_SESSION_ID = "11111111-2222-4333-8444-555555555555";
const PARTICIPANT_SESSION_ID = "22222222-3333-4444-8555-666666666666";
const PARTICIPANT_ID = "33333333-4444-4555-8666-777777777777";

const FAKE_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "dashboard-flow@example.invalid",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  user_metadata: {},
  app_metadata: { provider: "email", providers: ["email"] },
};

function readSource(...parts: string[]) {
  return readFileSync(resolve(process.cwd(), ...parts), "utf8");
}

type DashboardContextOptions = {
  activeSession?: boolean;
  participantResume?: boolean;
  unauthenticated?: boolean;
};

async function setupDashboardContext(context: BrowserContext, options?: DashboardContextOptions) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const fakeSession = {
    access_token: "synthetic-dashboard-access-token",
    refresh_token: "synthetic-dashboard-refresh-token",
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: "bearer",
    user: FAKE_USER,
  };

  if (!options?.unauthenticated) {
    await context.addCookies([
      {
        name: SUPABASE_COOKIE_NAME,
        value: encodeURIComponent(JSON.stringify(fakeSession)),
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }

  await context.routeWebSocket(/webpack-hmr/, (socket) => socket.close());
  await context.route(/realtime\/v1\/websocket/i, async (route: Route) => {
    await route.abort("connectionrefused");
  });
  await context.route(/\/auth\/v1\/token/, async (route: Route) => {
    if (options?.unauthenticated) {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fakeSession),
    });
  });
  await context.route(/\/auth\/v1\/user/, async (route: Route) => {
    if (options?.unauthenticated) {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_USER),
    });
  });
  await context.route(/\/rest\/v1\//, async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/gps_runs") && route.request().method() === "HEAD") {
      await route.fulfill({
        status: 200,
        headers: { "content-range": "0-0/1" },
      });
      return;
    }
    if (url.pathname.endsWith("/live_sessions")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(options?.activeSession ? [{ id: ACTIVE_SESSION_ID }] : []),
      });
      return;
    }
    if (url.pathname.endsWith("/participants")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          options?.participantResume
            ? { id: PARTICIPANT_ID, session_id: PARTICIPANT_SESSION_ID, finished_at: null }
            : null
        ),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function seedParticipantResume(page: Page) {
  await page.addInitScript(
    ({ participantId, sessionId }) => {
      window.localStorage.setItem(
        "gpslob_active_participant",
        JSON.stringify({
          participantId,
          sessionId,
          studentName: "Syntetisk elev",
          startOffset: 0,
          savedAt: "2026-01-01T00:00:00.000Z",
        })
      );
      window.localStorage.setItem("skolegps.dashboard-quick-guide.v1.seen", "true");
    },
    { participantId: PARTICIPANT_ID, sessionId: PARTICIPANT_SESSION_ID }
  );
}

function rectsOverlap(
  a: { bottom: number; left: number; right: number; top: number },
  b: { bottom: number; left: number; right: number; top: number }
) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test.describe("Lærerens første SkoleGPS-flow", () => {
  test.describe.configure({ retries: 0 });

  test("dashboard og valgside holder den aftalte snævre kontrakt", async () => {
    const dashboard = readSource("app", "dashboard", "page.tsx");
    const selection = readSource("app", "dashboard", "opret", "valg", "page.tsx");
    const guide = readSource("components", "DashboardQuickGuide.tsx");
    const layout = readSource("app", "dashboard", "layout.tsx");

    expect(dashboard).toContain("Hvad vil du lave?");
    expect(dashboard).toContain("Opret et nyt l\\u00f8b, forts\\u00e6t et aktivt l\\u00f8b eller find dine tidligere l\\u00f8b.");
    expect(dashboard).toContain("Ny her? Vis den korte guide");
    expect(dashboard).toContain("/dashboard/live/${resumeTarget.sessionId}");
    expect(dashboard).toContain("/play/${resumeTarget.sessionId}");
    expect(dashboard).toContain('router.push("/dashboard/arkiv")');
    expect(dashboard).toContain('router.push("/dashboard/laerervaerktoejer")');
    expect(dashboard).toContain('router.push("/dashboard/mobilspil")');

    expect(selection).toContain("Hvordan vil du lave dit løb?");
    expect(selection).toContain("Start med Lynbyggeren");
    expect(selection).toContain("Åbn Lynbyggeren");
    expect(selection).toContain('href="/dashboard/opret/lynbygger"');
    expect(selection).toContain("Andre måder at lave et løb");
    expect(selection).not.toContain('href="/dashboard/opret/stratego"');
    expect(selection).not.toContain("VM26");
    expect(selection).toContain('href={zoneKrigCardHref}');

    expect(guide).toContain("skolegps.dashboard-quick-guide.v1.seen");
    expect(guide).toContain("Vil du se, hvordan du laver dit første løb? Det tager under ét minut.");
    expect(guide).toContain("Start med Lynbyggeren");
    expect(guide).toContain("try {");
    expect(guide).toContain("window.localStorage");
    expect(layout.indexOf("<DashboardQuickGuide />")).toBeGreaterThan(
      layout.indexOf("<DashboardAuthGate>")
    );
    expect(layout.indexOf("<DashboardQuickGuide />")).toBeLessThan(
      layout.indexOf("</DashboardAuthGate>")
    );
  });

  test("førstegangsmodal vises én gang og kan åbnes manuelt igen", async ({ page }) => {
    await setupDashboardContext(page.context());
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem("dashboard-guide-test-ready") !== "true") {
        window.localStorage.clear();
        window.sessionStorage.setItem("dashboard-guide-test-ready", "true");
      }
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Velkommen til SkoleGPS" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Jeg finder selv" }).click();
    await expect(page.getByRole("heading", { name: "Velkommen til SkoleGPS" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Opret et løb" })).toBeFocused();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Hvad vil du lave?" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Velkommen til SkoleGPS" })).toBeHidden();

    const manualTrigger = page.getByRole("button", { name: "Ny her? Vis den korte guide" });
    await manualTrigger.click();
    await expect(page.getByRole("heading", { name: "Velkommen til SkoleGPS" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Velkommen til SkoleGPS" })).toBeHidden();
    await expect(manualTrigger).toBeFocused();
  });

  test("luk-kryds og Escape husker den automatiske førstegangsvisning", async ({ page }) => {
    await setupDashboardContext(page.context());
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem("dashboard-guide-close-test-ready") !== "true") {
        window.localStorage.clear();
        window.sessionStorage.setItem("dashboard-guide-close-test-ready", "true");
      }
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Velkommen til SkoleGPS" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Luk den korte guide" }).click();
    await expect(page.getByRole("button", { name: "Opret et løb" })).toBeFocused();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Velkommen til SkoleGPS" })).toHaveCount(0);

    const manualTrigger = page.getByRole("button", { name: "Ny her? Vis den korte guide" });
    await manualTrigger.click();
    await page.keyboard.press("Escape");
    await expect(manualTrigger).toBeFocused();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Velkommen til SkoleGPS" })).toHaveCount(0);
  });

  test("den korte guide når kontrolleret frem til Lynbygger-valget", async ({ page }) => {
    await setupDashboardContext(page.context());
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem("dashboard-guide-test-ready") !== "true") {
        window.localStorage.clear();
        window.sessionStorage.setItem("dashboard-guide-test-ready", "true");
      }
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Vis mig rundt" }).click();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("skolegps.dashboard-quick-guide.v1.seen"))).toBe("true");
    await expect(page.getByText("Her starter du, når du vil lave et nyt løb.")).toBeVisible();
    await expect(page.locator('[data-tour="dashboard-create-run"]')).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Videre" }).click();
    await expect(page).toHaveURL(/\/dashboard\/opret\/valg$/);
    await expect(page.locator('[data-tour="valg-lynbygger"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Er du ny, er Lynbyggeren den hurtigste vej.")).toBeVisible();
    const targetRect = await page.locator('[data-tour="valg-lynbygger"]').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
    });
    const highlightRect = await page.getByTestId("quick-guide-highlight").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
    });
    expect(Math.abs(highlightRect.left - (targetRect.left - 6))).toBeLessThan(2);
    expect(Math.abs(highlightRect.top - (targetRect.top - 6))).toBeLessThan(2);
    expect(Math.abs(highlightRect.width - (targetRect.width + 12))).toBeLessThan(2);
    expect(Math.abs(highlightRect.height - (targetRect.height + 12))).toBeLessThan(2);

    await page.getByRole("button", { name: "Videre" }).click();
    await expect(page.getByText("Lav indhold, placér posterne på kortet, og start løbet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start med Lynbyggeren" })).toBeVisible();
  });

  test("lukning efter guide-navigation fokuserer Lynbygger-valget", async ({ page }) => {
    await setupDashboardContext(page.context());
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem("dashboard-guide-navigation-test-ready") !== "true") {
        window.localStorage.clear();
        window.sessionStorage.setItem("dashboard-guide-navigation-test-ready", "true");
      }
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Vis mig rundt" }).click();
    await page.getByRole("button", { name: "Videre" }).click();
    await expect(page).toHaveURL(/\/dashboard\/opret\/valg$/);
    const lynbygger = page.locator('[data-tour="valg-lynbygger"]');
    await expect(lynbygger).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Escape");
    await expect(lynbygger).toBeFocused();
    await expect(page.locator("body")).not.toBeFocused();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("valgsiden anbefaler Lynbyggeren og skjuler VM26 og Stratego", async ({ page }) => {
    await setupDashboardContext(page.context());

    await page.goto("/dashboard/opret/valg", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Hvordan vil du lave dit løb?" })).toBeVisible({ timeout: 20_000 });
    const lynbygger = page.locator('[data-tour="valg-lynbygger"]');
    await expect(lynbygger).toHaveAttribute("href", "/dashboard/opret/lynbygger");
    await expect(page.getByText("Åbn Lynbyggeren")).toBeVisible();
    await expect(page.getByText("Live Stratego")).toHaveCount(0);
    await expect(page.getByText(/VM26/)).toHaveCount(0);
    await expect(page.getByText("Zone-Krigen")).toBeVisible();
  });

  test("uautentificeret dashboard viser ikke guiden før loginredirect", async ({ page }) => {
    await setupDashboardContext(page.context(), { unauthenticated: true });
    await page.addInitScript(() => window.localStorage.clear());

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login\?next=/, { timeout: 20_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Velkommen til SkoleGPS")).toHaveCount(0);
  });

  test("aktiv deltager på browseren genoptager /play før en lærersession", async ({ page }) => {
    await setupDashboardContext(page.context(), { activeSession: true, participantResume: true });
    await seedParticipantResume(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const resumeButton = page.getByRole("button", { name: "Fortsæt dit løb" });
    await expect(resumeButton).toBeVisible({ timeout: 20_000 });
    await resumeButton.click();
    await expect(page).toHaveURL(new RegExp(`/play/${PARTICIPANT_SESSION_ID}$`));
  });

  test("aktiv lærersession viser den eksisterende live-genvej og route", async ({ page }) => {
    await setupDashboardContext(page.context(), { activeSession: true });
    await page.addInitScript(() => window.localStorage.setItem("skolegps.dashboard-quick-guide.v1.seen", "true"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const resumeButton = page.getByRole("button", { name: /Fortsæt løbet/i });
    await expect(resumeButton).toBeVisible({ timeout: 20_000 });
    await resumeButton.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/live/${ACTIVE_SESSION_ID}$`));
  });

  test("mobilguiden holder mål og panel adskilt og skjuler assistenten", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupDashboardContext(page.context());
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem("dashboard-guide-mobile-test-ready") !== "true") {
        window.localStorage.clear();
        window.sessionStorage.setItem("dashboard-guide-mobile-test-ready", "true");
      }
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Vis mig rundt" }).click();
    const createTarget = page.locator('[data-tour="dashboard-create-run"]');
    const panel = page.getByTestId("quick-guide-panel");
    await expect(page.getByTestId("quick-guide-highlight")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Åbn SkoleGPS-assistent" })).toHaveCount(0);

    const createTargetBox = await createTarget.boundingBox();
    const createPanelBox = await panel.boundingBox();
    expect(createTargetBox).not.toBeNull();
    expect(createPanelBox).not.toBeNull();
    expect(rectsOverlap(
      {
        bottom: createTargetBox!.y + createTargetBox!.height,
        left: createTargetBox!.x,
        right: createTargetBox!.x + createTargetBox!.width,
        top: createTargetBox!.y,
      },
      {
        bottom: createPanelBox!.y + createPanelBox!.height,
        left: createPanelBox!.x,
        right: createPanelBox!.x + createPanelBox!.width,
        top: createPanelBox!.y,
      }
    )).toBe(false);
    expect(createTargetBox!.y).toBeGreaterThanOrEqual(createPanelBox!.y + createPanelBox!.height);
    expect(createTargetBox!.y + createTargetBox!.height).toBeLessThanOrEqual(844);

    await page.getByRole("button", { name: "Videre" }).click();
    await expect(page).toHaveURL(/\/dashboard\/opret\/valg$/);
    const lynbyggerTarget = page.locator('[data-tour="valg-lynbygger"]');
    await expect(page.getByTestId("quick-guide-highlight")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Åbn Lynbyggeren")).toBeVisible();
    await expect(page.getByRole("button", { name: "Åbn SkoleGPS-assistent" })).toHaveCount(0);

    const lynbyggerBox = await lynbyggerTarget.boundingBox();
    const lynbyggerPanelBox = await panel.boundingBox();
    expect(lynbyggerBox).not.toBeNull();
    expect(lynbyggerPanelBox).not.toBeNull();
    expect(rectsOverlap(
      {
        bottom: lynbyggerBox!.y + lynbyggerBox!.height,
        left: lynbyggerBox!.x,
        right: lynbyggerBox!.x + lynbyggerBox!.width,
        top: lynbyggerBox!.y,
      },
      {
        bottom: lynbyggerPanelBox!.y + lynbyggerPanelBox!.height,
        left: lynbyggerPanelBox!.x,
        right: lynbyggerPanelBox!.x + lynbyggerPanelBox!.width,
        top: lynbyggerPanelBox!.y,
      }
    )).toBe(false);
    expect(lynbyggerBox!.y).toBeGreaterThanOrEqual(
      lynbyggerPanelBox!.y + lynbyggerPanelBox!.height
    );
    expect(lynbyggerBox!.y + lynbyggerBox!.height).toBeLessThanOrEqual(844);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Åbn SkoleGPS-assistent" })).toBeVisible();
  });
});
