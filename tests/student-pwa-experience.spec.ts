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
});

test.describe("PWA launch experience", () => {
  test("standalone launch runs once per app session and not on later navigation", async ({ page }) => {
    await installStandaloneMode(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(PWA_LAUNCH)).toBeVisible({ timeout: 2_000 });
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveAttribute("data-motion", "full");
    await expect(page.getByTestId(PWA_LAUNCH)).toBeHidden({ timeout: 3_000 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
  });

  test("normal browser mode has no forced launch intro", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
  });

  test("reduced motion uses the short static launch variant", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installStandaloneMode(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    const launch = page.getByTestId(PWA_LAUNCH);
    await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("skolegps.pwa.launch-shown.v1"))).toBe("reduced");
    if (await launch.count()) {
      await expect(launch).toHaveAttribute("data-motion", "reduced");
      await expect(launch.locator("svg")).toBeHidden();
    }
    await expect(launch).toBeHidden({ timeout: 1_500 });
  });
});
