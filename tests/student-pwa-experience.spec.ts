import { expect, test, type Page } from "@playwright/test";

import { openHarnessedPlay } from "./helpers/standardPlayV2Harness";

const PWA_PROMOTION = "student-pwa-install-promotion";
const PWA_LAUNCH = "golden-portal-intro";
const GOLDEN_PORTAL_LAUNCH_KEY = "skolegps.golden-portal.launch.v1";

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

async function primeGoldenPortalLaunch(page: Page) {
  await page.addInitScript((launchKey) => {
    window.sessionStorage.setItem(launchKey, "fresh");
  }, GOLDEN_PORTAL_LAUNCH_KEY);
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
      await installStandaloneMode(page);
      await page.goto("/join", { waitUntil: "domcontentloaded" });
      await triggerInstallPrompt(page);
      await page.waitForTimeout(1_200);

      await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
      await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
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
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
  });

  test("a direct QR join never lets installation or the portal cover the first code flow", async ({ page }) => {
    await installStandaloneMode(page);
    await page.goto("/join?pin=ABC123", { waitUntil: "domcontentloaded" });
    await triggerInstallPrompt(page);
    await page.waitForTimeout(1_200);

    await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    await expect(page.getByTestId("student-experience-build-info")).toBeVisible();
  });
});

test.describe("PWA start experience", () => {
  test("a fresh standalone handoff presents a named, skippable portal and restores the real entry actions", async ({ page }) => {
    await installStandaloneMode(page);
    await primeGoldenPortalLaunch(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    const portal = page.getByTestId(PWA_LAUNCH);
    const skip = page.getByTestId("golden-portal-skip");

    await expect(portal).toBeVisible();
    await expect(portal).toHaveCSS("opacity", "1");
    await expect(portal).toHaveAccessibleName("Den Gyldne Portal");
    await expect(skip).toBeFocused();
    await expect(portal).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#student-join-surface")).toHaveAttribute("aria-hidden", "true");

    await skip.click();
    await expect(portal).toHaveCount(0);
    await expect(page.locator("#student-join-surface")).not.toHaveAttribute("aria-hidden");
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect(page.getByTestId("join-start-actions")).toBeVisible();
    await page.getByRole("button", { name: "Deltag i et løb", exact: true }).click();
    await expect(page.locator("#join-code")).toBeFocused();
  });

  test("normal browser mode has no portal", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
  });

  test("a standalone internal join navigation without a fresh handoff has no portal", async ({ page }) => {
    await installStandaloneMode(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);

    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    await expect(page.getByTestId("join-start-actions")).toBeVisible();
  });

  test("reduced motion skips the timed portal and leaves the entry available", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installStandaloneMode(page);
    await primeGoldenPortalLaunch(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    await expect(page.getByTestId("join-start-actions")).toBeVisible();
  });

  test("the 320px standalone portal keeps its skip action in view without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await installStandaloneMode(page);
    await primeGoldenPortalLaunch(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });

    const skip = page.getByTestId("golden-portal-skip");
    await expect(skip).toBeInViewport();
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )).toBe(false);

    await skip.click();
    await expect(page.getByRole("button", { name: "Deltag i et løb", exact: true })).toBeInViewport();
  });

  test("the portal is shown once per standalone app session, never before a stored resume", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();

    try {
      await installStandaloneMode(page);
      await primeGoldenPortalLaunch(page);
      await page.goto("/join", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(PWA_LAUNCH)).toBeVisible();
      await page.getByTestId("golden-portal-skip").click();
      await expect(page.getByTestId(PWA_LAUNCH)).toBeHidden();

      await page.goto("/join", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);

      await page.evaluate(() => {
        window.sessionStorage.clear();
        window.localStorage.setItem("gpslob_active_participant", JSON.stringify({
          participantId: "stored-participant",
          sessionId: "stored-session",
          studentName: "Gemt hold",
          startOffset: 0,
          savedAt: new Date().toISOString(),
          sessionStatus: "running",
        }));
      });
      await page.goto("/join", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Fortsæt løbet", exact: true })).toBeVisible();
      await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("the mobile standalone start URL still hands off to join before the portal", async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();

    try {
      await installStandaloneMode(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/join$/);
      await expect(page.getByTestId(PWA_LAUNCH)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("backgrounding the portal removes it and restores the join flow", async ({ page }) => {
    await installStandaloneMode(page);
    await primeGoldenPortalLaunch(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(PWA_LAUNCH)).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    await expect(page.locator("#student-join-surface")).not.toHaveAttribute("aria-hidden");
    await expect(page.getByTestId("join-start-actions")).toBeVisible();
  });

  test("backgrounding during the exit fade restores the join flow without waiting for its timer", async ({ page }) => {
    await installStandaloneMode(page);
    await primeGoldenPortalLaunch(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(PWA_LAUNCH)).toBeVisible();

    await page.getByTestId("golden-portal-skip").click();
    await page.waitForTimeout(50);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(20);
    const hasCoveredJoinSurface = await page.locator("#student-join-surface").evaluate(
      (surface) => surface.hasAttribute("aria-hidden"),
    );

    expect(hasCoveredJoinSurface).toBe(false);
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    await expect(page.getByTestId("join-start-actions")).toBeVisible();
  });

  test("the portal keeps its skip action reachable through portrait-landscape rotation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installStandaloneMode(page);
    await primeGoldenPortalLaunch(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });

    const skip = page.getByTestId("golden-portal-skip");
    await expect(skip).toBeInViewport();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(skip).toBeInViewport();
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )).toBe(false);

    await skip.click();
    await expect(page.getByRole("button", { name: "Deltag i et løb", exact: true })).toBeInViewport();
  });

  test("a failed portal graphic still leaves the skip action and real entry usable", async ({ page }) => {
    await installStandaloneMode(page);
    await primeGoldenPortalLaunch(page);
    await page.route("**/_next/image?url=*golden-portal*", (route) => route.abort());
    await page.goto("/join", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(PWA_LAUNCH)).toBeVisible();
    await page.getByTestId("golden-portal-skip").click();
    await expect(page.getByTestId(PWA_LAUNCH)).toHaveCount(0);
    await expect(page.getByTestId("join-start-actions")).toBeVisible();
  });
});
