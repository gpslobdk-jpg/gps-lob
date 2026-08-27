import { expect, type Page, type Route } from "@playwright/test";

export const STANDARD_PLAY_POST_LAT = 55.6761;
export const STANDARD_PLAY_POST_LNG = 12.5683;

export type StandardPlayQuestionFixture = {
  type: "multiple_choice" | "ai_image";
  text: string;
  answers: string[];
  correctIndex: number;
  points: number;
  lat: number;
  lng: number;
  mediaUrl?: string;
  aiPrompt?: string;
};

export type StandardPlayHarnessOptions = {
  sessionId: string;
  raceType?: string;
  usesStandardStudentLocationExperience?: boolean;
  gpsOverride?: boolean;
  sessionStatus?: "waiting" | "running" | "finished";
  postOrderMode?: "fixed" | "distributed_circular";
  startOffset?: number;
  questions?: StandardPlayQuestionFixture[];
  sessionDelayMs?: number;
  submitDelayMs?: number;
  submitResponses?: Array<{
    status: number;
    body: Record<string, unknown>;
    delayMs?: number;
  }>;
  validateCorrect?: boolean;
  dropSubmitResponseAt?: number[];
  failSupabaseRequests?: boolean;
  theme?: {
    vm26?: {
      enabled: true;
      templateId: string;
      version: number;
    };
  };
};

export type StandardPlayHarnessState = {
  submitRequests: Array<Record<string, unknown>>;
  photoRequests: number;
  skipRequests: Array<Record<string, unknown>>;
  validateRequests: Array<Record<string, unknown>>;
  committedOperationIds: Set<string>;
  answeredPostIndexes: Set<number>;
};

export const DEFAULT_STANDARD_QUESTIONS: StandardPlayQuestionFixture[] = [
  {
    type: "multiple_choice",
    text: "Hvilket dyr kan flyve?",
    answers: ["Hesten", "Sommerfuglen", "Koen", "Fisken"],
    correctIndex: 1,
    points: 10,
    lat: STANDARD_PLAY_POST_LAT,
    lng: STANDARD_PLAY_POST_LNG,
  },
  {
    type: "multiple_choice",
    text: "Hvad er 4 + 4?",
    answers: ["6", "7", "8", "9"],
    correctIndex: 2,
    points: 10,
    lat: STANDARD_PLAY_POST_LAT + 0.001,
    lng: STANDARD_PLAY_POST_LNG + 0.001,
  },
];

export async function dismissPlayMaintenanceOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((element) => {
      const className =
        typeof element.className === "string" ? element.className : "";
      const text = element.textContent ?? "";
      if (
        className.includes("fixed") &&
        className.includes("inset-0") &&
        (text.includes("lukke siden ned") || text.includes("Vi holder pause"))
      ) {
        element.remove();
      }
    });
  });
}

export async function installStandardPlayHarness(
  page: Page,
  options: StandardPlayHarnessOptions,
): Promise<StandardPlayHarnessState> {
  const participantId = "a2000000-0000-4000-8000-000000000001";
  const teamName = "Elevholdet";
  const questions = options.questions ?? DEFAULT_STANDARD_QUESTIONS;
  const raceType = options.raceType ?? "manuel";
  const usesStandard =
    options.usesStandardStudentLocationExperience ?? true;
  const gpsOverride = options.gpsOverride ?? true;
  const sessionStatus = options.sessionStatus ?? "running";
  const postOrderMode = options.postOrderMode ?? "fixed";
  const startOffset = options.startOffset ?? 0;
  const state: StandardPlayHarnessState = {
    submitRequests: [],
    photoRequests: 0,
    skipRequests: [],
    validateRequests: [],
    committedOperationIds: new Set(),
    answeredPostIndexes: new Set(),
  };
  const routeOrder = Array.from(
    { length: questions.length },
    (_, index) =>
      postOrderMode === "distributed_circular"
        ? (startOffset + index) % questions.length
        : index,
  );
  const progressSnapshot = () => {
    const expectedPostIndex =
      routeOrder.find((postIndex) => !state.answeredPostIndexes.has(postIndex)) ??
      null;
    return {
      answeredPostIndexes: [...state.answeredPostIndexes].sort((a, b) => a - b),
      expectedPostIndex,
      isFinished: expectedPostIndex === null,
    };
  };

  await page.addInitScript(
    ({ participantId, sessionId, teamName, sessionStatus, startOffset }) => {
      window.localStorage.setItem(
        "gpslob_active_participant",
        JSON.stringify({
          participantId,
          sessionId,
          studentName: teamName,
          startOffset,
          savedAt: new Date().toISOString(),
          teamId: null,
          teamColor: null,
          avatarUrl: null,
          sessionStatus,
          hasCompletedAvatarGate: true,
        }),
      );
    },
    {
      participantId,
      sessionId: options.sessionId,
      teamName,
      sessionStatus,
      startOffset,
    },
  );

  await page.context().route(/\/api\/play\/session/, async (route: Route) => {
    if (options.sessionDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.sessionDelayMs));
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions,
        raceType,
        postOrderMode,
        radius: 50,
        gpsOverride,
        usesStandardStudentLocationExperience: usesStandard,
        theme: options.theme,
      }),
    });
  });

  await page.context().route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionStatus, gpsOverride }),
    });
  });

  await page.context().route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participant: {
          id: participantId,
          session_id: options.sessionId,
          student_name: teamName,
          start_offset: startOffset,
          lat: null,
          lng: null,
          finished_at: null,
        },
        progress: progressSnapshot(),
      }),
    });
  });

  await page.context().route(/\/api\/join/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participantId,
        sessionId: options.sessionId,
        studentName: teamName,
        startOffset,
        sessionStatus,
        teamId: null,
        teamColor: null,
      }),
    });
  });

  await page.context().route(/\/api\/play\/validate-answer/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<
      string,
      unknown
    >;
    state.validateRequests.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isCorrect: options.validateCorrect ?? true,
        awardedPoints: options.validateCorrect === false ? 0 : 10,
        brick: null,
      }),
    });
  });

  await page.context().route(/\/api\/play\/submit-answer/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<
      string,
      unknown
    >;
    state.submitRequests.push(body);
    const requestNumber = state.submitRequests.length;
    const operationId =
      typeof body.operationId === "string" ? body.operationId : "";
    const duplicate =
      operationId.length > 0 && state.committedOperationIds.has(operationId);
    const payloads = Array.isArray(body.payloads)
      ? (body.payloads as Array<Record<string, unknown>>)
      : [];
    const response = options.submitResponses?.[requestNumber - 1];
    const responseStatus = response?.status ?? 200;
    const shouldCommit =
      responseStatus >= 200 &&
      responseStatus < 300 &&
      (response?.body.inserted ?? true) === true;
    const submittedPostIndex = Number(payloads[0]?.question_index);
    if (
      shouldCommit &&
      Number.isInteger(submittedPostIndex) &&
      submittedPostIndex >= 0
    ) {
      state.answeredPostIndexes.add(submittedPostIndex);
    }
    if (shouldCommit && operationId) {
      state.committedOperationIds.add(operationId);
    }
    if (
      options.dropSubmitResponseAt?.includes(requestNumber) &&
      !duplicate
    ) {
      await route.abort("connectionreset");
      return;
    }
    const responseDelayMs = response?.delayMs ?? options.submitDelayMs;
    if (responseDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
    }
    await route.fulfill({
      status: response?.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(
        response?.body ?? {
          inserted: true,
          duplicate,
          awardedPoints: 10,
          serverCorrectness: { checked: true, isCorrect: true },
          ...progressSnapshot(),
        },
      ),
    });
  });

  await page.context().route(/\/api\/play\/submit-photo/, async (route: Route) => {
    state.photoRequests += 1;
    const activePostIndex = progressSnapshot().expectedPostIndex;
    if (activePostIndex !== null) {
      state.answeredPostIndexes.add(activePostIndex);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        storedAnswer: true,
        awardedPoints: 10,
        message: "Syntetisk foto gemt.",
        ...progressSnapshot(),
      }),
    });
  });

  await page.context().route(/\/api\/play\/skip-post/, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<
      string,
      unknown
    >;
    state.skipRequests.push(body);
    const skippedPostIndex = Number(body.postIndex);
    if (Number.isInteger(skippedPostIndex) && skippedPostIndex >= 0) {
      state.answeredPostIndexes.add(skippedPostIndex);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        skipped: true,
        postIndex: skippedPostIndex,
        awardedPoints: 0,
        ...progressSnapshot(),
      }),
    });
  });

  await page.context().route(/\/api\/play\/placements/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        placements: [
          {
            place: 1,
            studentName: teamName,
            finishedAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.context().route(
    /\/api\/play\/(?:location|auth\/refresh)|\/api\/telemetry|supabase|realtime/i,
    async (route: Route) => {
      await route.fulfill({
        status:
          options.failSupabaseRequests && /supabase/i.test(route.request().url())
            ? 503
            : 200,
        contentType: "application/json",
        body: JSON.stringify(
          options.failSupabaseRequests && /supabase/i.test(route.request().url())
            ? { error: "synthetic read failure" }
            : { ok: true },
        ),
      });
    },
  );

  return state;
}

export async function openHarnessedPlay(
  page: Page,
  options: StandardPlayHarnessOptions,
) {
  const state = await installStandardPlayHarness(page, options);
  await page.goto(`/play/${options.sessionId}?name=Elevholdet`, {
    waitUntil: "domcontentloaded",
  });
  await dismissPlayMaintenanceOverlay(page);
  return state;
}

export async function openStandardQuestion(page: Page) {
  await expect(page.getByTestId("standard-play-v2")).toBeVisible({
    timeout: 35_000,
  });
  const openButton = page.getByRole("button", { name: /^åbn post$/i });
  await expect(openButton).toBeVisible({ timeout: 10_000 });
  await openButton.click();
  await expect(page.getByTestId("standard-play-task")).toBeVisible();
}
