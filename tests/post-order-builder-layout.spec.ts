import { devices, expect, test, type Page, type Route } from "@playwright/test";

const TEACHER_ID = "post-order-layout-00000000-0000-0000-0000-000000000001";

function sessionPayload() {
  return {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 36_000,
    expires_at: Math.floor(Date.now() / 1000) + 36_000,
    refresh_token: "mock-refresh-token",
    user: {
      id: TEACHER_ID,
      email: "teacher@post-order-layout.test",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Layout test" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };
}

async function mockTeacherSession(page: Page) {
  const session = sessionPayload();
  const encoded = Buffer.from(JSON.stringify(session))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await page.context().addCookies([
    {
      name: "sb-mock-auth-token.0",
      value: `base64-${encoded}`,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await page.context().route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();
    const body = url.includes("/user") ? session.user : session;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.context().route("**/realtime/**", (route: Route) => route.abort("connectionrefused"));
  await page.context().route("**/rest/v1/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

async function openDanskBuilder(page: Page) {
  await mockTeacherSession(page);
  await page.goto("/dashboard/opret/dansk", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("group", { name: "Startfordeling og rute" })
    .waitFor({ state: "visible", timeout: 45_000 });
  await page.addStyleTag({ content: `div[class*="z-1200"] { display: none !important; }` });
}

async function expectVisibleOrderControl(page: Page) {
  const control = page.getByRole("group", { name: "Startfordeling og rute" });
  const save = page.getByRole("button", { name: /gem.*arkivet/i });

  await expect(control).toBeVisible();
  await expect(control.getByLabel("Forskellige startposter, samme rute")).toBeChecked();
  await expect(control.getByLabel("Samme startpost og rækkefølge")).toBeVisible();
  await expect(save).toBeVisible();

  const [controlBox, saveBox] = await Promise.all([control.boundingBox(), save.boundingBox()]);
  expect(controlBox).not.toBeNull();
  expect(saveBox).not.toBeNull();
  expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(saveBox!.y);
}

test.describe("post order builder layout", () => {
  test("keeps the visible selector above save on desktop", async ({ page }, testInfo) => {
    await openDanskBuilder(page);
    await expectVisibleOrderControl(page);
    await page.screenshot({ path: testInfo.outputPath("post-order-desktop.png"), fullPage: true });
  });

  test("keeps the established mobile builder guard clear on an iPhone-sized viewport", async ({ browser }, testInfo) => {
    const context = await browser.newContext({ ...devices["iPhone 14"] });
    const page = await context.newPage();

    await mockTeacherSession(page);
    await page.goto("/dashboard/opret/dansk", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Brug en computer til builderen" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Startfordeling og rute" })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("post-order-iphone14.png"), fullPage: true });
    await context.close();
  });
});
