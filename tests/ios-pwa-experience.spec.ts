import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const PWA_PROMOTION = "student-pwa-install-promotion";
const SCREENSHOT_ROOT = process.env.PWA_SCREENSHOT_DIR;

function screenshotPath(testInfo: TestInfo, fileName: string) {
  if (!SCREENSHOT_ROOT) {
    return testInfo.outputPath(fileName);
  }
  mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  return join(SCREENSHOT_ROOT, fileName);
}

async function waitForStablePwaGuide(page: Page) {
  await page.waitForFunction(() => {
    const promotion = document.querySelector('[data-testid="student-pwa-install-promotion"]');
    const image = promotion?.querySelector<HTMLImageElement>("img");
    const promotionHasFinishedEntering =
      !promotion || promotion.getAnimations().every((animation) => animation.playState !== "running");

    return (
      document.fonts.status === "loaded" &&
      Boolean(image?.complete && image.naturalWidth > 0) &&
      promotionHasFinishedEntering
    );
  });
  await page.waitForTimeout(50);
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
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    });
  });
}

test.describe("iOS PWA guidance", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("iOS Safari shows the add-to-home-screen guide", async ({ page }, testInfo) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    const promotion = page.getByTestId(PWA_PROMOTION);
    await expect(promotion).toBeVisible({ timeout: 4_000 });
    await expect(promotion).toHaveAttribute("data-platform", "ios");
    await expect(promotion).toContainText("Del i Safari");
    await expect(promotion).toContainText("Føj til hjemmeskærm");
    await expect(promotion).toContainText("Tilføj");
    await expect(promotion).toContainText("Åbn som webapp");
    await expect(promotion).not.toContainText("Installer app");
    await expect(page.getByRole("heading", { name: "Deltag i et løb" })).toBeVisible();

    if (SCREENSHOT_ROOT && testInfo.project.name === "ios") {
      await waitForStablePwaGuide(page);
      await page.screenshot({ path: screenshotPath(testInfo, "08-ios-webkit-install-guide-390x844.png") });
    }
  });

  test("standalone iOS never shows the guide", async ({ page }) => {
    await installStandaloneMode(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_200);
    await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
  });
});
