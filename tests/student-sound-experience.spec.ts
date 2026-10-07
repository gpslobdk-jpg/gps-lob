import { expect, test, type Page } from "@playwright/test";

import {
  DEFAULT_STANDARD_QUESTIONS,
  openHarnessedPlay,
  openStandardQuestion,
  type StandardPlayQuestionFixture,
} from "./helpers/standardPlayV2Harness";

async function recordMediaPlayback(page: Page, reject = false) {
  await page.addInitScript(({ shouldReject }) => {
    const originalPlay = HTMLMediaElement.prototype.play;
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value(this: HTMLMediaElement) {
        const currentWindow = window as Window & { __studentSoundPlayCalls?: string[] };
        currentWindow.__studentSoundPlayCalls ??= [];
        currentWindow.__studentSoundPlayCalls.push(this.currentSrc || this.src || "audio");
        if (shouldReject) {
          return Promise.reject(new DOMException("Syntetisk afvist af browseren", "NotAllowedError"));
        }
        return Promise.resolve();
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "__studentSoundOriginalPlay", {
      configurable: true,
      value: originalPlay,
    });
  }, { shouldReject: reject });
}

async function soundPlayCalls(page: Page) {
  return page.evaluate(
    () => (window as Window & { __studentSoundPlayCalls?: string[] }).__studentSoundPlayCalls ?? [],
  );
}

test.describe("student sound controller", () => {
  test("starter lydløst og henter ikke lyd før elevens valg", async ({ page }) => {
    const audioRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/audio/elev/")) {
        audioRequests.push(request.url());
      }
    });
    await recordMediaPlayback(page);

    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a101",
    });

    const controller = page.getByTestId("student-sound-controller");
    await expect(controller).toBeVisible();
    await expect(page.getByText("Gør missionen levende", { exact: true })).toBeVisible();
    await expect(page.getByTestId("student-sound-enable")).toBeVisible();
    await expect(soundPlayCalls(page)).resolves.toEqual([]);
    expect(audioRequests).toEqual([]);
  });

  test("henter kun den kompakte, lokale lydpakke efter elevens opt-in", async ({ page }) => {
    const assetRequests = new Set<string>();
    const responseBytes = new Map<string, number>();
    page.on("response", async (response) => {
      if (!response.url().includes("/audio/elev/")) {
        return;
      }

      assetRequests.add(response.url());
      try {
        responseBytes.set(response.url(), (await response.body()).byteLength);
      } catch {
        // A browser may finish a media stream after the test closes. The
        // request still proves that only the local asset path was used.
      }
    });

    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a100",
    });
    await page.getByTestId("student-sound-enable").click();

    await expect.poll(() => assetRequests.size).toBeGreaterThan(0);
    await page.waitForTimeout(100);
    expect([...assetRequests]).toEqual(
      expect.arrayContaining([expect.stringMatching(/\/audio\/elev\//)]),
    );
    expect([...assetRequests].every((url) => url.includes("/audio/elev/"))).toBe(true);

    const transferredBytes = [...responseBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
    expect(transferredBytes).toBeGreaterThan(0);
    expect(transferredBytes).toBeLessThanOrEqual(600 * 1024);
  });

  test("elev kan vælge alle tre lydtilstande uden at ændre quizflowet", async ({ page }) => {
    await recordMediaPlayback(page);
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a102",
    });

    await page.getByTestId("student-sound-continue-silent").click();
    await expect(page.getByTestId("student-sound-settings")).toContainText("Lyd: Fra");
    await expect(soundPlayCalls(page)).resolves.toEqual([]);

    await page.getByTestId("student-sound-settings").click();
    const effectsOnly = page.getByTestId("student-sound-mode-effects-only");
    await effectsOnly.click();
    await expect(page.getByTestId("student-sound-settings")).toContainText("Lyd: Effekter");
    await expect.poll(() => soundPlayCalls(page).then((calls) => calls.length)).toBeGreaterThan(0);

    await page.getByTestId("student-sound-settings").click();
    await page.getByTestId("student-sound-mode-music-effects").click();
    await expect(page.getByTestId("student-sound-settings")).toContainText("Lyd: Til");
    await expect(page.getByTestId("standard-play-v2")).toBeVisible();
  });

  test("lydindstillinger returnerer tastaturfokus til deres udløser", async ({ page }) => {
    await recordMediaPlayback(page);
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a109",
    });

    await page.getByTestId("student-sound-continue-silent").click();
    const settings = page.getByTestId("student-sound-settings");
    await settings.focus();
    await settings.press("Enter");
    await page.getByTestId("student-sound-mode-effects-only").press("Enter");
    await expect(settings).toBeFocused();

    await settings.press("Enter");
    await page.getByRole("button", { name: "Luk" }).press("Enter");
    await expect(settings).toBeFocused();
  });

  test("lydkontrol dækkes ikke over spørgsmål eller oplæsning", async ({ page }) => {
    await recordMediaPlayback(page);
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a103",
    });

    await page.getByTestId("student-sound-enable").click();
    await openStandardQuestion(page);
    await expect(page.getByTestId("student-sound-controller")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Læs spørgsmål og svar op" })).toBeVisible();
  });

  test("browserens lydfejl falder tilbage til den samme brugbare quiz", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await recordMediaPlayback(page, true);
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a104",
    });

    await page.getByTestId("student-sound-enable").click();
    await expect(page.getByTestId("student-sound-settings")).toBeVisible();
    await expect(page.getByTestId("standard-play-v2")).toBeVisible();
    await page.waitForTimeout(50);
    expect(pageErrors).toEqual([]);
  });

  test("korrekt-cue kommer én gang efter serverbekræftelse, når eleven har valgt lyd", async ({ page }) => {
    await recordMediaPlayback(page);
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a106",
    });

    await page.getByTestId("student-sound-enable").click();
    await page.getByTestId("student-sound-settings").click();
    await page.getByTestId("student-sound-mode-effects-only").click();
    await openStandardQuestion(page);
    await page.getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] }).click();
    await expect(page.getByTestId("standard-play-answer-success")).toBeVisible();

    await expect.poll(async () => (await soundPlayCalls(page)).filter((src) => src.includes("correct.mp3")).length).toBe(1);
    await page.waitForTimeout(50);
    expect((await soundPlayCalls(page)).filter((src) => src.includes("correct.mp3"))).toHaveLength(1);
  });

  test("mål-cue kommer kun én gang, når GameState efterfølgende skriver afslutningstidspunktet", async ({ page }) => {
    await recordMediaPlayback(page);
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a108",
      questions: [DEFAULT_STANDARD_QUESTIONS[0]],
    });

    await page.getByTestId("student-sound-enable").click();
    await page.getByTestId("student-sound-settings").click();
    await page.getByTestId("student-sound-mode-effects-only").click();
    await openStandardQuestion(page);
    await page.getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] }).click();
    await expect(page.getByTestId("standard-play-answer-success")).toBeVisible();
    await page.getByRole("button", { name: /se resultat/i }).click();
    await expect(page.getByTestId("student-adventure-finish")).toBeVisible();

    await expect
      .poll(async () => (await soundPlayCalls(page)).filter((src) => src.includes("i-maal-sting.mp3")).length)
      .toBe(1);
    await page.waitForTimeout(50);
    expect((await soundPlayCalls(page)).filter((src) => src.includes("i-maal-sting.mp3"))).toHaveLength(1);
  });

  test("en cue, der sker før opt-in, bliver ikke afspillet forsinket efter elevens valg", async ({ page }) => {
    await recordMediaPlayback(page);
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a107",
    });

    await openStandardQuestion(page);
    await page.getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] }).click();
    await expect(page.getByTestId("standard-play-answer-success")).toBeVisible();
    await page.getByRole("button", { name: /gå til næste post/i }).click();
    await expect(page.getByTestId("student-sound-enable")).toBeVisible();
    await page.getByTestId("student-sound-enable").click();
    await page.waitForTimeout(50);

    expect((await soundPlayCalls(page)).filter((src) => src.includes("correct.mp3"))).toHaveLength(0);
  });

  test("Musikquiz får ikke den nye lokale Pilen-lydcontroller", async ({ page }) => {
    const musicQuizQuestion = {
      ...DEFAULT_STANDARD_QUESTIONS[0],
      previewUrl: "/synthetic-musicquiz-preview.mp3",
    } as StandardPlayQuestionFixture;
    await openHarnessedPlay(page, {
      sessionId: "a3000000-0000-4000-8000-00000000a105",
      raceType: "musikquiz",
      questions: [musicQuizQuestion],
    });

    await expect(page.getByTestId("standard-play-v2")).toBeVisible();
    await expect(page.getByTestId("student-sound-controller")).toHaveCount(0);
  });
});
