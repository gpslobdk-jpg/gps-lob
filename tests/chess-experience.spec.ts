import { expect, test, type BrowserContext, type Route } from "@playwright/test";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
  : "xodrzahqdgbsssntupjt";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "chess-teacher@example.invalid",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  user_metadata: {},
  app_metadata: { provider: "email", providers: ["email"] },
};

async function setupTeacher(context: BrowserContext) {
  const session = {
    access_token: "synthetic-chess-access-token",
    refresh_token: "synthetic-chess-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
  await context.addCookies([{ name: `sb-${supabaseHostname}-auth-token`, value: encodeURIComponent(JSON.stringify(session)), domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
  await context.routeWebSocket(/webpack-hmr/, (socket) => socket.close());
  await context.route(/\/auth\/v1\/token/, async (route: Route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }));
  await context.route(/\/auth\/v1\/user/, async (route: Route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));
  await context.route(/\/rest\/v1\//, async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/gps_runs") && route.request().method() === "HEAD") {
      await route.fulfill({ status: 200, headers: { "content-range": "0-0/1" } });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test("læreren vælger et område og kan bruge Skak uden at forlade dashboardet", async ({ page }) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "Kræver de offentlige Supabase-testvariabler."
  );
  await setupTeacher(page.context());
  await page.addInitScript(() => window.localStorage.setItem("skolegps.dashboard-quick-guide.v1.seen", "true"));

  await page.goto("/dashboard/laerervaerktoejer", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Hvad vil du lave?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Planlæg & forbered/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Aktivér klassen/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Kom ud & bevæg jer/ })).toBeVisible();

  await page.getByRole("link", { name: /Aktivér klassen/ }).click();
  await expect(page).toHaveURL(/omraade=aktiver/);
  await page.getByRole("link", { name: /Åbn Skak/ }).click();
  await expect(page.getByRole("heading", { name: "Skak i klassen" })).toBeVisible();

  await page.getByRole("button", { name: /Lær skak/ }).click();
  await expect(page.getByRole("heading", { name: "Lær skak" })).toBeVisible();
  await page.getByRole("button", { name: "Skak", exact: true }).click();
  await page.getByRole("button", { name: /Vis på tavlen/ }).click();
  await expect(page.getByTestId("chess-board")).toBeVisible();
  await page.getByRole("button", { name: "Tavlemodus" }).click();
  await expect(page.getByRole("button", { name: "Afslut tavlemodus" })).toBeVisible();
  await page.getByRole("button", { name: "Afslut tavlemodus" }).click();

  await page.getByRole("button", { name: "Skak", exact: true }).click();
  await page.getByRole("button", { name: /Organisér spil/ }).click();
  await page.getByLabel("Ét navn pr. linje").fill("Amina\nJonas\nSofia\nEmil");
  await page.getByRole("button", { name: "Lav makkere" }).click();
  await expect(page.getByRole("heading", { name: "Dagens makkere" })).toBeVisible();
  await page.getByRole("button", { name: "Start turnering" }).click();
  await expect(page.getByRole("heading", { name: "Runde 1" })).toBeVisible();
});

test("Skak holder bræt og handlinger inden for en smal skærm", async ({ page }) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "Kræver de offentlige Supabase-testvariabler."
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await setupTeacher(page.context());
  await page.goto("/dashboard/laerervaerktoejer/skak", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Skak i klassen" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();

  await page.getByRole("button", { name: /Vis på tavlen/ }).click();
  const board = page.getByTestId("chess-board");
  await expect(board).toBeVisible();
  const boardFits = await board.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width <= window.innerWidth && document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  expect(boardFits).toBe(true);
});
