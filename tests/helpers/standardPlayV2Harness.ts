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
  questions?: StandardPlayQuestionFixture[];
  sessionDelayMs?: number;
  submitDelayMs?: number;
  submitResponses?: Array<{
    status: number;
    body: Record<string, unknown>;
    delayMs?: number;
  }>;
  validateCorrect?: boolean;
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
  validateRequests: Array<Record<string, unknown>>;
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
  const state: StandardPlayHarnessState = {
    submitRequests: [],
    validateRequests: [],
  };

  await page.addInitScript(
    ({ participantId, sessionId, teamName, sessionStatus }) => {
      window.localStorage.setItem(
        "gpslob_active_participant",
        JSON.stringify({
          participantId,
          sessionId,
          studentName: teamName,
          startOffset: 0,
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
        postOrderMode: "fixed",
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
          start_offset: 0,
          lat: null,
          lng: null,
          finished_at: null,
        },
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
        startOffset: 0,
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
    const response = options.submitResponses?.[state.submitRequests.length - 1];
    const responseDelayMs = response?.delayMs ?? options.submitDelayMs;
    if (responseDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
    }
    await route.fulfill({
      status: response?.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(
        response?.body ?? { inserted: true, awardedPoints: 10 },
      ),
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
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
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
