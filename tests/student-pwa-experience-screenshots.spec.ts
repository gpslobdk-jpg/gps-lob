import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SCREENSHOT_ROOT = process.env.PWA_SCREENSHOT_DIR;

function screenshotPath(testInfo: TestInfo, fileName: string) {
  if (!SCREENSHOT_ROOT) {
    return testInfo.outputPath(fileName);
  }
  mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  return join(SCREENSHOT_ROOT, fileName);
}

async function installStandaloneMode(page: Page) {
  await page.addInitScript(() => {
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
  });
}

async function triggerInstallPrompt(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.pwaInstallListener === "ready");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => undefined },
      userChoice: { value: Promise.resolve({ outcome: "accepted", platform: "web" }) },
    });
    window.dispatchEvent(event);
  });
}

test("captures the standalone PWA launch frame and settled join", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await installStandaloneMode(page);
  await page.goto("/join", { waitUntil: "domcontentloaded" });

  const launch = page.getByTestId("pwa-launch-experience");
  await expect(launch).toBeVisible();
  await page.waitForTimeout(820);
  await page.screenshot({
    path: screenshotPath(testInfo, "01-pwa-launch-frame-390x844.png"),
    animations: "allow",
  });
  await expect(launch).toBeHidden({ timeout: 2_000 });
  await page.screenshot({ path: screenshotPath(testInfo, "05-standalone-join-390x844.png") });

  await context.close();
});

test("captures normal join at the requested responsive sizes", async ({ browser }, testInfo) => {
  for (const viewport of [
    { width: 390, height: 844, name: "02-join-normal-390x844.png" },
    { width: 320, height: 568, name: "06-join-normal-320x568.png" },
    { width: 430, height: 932, name: "07-join-normal-430x932.png" },
  ]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Deltag i et løb" })).toBeVisible();
    await page.screenshot({ path: screenshotPath(testInfo, viewport.name) });
    await context.close();
  }
});

test("captures the Android install promotion", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.goto("/join", { waitUntil: "domcontentloaded" });
  await triggerInstallPrompt(page);
  const promotion = page.getByTestId("student-pwa-install-promotion");
  await expect(promotion).toBeVisible({ timeout: 4_000 });
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('[data-testid="student-pwa-install-promotion"] img');
    return Boolean(image?.complete && image.naturalWidth > 0);
  });
  await page.screenshot({ path: screenshotPath(testInfo, "03-android-install-390x844.png") });
  await context.close();
});

test("captures the iOS install guide", async ({ browser }, testInfo) => {
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    const promotion = page.getByTestId("student-pwa-install-promotion");
    await expect(promotion).toBeVisible({ timeout: 4_000 });
    await page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>('[data-testid="student-pwa-install-promotion"] img');
      return Boolean(image?.complete && image.naturalWidth > 0);
    });
    await page.screenshot({ path: screenshotPath(testInfo, "04-ios-install-guide-390x844.png") });
  } finally {
    await context?.close();
  }
});
