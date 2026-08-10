import { expect, test } from "@playwright/test";

import {
  DEFAULT_STANDARD_QUESTIONS,
  openHarnessedPlay,
  openStandardQuestion,
} from "./helpers/standardPlayV2Harness";

test.use({ serviceWorkers: "block" });

for (const raceType of ["manuel", "dansk", "engelsk", "matematik"]) {
  test(`${raceType} bruger den nye scoped standardvisning`, async ({ page }) => {
    await openHarnessedPlay(page, {
      sessionId: `standard-v2-${raceType}`,
      raceType,
    });

    await expect(page.getByTestId("standard-play-v2")).toBeVisible({
      timeout: 35_000,
    });
    await expect(page.getByText("Post 1 af 2").first()).toBeVisible();
    await expect(page.getByText("Det skal du gøre nu")).toBeVisible();
  });
}

test("Lynbygger-resultat bruger det samme manuelle standardflow", async ({
  page,
}) => {
  await openHarnessedPlay(page, {
    sessionId: "standard-v2-lynbygger-result",
    raceType: "manuel",
  });

  await expect(page.getByTestId("standard-play-v2")).toBeVisible();
  await expect(page.getByRole("button", { name: /^åbn post$/i })).toBeVisible();
});

test("VM26-manuel bevarer temaet i den nye standardvisning", async ({ page }) => {
  await openHarnessedPlay(page, {
    sessionId: "standard-v2-vm26",
    raceType: "manuel",
    theme: {
      vm26: {
        enabled: true,
        templateId: "vm26",
        version: 1,
      },
    },
  });

  await expect(page.getByTestId("standard-play-v2")).toBeVisible();
  await expect(page.getByText("VM26 – Jagten på pokalen")).toBeVisible();
});

test("standardnavigation viser authoritative progress og én tydelig handling", async ({
  page,
}) => {
  await openHarnessedPlay(page, {
    sessionId: "standard-v2-progress",
    raceType: "manuel",
  });

  await expect(page.getByTestId("standard-play-navigation-title")).toHaveText(
    "Posten er klar",
  );
  await expect(page.getByRole("button", { name: /^åbn post$/i })).toHaveCount(1);
  await expect(page.getByText("Post 1 af 2").first()).toBeVisible();
});

test("quiz bruger store svar, lange tekster og uændret submit-payload", async ({
  page,
}) => {
  const longQuestion = {
    ...DEFAULT_STANDARD_QUESTIONS[0],
    text: "Læs hele spørgsmålet og vælg det svar, der bedst forklarer, hvorfor sommerfuglen kan bevæge sig gennem luften på en rolig sommerdag.",
    answers: [
      "Fordi den har fire meget lange ben, som skubber den op fra jorden",
      "Fordi dens vinger skaber bevægelse og løft i luften",
      "Fordi den kun bevæger sig, når vinden blæser meget kraftigt",
      "Fordi den svømmer gennem luften på samme måde som en fisk",
    ],
  };
  const state = await openHarnessedPlay(page, {
    sessionId: "standard-v2-long-question",
    raceType: "dansk",
    questions: [longQuestion],
  });
  await openStandardQuestion(page);

  const correctAnswer = page.getByRole("button", {
    name: longQuestion.answers[1],
  });
  await expect(correctAnswer).toBeVisible();
  expect(
    await correctAnswer.evaluate((button) =>
      Number.parseFloat(getComputedStyle(button).minHeight),
    ),
  ).toBeGreaterThanOrEqual(62);
  await correctAnswer.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  await expect(page.getByTestId("standard-play-answer-success")).toBeVisible();
  await expect.poll(() => state.submitRequests.length).toBe(1);
  const payloads = state.submitRequests[0]?.payloads as
    | Array<Record<string, unknown>>
    | undefined;
  expect(payloads?.[0]).toMatchObject({
    post_index: 1,
    question_index: 0,
    selected_index: 1,
    is_correct: true,
    awarded_points: 10,
  });
});

test("offline svar køes og reconnect bruger den eksisterende levering", async ({
  page,
}) => {
  await openHarnessedPlay(page, {
    sessionId: "standard-v2-offline",
    raceType: "engelsk",
    questions: [DEFAULT_STANDARD_QUESTIONS[0]],
  });
  await openStandardQuestion(page);
  await page.context().setOffline(true);

  await page
    .getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] })
    .click();
  await expect(page.getByText("Svaret er gemt på telefonen")).toBeVisible({
    timeout: 10_000,
  });

  await page.context().setOffline(false);
  await expect(page.getByText("Svaret er gemt")).toBeVisible({ timeout: 20_000 });
});

test("reduced motion fjerner den nye progress-transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHarnessedPlay(page, {
    sessionId: "standard-v2-reduced-motion",
    raceType: "matematik",
  });

  const progressBar = page
    .getByTestId("standard-play-v2")
    .locator('[class*="transition-[width]"]')
    .first();
  await expect(progressBar).toHaveCSS("transition-property", "none");
});

test("320px og lange svar giver ingen vandret overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openHarnessedPlay(page, {
    sessionId: "standard-v2-320",
    raceType: "manuel",
    questions: [DEFAULT_STANDARD_QUESTIONS[0]],
  });
  await openStandardQuestion(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(
    page.getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[0] }),
  ).toBeVisible();
});

test("landscape holder kort og primær handling funktionelle", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHarnessedPlay(page, {
    sessionId: "standard-v2-landscape",
    raceType: "manuel",
  });

  const openButton = page.getByRole("button", { name: /^åbn post$/i });
  await expect(openButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await openButton.click();
  await expect(page.getByTestId("standard-play-task")).toBeVisible();
});

test("200 procent stor tekst skjuler ikke svar eller primær handling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHarnessedPlay(page, {
    sessionId: "standard-v2-large-text",
    raceType: "dansk",
    questions: [DEFAULT_STANDARD_QUESTIONS[0]],
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await openStandardQuestion(page);

  const firstAnswer = page.getByRole("button", {
    name: DEFAULT_STANDARD_QUESTIONS[0].answers[0],
  });
  await firstAnswer.scrollIntoViewIfNeeded();
  await expect(firstAnswer).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

for (const special of [
  { raceType: "scanner", usesStandard: false, type: "multiple_choice" as const },
  { raceType: "podcast_detektiven", usesStandard: false, type: "multiple_choice" as const },
  { raceType: "musikquiz", usesStandard: false, type: "multiple_choice" as const },
  { raceType: "foto", usesStandard: true, type: "ai_image" as const },
]) {
  test(`${special.raceType} rammes ikke af den nye standardpresentation`, async ({
    page,
  }) => {
    await openHarnessedPlay(page, {
      sessionId: `standard-v2-scope-${special.raceType}`,
      raceType: special.raceType,
      usesStandardStudentLocationExperience: special.usesStandard,
      questions: [
        {
          ...DEFAULT_STANDARD_QUESTIONS[0],
          type: special.type,
          aiPrompt:
            special.type === "ai_image" ? "Tag et billede af noget blåt" : undefined,
        },
      ],
    });

    await expect(page.getByTestId("standard-play-v2")).toHaveCount(0);
    await expect(page.getByText("Afstand", { exact: true })).toBeVisible({
      timeout: 35_000,
    });
  });
}
