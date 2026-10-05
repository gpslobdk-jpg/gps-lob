import { expect, test, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

const INTRO = {
  audio: "homepage-intro-audio",
  boardPreview: "homepage-intro-board-preview",
  dialog: "homepage-intro",
  enter: "homepage-intro-enter",
  pause: "homepage-intro-pause",
  scene: "homepage-intro-scene",
  skip: "homepage-intro-skip",
} as const;

function watchForVideoRequests(page: Page) {
  const requests: string[] = [];

  page.on("request", (request) => {
    try {
      const pathname = new URL(request.url()).pathname.toLowerCase();
      if (/\.(?:m3u8|mp4|webm)$/.test(pathname)) {
        requests.push(request.url());
      }
    } catch {
      // Browser-internal requests do not always have a parseable URL.
    }
  });

  return requests;
}

async function openDesktopHome(page: Page) {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

async function expectOpenIntro(page: Page) {
  const intro = page.getByTestId(INTRO.dialog);

  await expect(intro).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByTestId(INTRO.scene)).toBeVisible();
  await expect(page.getByTestId(INTRO.enter)).toBeVisible();
  await expect(page.getByTestId(INTRO.skip)).toBeVisible();
  await expect(page.getByTestId(INTRO.pause)).toBeVisible();
  await expect(page.getByTestId(INTRO.audio)).toBeVisible();
  await expect(page.getByTestId(INTRO.boardPreview)).toBeAttached();
  await expect(page.getByRole("link", { name: "Elev med kode", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log ind som lærer", exact: true })).toBeVisible();
  await expect(page.getByTestId(INTRO.enter)).toBeFocused();
}

async function expectIntroHiddenWithoutVideo(page: Page, videoRequests: string[]) {
  await expect(page.getByTestId(INTRO.dialog)).toBeHidden();
  // Let any post-hydration media loader run before asserting that it stayed idle.
  await page.waitForTimeout(250);
  expect(videoRequests).toEqual([]);
}

test.describe("desktop homepage intro", () => {
  test("opens on a fresh desktop document load, exposes all controls, and opens again after reload", async ({
    page,
  }) => {
    await openDesktopHome(page);
    await expectOpenIntro(page);

    await page.getByTestId(INTRO.enter).click();
    await expect(page.getByTestId(INTRO.dialog)).toBeHidden();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectOpenIntro(page);
  });

  test("skip and Escape leave the public homepage immediately", async ({ page }) => {
    await openDesktopHome(page);
    await expectOpenIntro(page);

    await page.getByTestId(INTRO.skip).click();
    await expect(page.getByTestId(INTRO.dialog)).toBeHidden();
    await expect(page.locator("[data-homepage-primary-cta]")).toBeFocused();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectOpenIntro(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId(INTRO.dialog)).toBeHidden();
  });

  test("does not reopen after a browser-back history traversal", async ({ page }) => {
    await openDesktopHome(page);
    await expectOpenIntro(page);
    await page.getByTestId(INTRO.skip).click();
    await expect(page.getByTestId(INTRO.dialog)).toBeHidden();

    await page.goto("/manden-bag-skolegps", { waitUntil: "domcontentloaded" });
    await page.goBack({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(INTRO.dialog)).toBeHidden();
    await expect(page.getByTestId("home-hero-scene")).toBeVisible();
  });

  test("a paused intro remains open past its normal ten-second completion window", async ({ page }) => {
    test.setTimeout(30_000);

    await openDesktopHome(page);
    await expectOpenIntro(page);

    await page.getByTestId(INTRO.pause).click();
    await page.waitForTimeout(11_000);

    await expect(page.getByTestId(INTRO.dialog)).toBeVisible();
  });

  test("keeps keyboard focus inside the modal and reveals the Dagens Tavle beat", async ({ page }) => {
    test.setTimeout(30_000);

    await openDesktopHome(page);
    await expectOpenIntro(page);

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByTestId(INTRO.skip)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId(INTRO.enter)).toBeFocused();

    await page.waitForTimeout(7_000);
    const boardOpacity = await page.getByTestId(INTRO.boardPreview).evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).opacity),
    );
    expect(boardOpacity).toBeGreaterThan(0.5);
  });

  test("reduced motion bypasses the intro without loading video media", async ({ page }) => {
    const videoRequests = watchForVideoRequests(page);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDesktopHome(page);

    await expectIntroHiddenWithoutVideo(page, videoRequests);
  });

  test("direct query links and data saver bypass the automatic intro", async ({ browser }) => {
    const queryContext = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const queryPage = await queryContext.newPage();

    try {
      await queryPage.goto("/?next=%2Fdashboard", { waitUntil: "domcontentloaded" });
      await expect(queryPage.getByTestId(INTRO.dialog)).toBeHidden();
      await expect(queryPage.getByTestId("home-hero-scene")).toBeVisible();
    } finally {
      await queryContext.close();
    }

    const saveDataContext = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const saveDataPage = await saveDataContext.newPage();

    try {
      await saveDataPage.addInitScript(() => {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: { saveData: true },
        });
      });
      await saveDataPage.goto("/", { waitUntil: "domcontentloaded" });
      await expect(saveDataPage.getByTestId(INTRO.dialog)).toBeHidden();
      await expect(saveDataPage.getByTestId("home-hero-scene")).toBeVisible();
    } finally {
      await saveDataContext.close();
    }
  });

  test("standalone mode bypasses the intro without loading video media", async ({ browser }) => {
    const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();

    try {
      await page.addInitScript(() => {
        const nativeMatchMedia = window.matchMedia.bind(window);

        Object.defineProperty(navigator, "standalone", {
          configurable: true,
          value: true,
        });

        window.matchMedia = ((query: string) => {
          if (!query.includes("display-mode: standalone")) {
            return nativeMatchMedia(query);
          }

          const mediaQuery = nativeMatchMedia(query);
          return {
            addEventListener: mediaQuery.addEventListener.bind(mediaQuery),
            addListener: mediaQuery.addListener.bind(mediaQuery),
            dispatchEvent: mediaQuery.dispatchEvent.bind(mediaQuery),
            matches: true,
            media: query,
            onchange: null,
            removeEventListener: mediaQuery.removeEventListener.bind(mediaQuery),
            removeListener: mediaQuery.removeListener.bind(mediaQuery),
          } as MediaQueryList;
        }) as typeof window.matchMedia;
      });

      const videoRequests = watchForVideoRequests(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expectIntroHiddenWithoutVideo(page, videoRequests);
    } finally {
      await context.close();
    }
  });

  test("mobile stays on the student entry path and does not load intro video media", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();

    try {
      const videoRequests = watchForVideoRequests(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(/\/join(?:\?|$)/);
      await expectIntroHiddenWithoutVideo(page, videoRequests);
    } finally {
      await context.close();
    }
  });

  test("the no-JavaScript desktop document exposes the hero and three real tool entries", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: DESKTOP_VIEWPORT,
    });
    const page = await context.newPage();

    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId(INTRO.dialog)).toBeHidden();
      await expect(
        page.getByRole("heading", { name: "Mere liv i undervisningen.", exact: true }),
      ).toBeVisible();
      const primaryToolCta = page.getByRole("link", {
        name: "Kom i gang – vælg værktøj",
        exact: true,
      });
      await expect(primaryToolCta).toHaveAttribute("href", /^#/);
      const toolSectionHash = await primaryToolCta.getAttribute("href");
      expect(toolSectionHash).toBeTruthy();
      await expect(page.locator(toolSectionHash!)).toBeVisible();
      await expect(page.getByRole("link", { name: "Opret et GPS-løb", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Find arbejdsark", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Åbn Dagens Tavle", exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("the static teacher hero does not create horizontal overflow at narrow viewport widths", async ({
    browser,
  }) => {
    // 720 CSS px is the responsive-layout equivalent of a 1440 px display at
    // 200% browser zoom; the two smaller widths cover narrow mobile layouts.
    for (const width of [320, 390, 720]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
      });
      const page = await context.newPage();

      try {
        await page.goto("/?preview=static", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("home-hero-scene")).toBeVisible();
        const dimensions = await page.locator("html").evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
      } finally {
        await context.close();
      }
    }
  });

  test("Postløb keeps its separate landing page and never mounts the Danish intro", async ({ browser }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-host": "postlob.net" },
      viewport: DESKTOP_VIEWPORT,
    });
    const page = await context.newPage();

    try {
      const videoRequests = watchForVideoRequests(page);
      await page.goto("/?code=", { waitUntil: "domcontentloaded" });

      await expect(
        page.getByRole("heading", {
          name: "Lag aktive læringsløp på få minutter",
          exact: true,
        }),
      ).toBeVisible();
      await expectIntroHiddenWithoutVideo(page, videoRequests);
    } finally {
      await context.close();
    }
  });
});
