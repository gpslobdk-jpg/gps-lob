import { expect, test, type BrowserContext, type Route } from "@playwright/test";

test.use({ serviceWorkers: "block" });

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

  await context.addCookies([{
    name: `sb-${supabaseHostname}-auth-token`,
    value: encodeURIComponent(JSON.stringify(session)),
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  }]);
  await context.addInitScript(() => window.localStorage.setItem("skolegps.dashboard-quick-guide.v1.seen", "true"));
  await context.routeWebSocket(/webpack-hmr/, (socket) => socket.close());
  await context.route(/realtime\/v1\/websocket/i, async (route: Route) => route.abort("connectionrefused"));
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

function requirePublicTestEnvironment() {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "Kræver sikre, offentlige Supabase-testvariabler."
  );
}

test("læreren går gennem en enkel skakrunde uden turneringsstøj", async ({ page }) => {
  requirePublicTestEnvironment();
  await setupTeacher(page.context());

  await page.goto("/vaerktojer/skak", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/laerervaerktoejer\/skak/);
  await expect(page.getByRole("heading", { name: "Hvad skal der ske i klassen nu?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Spil en runde/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Vis på tavlen/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Lær en regel/ })).toBeVisible();
  await expect(page.getByText("Turnering og point (valgfrit)")).toHaveCount(0);

  await page.getByRole("button", { name: /Spil en runde/ }).click();
  await expect(page.getByRole("heading", { name: "Gør klar i tre små trin" })).toBeVisible();
  await page.getByLabel("Ét navn pr. linje").fill("Amina\nJonas\nSofia\nEmil\nNoah");
  await page.getByRole("button", { name: "Fortsæt" }).click();
  await expect(page.getByRole("heading", { name: "Makkere og tid" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dagens makkere" })).toBeVisible();
  await expect(page.getByText(/har fri/)).toBeVisible();
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await expect(page.getByText("05:00")).toBeVisible();

  await page.getByRole("button", { name: "Start runden" }).click();
  await expect(page.getByText("Runden er i gang")).toBeVisible();
  await page.getByRole("button", { name: "Afslut runden" }).click();
  await expect(page.getByRole("heading", { name: "Runden er færdig" })).toBeVisible();

  await page.getByText("Turnering og point (valgfrit)").click();
  await page.getByRole("button", { name: "Før point for runden" }).click();
  await expect(page.getByRole("heading", { name: "Point for runde 1" })).toBeVisible();
});

test("læreren kan vælge en visuel regel og bruge det frie tavlebræt", async ({ page }) => {
  requirePublicTestEnvironment();
  await setupTeacher(page.context());

  await page.goto("/dashboard/laerervaerktoejer/skak", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Lær en regel/ }).click();
  await expect(page.getByRole("heading", { name: "Vælg én ting at prøve" })).toBeVisible();
  await page.getByRole("button", { name: /Sådan går brikkerne/ }).click();
  await expect(page.getByText("Lad én elev vise en lovlig vej for hver brik.")).toBeVisible();
  await page.getByRole("button", { name: "Vis på tavlen" }).click();

  const board = page.getByTestId("chess-board");
  await expect(board).toBeVisible();
  const pawn = page.getByRole("button", { name: "Hvid bonde på e2" });
  await pawn.click();
  await expect(pawn).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tomt felt e4" }).click();
  await expect(page.getByRole("button", { name: "Hvid bonde på e4" })).toBeVisible();

  await page.getByRole("button", { name: "Tavlemodus" }).click();
  await expect(page.getByRole("button", { name: "Afslut tavlemodus" })).toBeVisible();
  await page.getByRole("button", { name: "Afslut tavlemodus" }).click();
});

test("Skak holder start og tavle inden for en smal skærm", async ({ page }) => {
  requirePublicTestEnvironment();
  await page.setViewportSize({ width: 390, height: 844 });
  await setupTeacher(page.context());

  await page.goto("/dashboard/laerervaerktoejer/skak", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Hvad skal der ske i klassen nu?" })).toBeVisible();
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
