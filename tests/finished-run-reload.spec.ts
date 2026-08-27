import { expect, test, type Page } from "@playwright/test";

import {
  DEFAULT_STANDARD_QUESTIONS,
  dismissPlayMaintenanceOverlay,
  installStandardPlayHarness,
  openHarnessedPlay,
  openStandardQuestion,
  type StandardPlayQuestionFixture,
} from "./helpers/standardPlayV2Harness";

test.use({ serviceWorkers: "block" });
test.describe.configure({ timeout: 90_000 });

function makeQuestions(count: number): StandardPlayQuestionFixture[] {
  return Array.from({ length: count }, (_, postIndex) => ({
    ...DEFAULT_STANDARD_QUESTIONS[0],
    text: `Syntetisk finished-reload-post P${postIndex}`,
    answers: [
      `Forkert A P${postIndex}`,
      `Korrekt P${postIndex}`,
      `Forkert B P${postIndex}`,
    ],
    correctIndex: 1,
  }));
}

async function completeRun(
  page: Page,
  questions: StandardPlayQuestionFixture[],
  routeOrder: number[],
) {
  for (const [routeStep, postIndex] of routeOrder.entries()) {
    await openStandardQuestion(page);
    await expect(page.getByText(questions[postIndex].text)).toBeVisible();
    const answerButton = page.getByRole("button", {
      name: questions[postIndex].answers[questions[postIndex].correctIndex],
    });
    if (routeStep === routeOrder.length - 1) {
      await answerButton.evaluate((button) => {
        (button as HTMLButtonElement).click();
      });
      const resultButton = page.getByRole("button", { name: /se resultat/i });
      await expect(
        resultButton.or(page.getByText(/Løbet er slut\./i)),
      ).toBeVisible();
      if (await resultButton.isVisible()) {
        await resultButton.evaluate((button) => {
          (button as HTMLButtonElement).click();
        });
      }
    } else {
      await answerButton.evaluate((button) => {
        (button as HTMLButtonElement).click();
      });
      await expect(page.getByTestId("standard-play-answer-success")).toBeVisible();
      await page.getByRole("button", { name: /gå til næste post/i }).click();
    }
  }
}

async function expectFinishedWithoutNameOrPost(
  page: Page,
  questions: StandardPlayQuestionFixture[],
) {
  await expect(page.getByText(/Løbet er slut\./i)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Navngiv holdet" })).toHaveCount(
    0,
  );
  for (const question of questions) {
    await expect(page.getByText(question.text)).toHaveCount(0);
  }
}

for (const scenario of [
  {
    label: "fixed med tre poster",
    sessionId: "finished-reload-fixed-three",
    postOrderMode: "fixed" as const,
    startOffset: 0,
    routeOrder: [0, 1, 2],
  },
  {
    label: "fixed med en post",
    sessionId: "finished-reload-fixed-one",
    postOrderMode: "fixed" as const,
    startOffset: 0,
    routeOrder: [0],
  },
  {
    label: "distributed circular med forskudt start",
    sessionId: "finished-reload-distributed",
    postOrderMode: "distributed_circular" as const,
    startOffset: 1,
    routeOrder: [1, 2, 0],
  },
]) {
  test(`${scenario.label} bevarer målgang efter reload`, async ({ page }) => {
    const questions = makeQuestions(scenario.routeOrder.length);
    const state = await openHarnessedPlay(page, {
      sessionId: scenario.sessionId,
      questions,
      postOrderMode: scenario.postOrderMode,
      startOffset: scenario.startOffset,
      seedParticipantOnce: true,
    });

    await completeRun(page, questions, scenario.routeOrder);
    await expectFinishedWithoutNameOrPost(page, questions);
    await page.waitForTimeout(750);
    const storedParticipantBeforeReload = await page.evaluate(() =>
      window.localStorage.getItem("gpslob_active_participant"),
    );
    expect(storedParticipantBeforeReload).toContain(
      "a2000000-0000-4000-8000-000000000001",
    );
    const writesBeforeReload = state.participantFinishWrites;
    const submitsBeforeReload = state.submitRequests.length;
    const joinsBeforeReload = state.joinRequests;
    const participantReadsBeforeReload = state.participantRequests.length;

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(
      new RegExp(`/play/${scenario.sessionId}(?:\\?.*)?$`),
    );
    await expectFinishedWithoutNameOrPost(page, questions);
    await expect.poll(() => state.participantRequests.length).toBeGreaterThan(
      participantReadsBeforeReload,
    );
    await page.waitForTimeout(500);
    expect(state.participantFinishWrites).toBe(writesBeforeReload);
    expect(state.submitRequests).toHaveLength(submitsBeforeReload);
    expect(state.joinRequests).toBe(joinsBeforeReload);

    if (scenario.postOrderMode === "fixed" && scenario.routeOrder.length === 3) {
      await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      });
      await expectFinishedWithoutNameOrPost(page, questions);

      await page.evaluate(() => {
        window.history.pushState({}, "", `${window.location.pathname}?resume=1`);
      });
      await page.goBack({ waitUntil: "domcontentloaded" });
      await expectFinishedWithoutNameOrPost(page, questions);
    }
  });
}

test("gyldig server-session gendanner finished deltager uden lokal UI-state", async ({
  context,
  page,
}) => {
  const sessionId = "finished-reload-server-session-only";
  const questions = makeQuestions(1);
  await context.addCookies([
    {
      name: "synthetic-participant-session",
      value: "present",
      url: "http://localhost:3000",
    },
  ]);
  const state = await installStandardPlayHarness(page, {
    sessionId,
    questions,
    seedParticipant: false,
  });
  state.answeredPostIndexes.add(0);

  await page.goto(`/play/${sessionId}`, { waitUntil: "domcontentloaded" });
  await dismissPlayMaintenanceOverlay(page);

  await expectFinishedWithoutNameOrPost(page, questions);
  expect(
    state.participantRequests.some((requestUrl) => {
      const url = new URL(requestUrl);
      return (
        url.searchParams.get("includeProgress") === "1" &&
        !url.searchParams.has("participantId")
      );
    }),
  ).toBe(true);
  expect(state.participantFinishWrites).toBe(0);
  expect(state.joinRequests).toBe(0);
  expect(state.submitRequests).toHaveLength(0);
  expect(
    (await context.cookies()).some(
      (cookie) =>
        cookie.name === "synthetic-participant-session" &&
        cookie.value === "present",
    ),
  ).toBe(true);
});

test("uafsluttet deltager gendannes ved den næste autoritative post", async ({
  page,
}) => {
  const sessionId = "finished-reload-active-participant";
  const questions = makeQuestions(2);
  const state = await openHarnessedPlay(page, {
    sessionId,
    questions,
    seedParticipantOnce: true,
  });

  await openStandardQuestion(page);
  await page.getByRole("button", { name: "Korrekt P0" }).click();
  await expect(page.getByTestId("standard-play-answer-success")).toBeVisible();
  await page.getByRole("button", { name: /gå til næste post/i }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await openStandardQuestion(page);

  await expect(page.getByText(questions[1].text)).toBeVisible();
  await expect(page.getByText(/Løbet er slut\./i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Navngiv holdet" })).toHaveCount(
    0,
  );
  expect(state.participantFinishWrites).toBe(0);
});

test("uden gyldig participant-session vises holdnavnsskærmen", async ({ page }) => {
  const sessionId = "finished-reload-unauthenticated";
  const state = await installStandardPlayHarness(page, {
    sessionId,
    questions: makeQuestions(1),
    seedParticipant: false,
    authenticatedParticipant: false,
  });

  await page.goto(`/play/${sessionId}`, { waitUntil: "domcontentloaded" });
  await dismissPlayMaintenanceOverlay(page);

  await expect(page.getByRole("heading", { name: "Navngiv holdet" })).toBeVisible();
  await expect(page.getByText(/Løbet er slut\./i)).toHaveCount(0);
  expect(state.joinRequests).toBe(0);
});

test("transient bootstrapfejl viser recovery og retry gendanner målgang", async ({
  page,
}) => {
  const sessionId = "finished-reload-transient-retry";
  const questions = makeQuestions(1);
  const state = await installStandardPlayHarness(page, {
    sessionId,
    questions,
    seedParticipant: false,
    participantFailures: 1,
  });
  state.answeredPostIndexes.add(0);

  await page.goto(`/play/${sessionId}`, { waitUntil: "domcontentloaded" });
  await dismissPlayMaintenanceOverlay(page);

  await expect(
    page.getByRole("heading", {
      name: "Vi prøver at hente dig tilbage i løbet",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Navngiv holdet" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Genopret forbindelse" }).click();
  await expectFinishedWithoutNameOrPost(page, questions);
  expect(state.participantFinishWrites).toBe(0);
  expect(state.joinRequests).toBe(0);
});

test("langsom session-bound bootstrap viser loading uden holdnavnsflash", async ({
  page,
}) => {
  const sessionId = "finished-reload-slow-bootstrap";
  const questions = makeQuestions(1);
  const state = await installStandardPlayHarness(page, {
    sessionId,
    questions,
    seedParticipant: false,
    participantDelayMs: 1_500,
  });
  state.answeredPostIndexes.add(0);

  await page.goto(`/play/${sessionId}`, { waitUntil: "domcontentloaded" });
  await dismissPlayMaintenanceOverlay(page);

  await expect(page.getByText("Indlæser mission...")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Navngiv holdet" })).toHaveCount(
    0,
  );
  await expectFinishedWithoutNameOrPost(page, questions);
});
