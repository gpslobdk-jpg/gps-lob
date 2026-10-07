import { expect, test, type Page } from "@playwright/test";

import { openHarnessedPlay } from "./helpers/standardPlayV2Harness";

const PWA_PROMOTION = "student-pwa-install-promotion";
const PWA_LAUNCH = "pwa-launch-experience";

async function triggerInstallPrompt(
  page: Page,
  outcome: "accepted" | "dismissed" = "accepted",
  waitForListener = true,
) {
  if (waitForListener) {
    await page.waitForFunction(() => document.documentElement.dataset.pwaInstallListener === "ready");
  }
  await page.evaluate((promptOutcome) => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: {
        value: async () => {
          const stateWindow = window as Window & { __pwaPromptCalls?: number };
          stateWindow.__pwaPromptCalls = (stateWindow.__pwaPromptCalls ?? 0) + 1;
        },
      },
      userChoice: {
        value: Promise.resolve({ outcome: promptOutcome, platform: "web" }),
      },
    });
    window.dispatchEvent(event);
  }, outcome);
}

async function installStandaloneMode(page: Page, ios = false) {
  await page.addInitScript(({ iosStandalone }) => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query !== "(display-mode: standalone)") {
        return nativeMatchMedia(query);
      }
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
      } as MediaQueryList;
    };

    if (iosStandalone) {
      Object.defineProperty(window.navigator, "standalone", {
        configurable: true,
        value: true,
      });
    }
  }, { iosStandalone: ios });
}

test.describe("student PWA install promotion", () => {
  test("installable Chromium shows the banner and invokes the native prompt on click", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await triggerInstallPrompt(page);

    const promotion = page.getByTestId(PWA_PROMOTION);
    await expect(promotion).toBeVisible({ timeout: 4_000 });
    await expect(promotion).toHaveAttribute("data-platform", "android");
    await page.getByRole("button", { name: "Installer app" }).click();

    await expect(promotion).toBeHidden();
    await expect.poll(() => page.evaluate(() => (window as Window & { __pwaPromptCalls?: number }).__pwaPromptCalls ?? 0)).toBe(1);
  });

  test("Android gets a short menu guide before the browser exposes a native install prompt", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });

    try {
      const page = await context.newPage();
      await page.goto("/join", { waitUntil: "domcontentloaded" });

      const promotion = page.getByTestId(PWA_PROMOTION);
      await expect(promotion).toBeVisible({ timeout: 4_000 });
      await expect(promotion).toHaveAttribute("data-platform", "android");
      await expect(promotion).toHaveAttribute("data-install-method", "guide");
      await expect(promotion).toContainText("Åbn menuen ⋮ i din Android-browser");
      await expect(promotion).toContainText("Installér app");
      await expect(promotion.getByRole("button", { name: "Installer app" })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("the Android guide yields immediately to the manual code entry", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });

    try {
      const page = await context.newPage();
      await page.goto("/join", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(PWA_PROMOTION)).toBeVisible({ timeout: 4_000 });

      await page.getByRole("button", { name: "Deltag i et løb" }).click();

      await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
      await expect(page.locator("#join-code")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("native Capacitor Android never receives browser install instructions", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });

    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as Window & { Capacitor?: unknown }).Capacitor = {};
      });
      await page.goto("/join", { waitUntil: "domcontentloaded" });
      await triggerInstallPrompt(page);
      await page.waitForTimeout(1_200);

      await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("iPhone Safari guide includes the final Add action", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });

    try {
      const page = await context.newPage();
      await page.goto("/join", { waitUntil: "domcontentloaded" });

      const promotion = page.getByTestId(PWA_PROMOTION);
      await expect(promotion).toBeVisible({ timeout: 4_000 });
      await expect(promotion).toHaveAttribute("data-platform", "ios");
      await expect(promotion).toContainText("Del i Safari");
      await expect(promotion).toContainText("Tilføj");
      await expect(promotion).toContainText("Åbn som webapp");
    } finally {
      await context.close();
    }
  });

  test("manual guide tells iPhone browsers other than Safari to open Safari", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });

    try {
      const page = await context.newPage();
      await page.goto("/join", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.documentElement.dataset.pwaInstallListener === "ready");
      await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);

      await page.getByTestId("student-phone-help-install").click();
      const promotion = page.getByTestId(PWA_PROMOTION);
      await expect(promotion).toBeVisible();
      await expect(promotion).toContainText("Åbn linket i Safari for at installere");
      await expect(promotion).toContainText("Andre browsere på iPhone eller iPad kan ikke vise installationen");
    } finally {
      await context.close();
    }
  });

  test("dismissed promotion stays hidden during the 14 day cooldown", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await triggerInstallPrompt(page);
    await expect(page.getByTestId(PWA_PROMOTION)).toBeVisible({ timeout: 4_000 });
    await page.getByRole("button", { name: "Luk beskeden om installation" }).click();
    await expect(page.getByTestId(PWA_PROMOTION)).toBeHidden();

    await page.reload({ waitUntil: "domcontentloaded" });
    await triggerInstallPrompt(page);
    await page.waitForTimeout(1_200);
    await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
  });

  test("manual phone help can reopen the existing guide during cooldown without changing it", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("skolegps.pwa.install-dismissed-at.v1", String(Date.now() - 1_000));
    });
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.pwaInstallListener === "ready");

    const dismissedAt = await page.evaluate(() => window.localStorage.getItem("skolegps.pwa.install-dismissed-at.v1"));
    await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);

    await page.getByTestId("student-phone-help-install").click();
    const promotion = page.getByTestId(PWA_PROMOTION);
    await expect(promotion).toBeVisible();
    await expect(promotion).toHaveAttribute("data-install-method", "manual");

    await page.getByRole("button", { name: "Luk beskeden om installation" }).click();
    await expect.poll(() => page.evaluate(
      () => window.localStorage.getItem("skolegps.pwa.install-dismissed-at.v1"),
    )).toBe(dismissedAt);
  });

  test("manual install-intent survives until the layout listener is hydrated", async ({ page }) => {
    await page.addInitScript(() => {
      const markInstallIntent = () => {
        document.documentElement.setAttribute("data-skolegps-open-install-help", "1");
      };

      if (document.documentElement) {
        markInstallIntent();
      } else {
        document.addEventListener("DOMContentLoaded", markInstallIntent, { once: true });
      }
    });
    await page.goto("/join", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(PWA_PROMOTION)).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-skolegps-open-install-help");
  });

  test("manual install help never covers the PIN step", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.pwaInstallListener === "ready");
    await page.getByRole("button", { name: "Deltag i et løb" }).click();
    await expect(page.locator("#join-code")).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("skolegps:open-install-help"));
    });
    await page.waitForTimeout(50);

    await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
  });

  test("appinstalled hides the promotion and remembers installation", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await triggerInstallPrompt(page);
    await expect(page.getByTestId(PWA_PROMOTION)).toBeVisible({ timeout: 4_000 });

    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(page.getByTestId(PWA_PROMOTION)).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("skolegps.pwa.install-confirmed.v1"))).toBe("installed");
  });

  test("standalone and unsupported browsers never show a dead install action", async ({ browser }) => {
    const standalonePage = await browser.newPage();
    await installStandaloneMode(standalonePage);
    await standalonePage.goto("/join", { waitUntil: "domcontentloaded" });
    await triggerInstallPrompt(standalonePage);
    await standalonePage.waitForTimeout(1_200);
    await expect(standalonePage.getByTestId(PWA_PROMOTION)).toHaveCount(0);
    await standalonePage.close();

    const unsupportedPage = await browser.newPage();
    await unsupportedPage.goto("/join", { waitUntil: "domcontentloaded" });
    await unsupportedPage.waitForTimeout(1_200);
    await expect(unsupportedPage.getByTestId(PWA_PROMOTION)).toHaveCount(0);
    await expect(unsupportedPage.getByRole("button", { name: "Installer app" })).toHaveCount(0);
    await unsupportedPage.close();
  });

  test("active play never mounts the install promotion", async ({ page }) => {
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-000000000003",
    });
    await triggerInstallPrompt(page, "accepted", false);
    await page.waitForTimeout(1_200);
    await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
  });

  test("a direct QR join never lets installation cover the first code flow", async ({ page }) => {
    await page.goto("/join?pin=ABC123", { waitUntil: "domcontentloaded" });
    await triggerInstallPrompt(page);
    await page.waitForTimeout(1_200);

    await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
    await expect(page.getByTestId("student-experience-build-info")).toBeVisible();
  });
});

test.describe("PWA start experience", () => {
  test("standalone launch never puts a forced intro over join", async ({ page }) => {
    await installStandaloneMode(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_400);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    await expect(page.getByTestId("join-start-actions")).toBeVisible();
  });

  test("normal browser mode has no forced launch intro", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
  });

  test("reduced motion still has no launch takeover", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installStandaloneMode(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    await expect(page.getByTestId("join-start-actions")).toBeVisible();
  });
});
