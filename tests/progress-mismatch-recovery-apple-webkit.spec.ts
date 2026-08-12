import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

const SESSION_ID = "progress-mismatch-session";
const PARTICIPANT_ID = "11111111-2222-4333-8444-555555555555";
const TEAM_NAME = "RecoveryHold";
const POST_LAT = 55.6761;
const POST_LNG = 12.5683;
const OPERATION_ID = "00000000-0000-4000-8000-000000000041";

type MockAnswerRequest = {
  operationId?: string;
  payloads?: Array<Record<string, unknown>>;
};

type MockOptions = {
  restoreParticipant?: boolean;
  questionCount?: number;
  postOrderMode?: "fixed" | "distributed_circular";
  startOffset?: number;
  onSubmit: (request: MockAnswerRequest, submitNumber: number) => {
    status: number;
    body: Record<string, unknown>;
  };
};

function questions(count = 2) {
  return Array.from({ length: count }, (_, index) => ({
    type: "multiple_choice",
    text: `Recovery post ${index + 1}`,
    answers: [`Correct ${index + 1}`, `Wrong ${index + 1}`, "C", "D"],
    correctIndex: 0,
    points: 10,
    lat: POST_LAT,
    lng: POST_LNG,
  }));
}

async function mountMocks(
  context: BrowserContext,
  options: MockOptions
) {
  const requests: MockAnswerRequest[] = [];
  let joinCount = 0;
  let joinCountAtFirstSubmit: number | null = null;

  await context.routeWebSocket(/webpack-hmr/, (socket) => socket.close());
  await context.route(/supabase.*realtime|realtime\/v1\/websocket/i, (route) =>
    route.abort("connectionrefused")
  );
  await context.route(/\/auth\/v1\/token/i, (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "refresh unavailable in isolated test" }),
    })
  );
  await context.route(/\/rest\/v1\/answers/i, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/0" },
      body: "[]",
    })
  );

  await context.route(/\/api\/join/, async (route: Route) => {
    joinCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participantId: PARTICIPANT_ID,
        studentName: TEAM_NAME,
        startOffset: options.startOffset ?? 0,
        sessionStatus: "running",
      }),
    });
  });
  await context.route(/\/api\/play\/session/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: questions(options.questionCount ?? 2),
        raceType: "quiz",
        postOrderMode: options.postOrderMode ?? "fixed",
        usesStandardStudentLocationExperience: true,
        radius: 50,
        gpsOverride: false,
      }),
    })
  );
  await context.route(/\/api\/play\/status/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionStatus: "running", gpsOverride: false }),
    })
  );
  await context.route(/\/api\/play\/participant/, (route) =>
    route.fulfill({
      status: options.restoreParticipant ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(
        options.restoreParticipant
          ? {
              participant: {
                id: PARTICIPANT_ID,
                session_id: SESSION_ID,
                student_name: TEAM_NAME,
                start_offset: 0,
                finished_at: null,
                lat: POST_LAT,
                lng: POST_LNG,
              },
            }
          : { error: "Not found" }
      ),
    })
  );
  await context.route(/\/api\/play\/placements/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{\"placements\":[]}" })
  );
  await context.route(/\/api\/play\/location/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{\"ok\":true}" })
  );
  await context.route(/\/api\/play\/submit-answer/, async (route) => {
    const request = JSON.parse(route.request().postData() ?? "{}") as MockAnswerRequest;
    requests.push(request);
    if (requests.length === 1) {
      joinCountAtFirstSubmit = joinCount;
    }
    const response = options.onSubmit(request, requests.length);
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    });
  });

  return {
    requests,
    getJoinCount: () => joinCount,
    getJoinCountAtFirstSubmit: () => joinCountAtFirstSubmit,
  };
}

async function dismissOverlay(page: Page) {
  await page.addStyleTag({
    content: 'div[class*="fixed"][class*="inset-0"][class*="z-"]{display:none!important;pointer-events:none!important}',
  });
}

async function openPost(page: Page, answer: string) {
  await page.context().setGeolocation({
    latitude: POST_LAT + 0.000001,
    longitude: POST_LNG,
    accuracy: 5,
  });
  await page.context().setGeolocation({
    latitude: POST_LAT,
    longitude: POST_LNG,
    accuracy: 5,
  });
  const answerButton = page.getByRole("button", { name: answer });
  const openButton = page.getByRole("button", { name: /bn post/i });
  const recoverLocationButton = page.getByRole("button", {
    name: /Find min placering igen/i,
  });
  await expect(
    answerButton.or(openButton).or(recoverLocationButton).first()
  ).toBeVisible({ timeout: 30_000 });
  if (await recoverLocationButton.isVisible()) {
    await recoverLocationButton.click();
    await page.context().setGeolocation({
      latitude: POST_LAT + 0.000001,
      longitude: POST_LNG,
      accuracy: 5,
    });
    await page.context().setGeolocation({
      latitude: POST_LAT,
      longitude: POST_LNG,
      accuracy: 5,
    });
  }
  if (!(await answerButton.isVisible())) {
    await openButton.click();
  }
  await expect(answerButton).toBeVisible({ timeout: 30_000 });
}

async function freshJoin(page: Page) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: POST_LAT, longitude: POST_LNG, accuracy: 5 });
  await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
  await dismissOverlay(page);
  const nameInput = page.getByPlaceholder(/skriv holdnavn/i);
  await expect(nameInput).toBeVisible({ timeout: 30_000 });
  await nameInput.fill(TEAM_NAME);
  await page.getByRole("button", { name: /klar/i }).click();
}

test.describe("progress mismatch recovery", () => {
  test.describe.configure({ retries: 0 });

  test("409 on N reconciles to N+1 and the next answer returns 200", async ({ page }) => {
    const mock = await mountMocks(page.context(), {
      onSubmit: (_request, number) =>
        number === 1
          ? {
              status: 409,
              body: {
                error: "Posten matcher ikke den aktuelle serverprogression.",
                code: "PROGRESS_MISMATCH",
                expectedPostIndex: 1,
                answeredPostIndexes: [0],
              },
            }
          : {
              status: 200,
              body: {
                inserted: true,
                awardedPoints: 10,
                serverCorrectness: { checked: true, isCorrect: true },
              },
            },
    });

    await freshJoin(page);
    await openPost(page, "Correct 1");
    await page.getByRole("button", { name: "Correct 1" }).click();

    await openPost(page, "Correct 2");
    await page.getByRole("button", { name: "Correct 2" }).click();

    await expect.poll(() => mock.requests.length).toBe(2);
    expect(mock.requests[0].payloads?.[0]?.question_index).toBe(0);
    expect(mock.requests[1].payloads?.[0]?.question_index).toBe(1);
    await expect(page.getByText(/Svaret kunne ikke afleveres/i)).toHaveCount(0);
  });

  test("401 performs one rebind and resends the same operation id", async ({ page }) => {
    const mock = await mountMocks(page.context(), {
      onSubmit: (_request, number) =>
        number === 1
          ? { status: 401, body: { error: "Deltager-login mangler." } }
          : {
              status: 200,
              body: {
                inserted: true,
                awardedPoints: 10,
                serverCorrectness: { checked: true, isCorrect: true },
              },
            },
    });

    await freshJoin(page);
    await openPost(page, "Correct 1");
    await page.getByRole("button", { name: "Correct 1" }).click();

    await expect.poll(() => mock.requests.length, { timeout: 10_000 }).toBe(2);
    const joinCountAtFirstSubmit = mock.getJoinCountAtFirstSubmit();
    expect(joinCountAtFirstSubmit).not.toBeNull();
    expect(mock.requests[0].operationId).toBeTruthy();
    expect(mock.requests[1].operationId).toBe(mock.requests[0].operationId);
    expect(mock.getJoinCount()).toBe((joinCountAtFirstSubmit ?? 0) + 1);
    await expect(page.getByText(/Korrekt!/i)).toBeVisible({ timeout: 10_000 });
  });

  test("409 that still expects the same post retries with the same operation id", async ({ page }) => {
    const mock = await mountMocks(page.context(), {
      onSubmit: (_request, number) =>
        number === 1
          ? {
              status: 409,
              body: {
                error: "Posten matcher ikke den aktuelle serverprogression.",
                code: "PROGRESS_MISMATCH",
                expectedPostIndex: 0,
                answeredPostIndexes: [],
              },
            }
          : {
              status: 200,
              body: {
                inserted: true,
                awardedPoints: 10,
                serverCorrectness: { checked: true, isCorrect: true },
              },
            },
    });

    await freshJoin(page);
    await openPost(page, "Correct 1");
    await page.getByRole("button", { name: "Correct 1" }).click();
    await expect(page.getByRole("button", { name: /Pr.v igen/i })).toBeVisible();
    await page.getByRole("button", { name: /Pr.v igen/i }).click();

    await expect.poll(() => mock.requests.length).toBe(2);
    expect(mock.requests[1].operationId).toBe(mock.requests[0].operationId);
    await expect(page.getByText(/Korrekt!/i)).toBeVisible({ timeout: 10_000 });
  });

  test("distributed offset with 12 posts reconciles only the active participant", async ({ page }) => {
    const mock = await mountMocks(page.context(), {
      questionCount: 12,
      postOrderMode: "distributed_circular",
      startOffset: 7,
      onSubmit: (_request, number) =>
        number === 1
          ? {
              status: 409,
              body: {
                error: "Posten matcher ikke den aktuelle serverprogression.",
                code: "PROGRESS_MISMATCH",
                expectedPostIndex: 8,
                answeredPostIndexes: [7],
              },
            }
          : {
              status: 200,
              body: {
                inserted: true,
                awardedPoints: 10,
                serverCorrectness: { checked: true, isCorrect: true },
              },
            },
    });

    await freshJoin(page);
    await openPost(page, "Correct 8");
    await page.getByRole("button", { name: "Correct 8" }).click();
    await openPost(page, "Correct 9");
    await page.getByRole("button", { name: "Correct 9" }).click();

    await expect.poll(() => mock.requests.length).toBe(2);
    expect(mock.requests[0].payloads?.[0]?.question_index).toBe(7);
    expect(mock.requests[1].payloads?.[0]?.question_index).toBe(8);
  });

  test("legacy rejected localStorage is retryable after reload without a new operation", async ({ page }) => {
    const mock = await mountMocks(page.context(), {
      restoreParticipant: true,
      onSubmit: () => ({
        status: 200,
        body: {
          inserted: true,
          awardedPoints: 10,
          serverCorrectness: { checked: true, isCorrect: true },
        },
      }),
    });
    await page.context().grantPermissions(["geolocation"]);
    await page.addInitScript(
      ({ sessionId, participantId, operationId, teamName, savedAt }) => {
        localStorage.setItem(
          "gpslob_active_participant",
          JSON.stringify({
            participantId,
            sessionId,
            studentName: teamName,
            startOffset: 0,
            sessionStatus: "running",
            savedAt,
          })
        );
        localStorage.setItem(
          "gpslob_active_play_snapshot",
          JSON.stringify({
            participantId,
            sessionId,
            currentPostIndex: 0,
            solvedPostIndexes: [],
            answeredPostIndexes: [],
            burnedPosts: [],
            correctAnswersCount: 0,
            score: 0,
            showQuestion: true,
            dismissedPostIndex: null,
            playStartedAtMs: Date.now(),
            playFinishedAtMs: null,
            pendingAnswers: [
              {
                id: operationId,
                sessionId,
                participantId,
                submissionType: "quiz",
                status: "rejected",
                payloads: [
                  {
                    session_id: sessionId,
                    participant_id: participantId,
                    question_index: 0,
                    post_index: 1,
                    selected_index: 0,
                    answer_index: 0,
                    is_correct: true,
                    awarded_points: 10,
                  },
                ],
                solvedPostIndex: 0,
                awardedPoints: 10,
                isCorrect: true,
                hasLocalProgress: false,
                attemptCount: 0,
                nextRetryAtMs: null,
              },
            ],
            savedAt,
          })
        );
      },
      {
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        operationId: OPERATION_ID,
        teamName: TEAM_NAME,
        savedAt: new Date().toISOString(),
      }
    );

    await page.goto(`/play/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
    await dismissOverlay(page);
    await expect(page.getByRole("button", { name: /Pr.v igen/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /Pr.v igen/i }).click();

    await expect.poll(() => mock.requests.length, { timeout: 10_000 }).toBe(1);
    expect(mock.requests[0].operationId).toBe(OPERATION_ID);
    await expect(page.getByText(/Korrekt!/i)).toBeVisible({ timeout: 10_000 });
  });
});
