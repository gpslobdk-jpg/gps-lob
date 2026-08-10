import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_STANDARD_QUESTIONS,
  STANDARD_PLAY_POST_LAT,
  STANDARD_PLAY_POST_LNG,
  dismissPlayMaintenanceOverlay,
  installStandardPlayHarness,
  openHarnessedPlay,
  openStandardQuestion,
  type StandardPlayHarnessOptions,
} from "./helpers/standardPlayV2Harness";

test.use({ serviceWorkers: "block" });

const SCREENSHOT_DIR = path.join(
  os.tmpdir(),
  "skolegps-standard-play-v2-review",
);

function screenshotPath(name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return path.join(SCREENSHOT_DIR, `${name}.png`);
}

async function hideLocalDevelopmentUi(page: Page) {
  await dismissPlayMaintenanceOverlay(page);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function createHarnessPage(
  browser: Browser,
  options: StandardPlayHarnessOptions,
  contextOptions: Parameters<Browser["newContext"]>[0] = {},
) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...contextOptions,
  });
  const page = await context.newPage();
  await openHarnessedPlay(page, options);
  await hideLocalDevelopmentUi(page);
  return { context, page };
}

async function capture(
  page: Page,
  name: string,
  fullPage = false,
) {
  await page.screenshot({
    path: screenshotPath(name),
    fullPage,
  });
}

test("producerer responsive standard-navigation screenshots uden for repo", async ({
  browser,
}) => {
  const { context, page } = await createHarnessPage(browser, {
    sessionId: "standard-v2-responsive-gallery",
    raceType: "manuel",
  });
  await expect(page.getByTestId("standard-play-v2")).toBeVisible({
    timeout: 35_000,
  });

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("button", { name: /^åbn post$/i })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await capture(page, `navigation-${viewport.width}x${viewport.height}`);
  }

  await context.close();
});

test("producerer den komplette standardflow-state-galleri uden for repo", async ({
  browser,
}) => {
  test.setTimeout(240_000);

  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await installStandardPlayHarness(page, {
      sessionId: "standard-v2-shot-loading",
      raceType: "manuel",
      sessionDelayMs: 12_000,
    });
    await page.goto("/play/standard-v2-shot-loading?name=Elevholdet", {
      waitUntil: "domcontentloaded",
    });
    await hideLocalDevelopmentUi(page);
    await expect(page.getByText("Indlæser mission...")).toBeVisible({
      timeout: 35_000,
    });
    await capture(page, "state-01-loading-390x844");
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(browser, {
      sessionId: "standard-v2-shot-permission",
      raceType: "manuel",
      gpsOverride: false,
    });
    await expect(page.getByText("Find din placering", { exact: true })).toBeVisible({
      timeout: 35_000,
    });
    await capture(page, "state-02-gps-permission-390x844");
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const permissionStatus = {
        state: "prompt",
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
      } as unknown as PermissionStatus;
      Object.defineProperty(navigator, "permissions", {
        configurable: true,
        value: { query: async () => permissionStatus },
      });
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          clearWatch() {},
          getCurrentPosition() {},
          watchPosition() {
            return 1;
          },
        },
      });
    });
    await installStandardPlayHarness(page, {
      sessionId: "standard-v2-shot-locating",
      raceType: "manuel",
      gpsOverride: false,
    });
    await page.goto("/play/standard-v2-shot-locating?name=Elevholdet");
    await hideLocalDevelopmentUi(page);
    await page.getByRole("button", { name: "Tillad placering" }).click();
    await expect(page.getByText("Finder din placering…").last()).toBeVisible();
    await capture(page, "state-03-finder-placering-390x844");
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(
      browser,
      {
        sessionId: "standard-v2-shot-far",
        raceType: "manuel",
        gpsOverride: false,
      },
      {
        permissions: ["geolocation"],
        geolocation: {
          latitude: STANDARD_PLAY_POST_LAT + 0.01,
          longitude: STANDARD_PLAY_POST_LNG,
          accuracy: 5,
        },
      },
    );
    await expect(page.getByTestId("standard-play-distance")).toContainText("Gå", {
      timeout: 35_000,
    });
    await capture(page, "state-04-langt-fra-post-390x844");
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(
      browser,
      {
        sessionId: "standard-v2-shot-near",
        raceType: "manuel",
        gpsOverride: false,
      },
      {
        permissions: ["geolocation"],
        geolocation: {
          latitude: STANDARD_PLAY_POST_LAT,
          longitude: STANDARD_PLAY_POST_LNG,
          accuracy: 300,
        },
      },
    );
    await expect(
      page.getByText("GPS-signalet er lidt usikkert", { exact: true }),
    ).toBeVisible({ timeout: 35_000 });
    await capture(page, "state-05-taet-paa-post-390x844");
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(
      browser,
      {
        sessionId: "standard-v2-shot-arrived",
        raceType: "manuel",
        gpsOverride: false,
      },
      {
        permissions: ["geolocation"],
        geolocation: {
          latitude: STANDARD_PLAY_POST_LAT,
          longitude: STANDARD_PLAY_POST_LNG,
          accuracy: 5,
        },
      },
    );
    await expect(page.getByTestId("standard-play-arrived")).toBeVisible({
      timeout: 35_000,
    });
    await capture(page, "state-06-post-fundet-390x844");
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(browser, {
      sessionId: "standard-v2-shot-quiz",
      raceType: "manuel",
    });
    await openStandardQuestion(page);
    await capture(page, "state-07-quiz-aabnet-390x844", true);
    await context.close();
  }

  const longQuestion = {
    ...DEFAULT_STANDARD_QUESTIONS[0],
    text: "Læs hele spørgsmålet og vælg den forklaring, der bedst beskriver, hvordan et dyr kan bevæge sig sikkert gennem luften på en blæsende dag.",
    answers: [
      "Det bruger kun sine ben til at skubbe sig gennem luften uden hjælp fra vinger",
      "Det bruger vingerne til at skabe løft og styre retningen, mens det flyver",
      "Det venter altid på, at vinden flytter det helt uden selv at bevæge sig",
      "Det bevæger sig gennem luften på præcis samme måde som en fisk i vand",
    ],
  };

  {
    const { context, page } = await createHarnessPage(browser, {
      sessionId: "standard-v2-shot-long-question",
      raceType: "dansk",
      questions: [longQuestion],
    });
    await openStandardQuestion(page);
    await capture(page, "state-08-langt-spoergsmaal-390x844", true);
    await page.getByRole("button", { name: longQuestion.answers[1] }).scrollIntoViewIfNeeded();
    await capture(page, "state-09-lange-svar-390x844", true);
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(browser, {
      sessionId: "standard-v2-shot-submit",
      raceType: "manuel",
      questions: [DEFAULT_STANDARD_QUESTIONS[0]],
      submitDelayMs: 8_000,
    });
    await openStandardQuestion(page);
    await page
      .getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] })
      .click();
    await expect(page.getByText("Sender dit svar…")).toBeVisible();
    await capture(page, "state-10-submit-loading-390x844", true);
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(browser, {
      sessionId: "standard-v2-shot-feedback",
      raceType: "manuel",
      questions: [DEFAULT_STANDARD_QUESTIONS[0]],
    });
    await openStandardQuestion(page);
    await page
      .getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] })
      .click();
    await expect(page.getByTestId("standard-play-answer-success")).toBeVisible();
    await capture(page, "state-11-answer-feedback-390x844", true);
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(browser, {
      sessionId: "standard-v2-shot-offline",
      raceType: "engelsk",
      questions: [DEFAULT_STANDARD_QUESTIONS[0]],
    });
    await openStandardQuestion(page);
    await context.setOffline(true);
    await page
      .getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] })
      .click();
    await expect(page.getByText("Svaret er gemt på telefonen")).toBeVisible();
    await capture(page, "state-12-offline-390x844", true);
    await context.setOffline(false);
    await expect(page.getByText("Svaret er gemt")).toBeVisible({ timeout: 20_000 });
    await capture(page, "state-13-reconnect-390x844", true);
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(browser, {
      sessionId: "standard-v2-shot-next",
      raceType: "matematik",
    });
    await openStandardQuestion(page);
    await page
      .getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] })
      .click();
    await page.getByRole("button", { name: "Gå til næste post" }).click();
    await expect(page.getByText("Post 2 af 2").first()).toBeVisible();
    await capture(page, "state-14-naeste-post-390x844");
    await context.close();
  }

  {
    const { context, page } = await createHarnessPage(browser, {
      sessionId: "standard-v2-shot-finish",
      raceType: "manuel",
      questions: [DEFAULT_STANDARD_QUESTIONS[0]],
    });
    await openStandardQuestion(page);
    await page
      .getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] })
      .click();
    await page.getByRole("button", { name: "Se resultat" }).click();
    await expect(page.getByText("Løbet er slut.")).toBeVisible({ timeout: 15_000 });
    await hideLocalDevelopmentUi(page);
    await capture(page, "state-15-finish-overgang-390x844", true);
    await context.close();
  }
});
