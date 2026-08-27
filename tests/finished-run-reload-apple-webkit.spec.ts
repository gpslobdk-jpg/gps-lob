import { expect, test } from "@playwright/test";

import {
  DEFAULT_STANDARD_QUESTIONS,
  openHarnessedPlay,
  openStandardQuestion,
} from "./helpers/standardPlayV2Harness";

test.use({ serviceWorkers: "block" });

test("finished standard-run bevares efter reload i iPhone WebKit", async ({
  page,
}) => {
  const sessionId = "finished-reload-iphone-webkit";
  const state = await openHarnessedPlay(page, {
    sessionId,
    questions: [DEFAULT_STANDARD_QUESTIONS[0]],
    seedParticipantOnce: true,
  });

  await openStandardQuestion(page);
  await page
    .getByRole("button", { name: DEFAULT_STANDARD_QUESTIONS[0].answers[1] })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
  const resultButton = page.getByRole("button", { name: /se resultat/i });
  await expect(resultButton.or(page.getByText(/Løbet er slut\./i))).toBeVisible();
  if (await resultButton.isVisible()) {
    await resultButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
  }
  await expect(page.getByText(/Løbet er slut\./i)).toBeVisible();
  await page.waitForTimeout(750);

  const finishWritesBeforeReload = state.participantFinishWrites;
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Løbet er slut\./i)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Navngiv holdet" })).toHaveCount(
    0,
  );
  expect(state.participantFinishWrites).toBe(finishWritesBeforeReload);
});
