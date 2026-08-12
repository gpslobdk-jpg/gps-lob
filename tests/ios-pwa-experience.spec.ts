import { expect, test, type Page } from "@playwright/test";

const PWA_PROMOTION = "student-pwa-install-promotion";

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
  });

  test("iOS Safari shows the add-to-home-screen guide", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    const promotion = page.getByTestId(PWA_PROMOTION);
    await expect(promotion).toBeVisible({ timeout: 4_000 });
    await expect(promotion).toHaveAttribute("data-platform", "ios");
    await expect(promotion).toContainText("Tryk på Del i Safari");
    await expect(promotion).toContainText("Føj til hjemmeskærm");
    await expect(promotion).not.toContainText("Installer app");
  });

  test("standalone iOS never shows the guide", async ({ page }) => {
    await installStandaloneMode(page);
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_200);
    await expect(page.getByTestId(PWA_PROMOTION)).toHaveCount(0);
  });
});
