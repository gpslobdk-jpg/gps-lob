import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

const TEACHER_USER_ID = "bbbbbbbb-1111-4222-8333-cccccccc0001";
const SUPABASE_COOKIE_NAME = "sb-xodrzahqdgbsssntupjt-auth-token";
const MANUEL_DRAFT_STORAGE_KEY = "draft_run_manuel";

type ManualDraftQuestion = {
  answers?: unknown;
  correctIndex?: unknown;
  points?: unknown;
  lat?: unknown;
  lng?: unknown;
};

type ManualDraftEnvelope = {
  data?: {
    title?: unknown;
    questions?: ManualDraftQuestion[];
    overrideRaceType?: unknown;
    raceType?: unknown;
  };
};

function base64UrlEncode(value: unknown) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeSessionPayload() {
  return {
    access_token: "mock-lynbygger-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-lynbygger-refresh-token",
    user: {
      id: TEACHER_USER_ID,
      email: "lynbygger@test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Lynbygger Test Teacher" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };
}

function makeAuthCookieValue() {
  return `base64-${base64UrlEncode(makeSessionPayload())}`;
}

async function setupDashboardContext(ctx: BrowserContext) {
  const session = makeSessionPayload();

  await ctx.addCookies([
    {
      name: `${SUPABASE_COOKIE_NAME}.0`,
      value: makeAuthCookieValue(),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await ctx.addInitScript(() => {
    window.localStorage.setItem("gpslob_tour_finished", "true");
  });

  await ctx.routeWebSocket(/webpack-hmr/, (ws) => {
    ws.close();
  });

  await ctx.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();

    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
      return;
    }

    if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session.user),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await ctx.route("**/realtime/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });

  await ctx.route("**/rest/v1/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().method() === "GET" ? "[]" : "{}",
    });
  });
}

async function readManualDraft(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ManualDraftEnvelope) : null;
  }, MANUEL_DRAFT_STORAGE_KEY);
}

test.use({ serviceWorkers: "block" });

test.describe("Lynbygger handoff", () => {
  test.describe.configure({ retries: 0 });

  test("creates an 8-post draft and imports it in the manual builder", async ({ page }) => {
    test.setTimeout(90_000);

    await setupDashboardContext(page.context());
    await page.goto("/dashboard/opret/valg", { waitUntil: "domcontentloaded", timeout: 30_000 });

    const lynbyggerCard = page.getByTestId("create-card-lynbygger");
    const manuelCard = page.getByTestId("create-card-manuel");

    await expect(lynbyggerCard).toBeVisible({ timeout: 20_000 });
    await expect(manuelCard).toBeVisible();
    await expect(manuelCard).toHaveAttribute("data-tour", "valg-classic-quiz");

    await lynbyggerCard.click();
    await expect(page.getByTestId("lynbygger-page")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("lynbygger-topic-input").fill("Solsystemet");
    await page
      .getByTestId("lynbygger-grade-input")
      .getByRole("button", { name: /5\.-6\. klasse/i })
      .click();
    await page.getByTestId("lynbygger-post-count").fill("8");
    await expect(page.getByTestId("lynbygger-post-count")).toHaveValue("8");

    await page.getByTestId("lynbygger-generate-preview").click();

    await expect(page.getByTestId("lynbygger-preview")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("lynbygger-preview-count")).toHaveText("8");
    await expect(page.getByTestId("lynbygger-preview-row")).toHaveCount(8);

    await page.getByTestId("lynbygger-continue-to-editor").click();
    await expect(page).toHaveURL(/\/dashboard\/opret\/manuel$/, { timeout: 45_000 });

    await expect.poll(() => readManualDraft(page), {
      timeout: 15_000,
      message: "manual draft should be present in localStorage",
    }).not.toBeNull();

    const importedDraft = await readManualDraft(page);
    expect(importedDraft).not.toBeNull();
    const draft = importedDraft?.data;
    expect(draft).toBeDefined();
    expect(draft?.questions).toHaveLength(8);
    expect(draft?.overrideRaceType ?? draft?.raceType).toBe("manuel");

    for (const question of draft?.questions ?? []) {
      expect(Array.isArray(question.answers)).toBe(true);
      expect(question.answers).toHaveLength(4);
      expect(typeof question.correctIndex).toBe("number");
      expect(typeof question.points).toBe("number");
      expect(typeof question.lat).toBe("number");
      expect(typeof question.lng).toBe("number");
    }

    await expect(page.locator('article[id^="manuel-post-"]')).toHaveCount(8, { timeout: 30_000 });
    await expect(page.locator('article[id^="manuel-post-"] input[type="number"]')).toHaveCount(8);
    await expect(page.getByText(/Pin gemt:/i)).toHaveCount(8);

    await page.locator('input[placeholder*="store viden"]').first().fill("Solsystemet - redigeret");

    await expect.poll(async () => {
      const currentDraft = await readManualDraft(page);
      return currentDraft?.data?.title;
    }, {
      timeout: 10_000,
      message: "autosave should update the restored manual draft after a title edit",
    }).toBe("Solsystemet - redigeret");
  });
});
