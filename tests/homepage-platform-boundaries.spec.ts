import { expect, test } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1365, height: 920 };
const DESKTOP_SHAPED_IPAD_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";
test.describe("public homepage platform boundaries", () => {
  test("a desktop-shaped iPad still takes the student root handoff", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      userAgent: DESKTOP_SHAPED_IPAD_USER_AGENT,
      viewport: DESKTOP_VIEWPORT,
    });
    const page = await context.newPage();

    try {
      await page.addInitScript(() => {
        Object.defineProperty(window.navigator, "platform", {
          configurable: true,
          value: "MacIntel",
        });
        Object.defineProperty(window.navigator, "maxTouchPoints", {
          configurable: true,
          value: 5,
        });
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(/\/join(?:\?|$)/);
      await expect(page.getByTestId("home-teacher-root")).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => ({ platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints })))
        .toEqual({ platform: "MacIntel", maxTouchPoints: 5 });
    } finally {
      await context.close();
    }
  });

  test("a Capacitor shell keeps the native welcome flow", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      userAgent: DESKTOP_SHAPED_IPAD_USER_AGENT,
      viewport: DESKTOP_VIEWPORT,
    });
    const page = await context.newPage();

    try {
      await page.addInitScript(() => {
        Object.defineProperty(window, "Capacitor", {
          configurable: true,
          value: {
            getPlatform: () => "ios",
            isNativePlatform: () => true,
          },
        });
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: "Velkommen til GPS Løb", exact: true })).toBeVisible();
      await expect(page.getByTestId("home-teacher-root")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("a nonempty OAuth code stays in the client callback flow instead of mounting TeacherHomepage", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();

    try {
      await page.route("**/api/auth/callback**", async (route) => {
        await route.fulfill({
          body: "<!doctype html><title>Callback captured</title><main>Callback captured</main>",
          contentType: "text/html",
          status: 200,
        });
      });
      const callbackRequest = page.waitForRequest((request) => {
        const callbackUrl = new URL(request.url());
        return callbackUrl.pathname === "/api/auth/callback";
      });

      await page.goto("/?code=nonempty-oauth-code", { waitUntil: "domcontentloaded" });

      const request = await callbackRequest;
      const callbackUrl = new URL(request.url());
      expect(callbackUrl.searchParams.get("code")).toBe("nonempty-oauth-code");
      expect(callbackUrl.searchParams.get("next")).toBe("/dashboard");
      await expect(page).toHaveURL(/\/api\/auth\/callback\?code=nonempty-oauth-code/);
      await expect(page.getByText("Callback captured", { exact: true })).toBeVisible();
      await expect(page.getByTestId("home-teacher-root")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
