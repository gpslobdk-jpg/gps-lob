import {
  expect,
  test,
  type BrowserContext,
  type Route,
} from "@playwright/test";

import {
  PILEN_DEFAULT_DURATION_SECONDS,
  normalizeCharacterPostConfig,
} from "@/lib/characterPosts";
import { sanitizeQuestionForPlay } from "@/app/api/play/_shared";
import { buildCharacterCompletionMetadataPayload } from "@/lib/characterCompletion";
import {
  foundationCharacterConversationService,
} from "@/lib/characterConversation";
import {
  parseQuestion,
  resolvePostVariant,
} from "@/components/play/playUtils";
import {
  openHarnessedPlay,
  openStandardQuestion,
  STANDARD_PLAY_POST_LAT,
  STANDARD_PLAY_POST_LNG,
} from "./helpers/standardPlayV2Harness";

test.use({ serviceWorkers: "block" });

test("karaktermodellen er allowlistet, bagudkompatibel og låst til Pilen på engelsk", async () => {
  const sanitized = sanitizeQuestionForPlay({
    type: "multiple_choice",
    postType: "character",
    text: "Må ikke bruges som skjult prompt",
    transcript: "syntetisk elevspørgsmål",
    systemPrompt: "syntetisk systemtekst",
    answers: ["hemmeligt", "", "", ""],
    correctIndex: 0,
    points: 99,
    lat: STANDARD_PLAY_POST_LAT,
    lng: STANDARD_PLAY_POST_LNG,
    characterConfig: {
      character: "en-anden-figur",
      language: "da",
      topic: "Demokrati",
      gradeLevel: "7. klasse",
      placeDescription: "Christiansborg Slotsplads",
      maxDurationSeconds: 999,
      provider: "må-ikke-lække",
    },
  }, "character");

  expect(sanitized).toEqual({
    type: "multiple_choice",
    postType: "character",
    text: "Pilen fortæller",
    answers: ["", "", "", ""],
    correctIndex: null,
    points: 0,
    lat: STANDARD_PLAY_POST_LAT,
    lng: STANDARD_PLAY_POST_LNG,
    characterConfig: {
      character: "pilen",
      language: "en",
      topic: "Demokrati",
      gradeLevel: "7. klasse",
      placeDescription: "Christiansborg Slotsplads",
      maxDurationSeconds: 90,
    },
  });
  expect(JSON.stringify(sanitized)).not.toMatch(
    /systemPrompt|provider|transcript|syntetisk elevspørgsmål/,
  );

  const parsedCharacter = parseQuestion(sanitized);
  expect(parsedCharacter?.postType).toBe("character");
  expect(parsedCharacter && resolvePostVariant("quiz", parsedCharacter)).toBe(
    "character",
  );

  const legacyQuiz = parseQuestion({
    type: "multiple_choice",
    text: "Gammelt spørgsmål",
    answers: ["A", "B", "C", "D"],
    correctIndex: 0,
    points: 10,
    lat: 55,
    lng: 12,
  });
  expect(legacyQuiz?.postType).toBe("quiz");
  expect(legacyQuiz && resolvePostVariant("quiz", legacyQuiz)).toBe("quiz");
});

test("completion-payload fjerner lyd, tekst, samtalehistorik og position", async () => {
  const payload = buildCharacterCompletionMetadataPayload({
    session_id: "session",
    participant_id: "participant",
    student_name: "hold",
    post_index: 2,
    question_index: 1,
    selected_index: 3,
    answer_index: 3,
    is_correct: false,
    awarded_points: 50,
    answered_at: "2026-08-29T10:00:00.000Z",
    transcript: "syntetisk elevspørgsmål",
    conversationHistory: ["syntetisk svar"],
    audio: "data:audio/wav;base64,syntetisk",
    question_text: "syntetisk samtaletekst",
    lat: 55.6761,
    lng: 12.5683,
  });

  expect(payload).toEqual({
    session_id: "session",
    participant_id: "participant",
    student_name: "hold",
    post_index: 2,
    question_index: 1,
    selected_index: 0,
    answer_index: 0,
    is_correct: true,
    awarded_points: 0,
    answered_at: "2026-08-29T10:00:00.000Z",
  });
  expect(JSON.stringify(payload)).not.toMatch(
    /transcript|conversation|audio|question_text|lat|lng|syntetisk/,
  );
});

test("foundation-servicen åbner kun en flygtig session uden samtaleindhold", async () => {
  const config = normalizeCharacterPostConfig({
    topic: "Demokrati",
    gradeLevel: "7. klasse",
    placeDescription: "Christiansborg",
    maxDurationSeconds: 75,
  });
  const handle = await foundationCharacterConversationService.start({
    config,
    locationContext: { placeDescription: config.placeDescription },
  });
  const stopped = await handle.stop("student_finished");

  expect(foundationCharacterConversationService.mode).toBe("foundation");
  expect(Object.keys(handle).sort()).toEqual(["startedAtMs", "stop"]);
  expect(Object.keys(stopped)).toEqual(["durationSeconds"]);
  expect(stopped.durationSeconds).toBeGreaterThanOrEqual(0);
});

test("mobil elevprototype afslutter autoritativt uden samtaleindhold i request eller storage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await openHarnessedPlay(page, {
    sessionId: "pilen-foundation-student",
    raceType: "manuel",
    questions: [
      {
        type: "multiple_choice",
        postType: "character",
        text: "syntetisk samtaleindhold må ikke gemmes",
        answers: ["", "", "", ""],
        correctIndex: 0,
        points: 0,
        lat: STANDARD_PLAY_POST_LAT,
        lng: STANDARD_PLAY_POST_LNG,
        characterConfig: {
          character: "pilen",
          language: "en",
          topic: "Danish democracy",
          gradeLevel: "7. klasse",
          placeDescription: "Christiansborg Slotsplads",
          maxDurationSeconds: PILEN_DEFAULT_DURATION_SECONDS,
        },
      },
    ],
  });

  await openStandardQuestion(page);
  await expect(page.getByTestId("pilen-conversation-card")).toBeVisible();
  await expect(page.getByText("You found Pilen")).toBeVisible();
  await expect(page.getByText("Christiansborg Slotsplads")).toBeVisible();
  await expect(
    page.getByText(/No sound or conversation is recorded or saved/i),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Pilen er en AI – ikke et menneske. Din stemme bruges kun til den korte samtale.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Talk to Pilen" }).click();
  await expect(page.getByText("Pilen is ready")).toBeVisible();
  await page.getByRole("button", { name: "End conversation" }).click();
  await expect(page.getByText("Conversation ended")).toBeVisible();
  await page.getByRole("button", { name: "Finish post" }).click();

  await expect(page.getByText(/Løbet er slut\./i)).toBeVisible({
    timeout: 30_000,
  });
  expect(state.submitRequests).toHaveLength(1);
  const requestJson = JSON.stringify(state.submitRequests[0]);
  expect(requestJson).not.toMatch(
    /syntetisk samtaleindhold|Danish democracy|Christiansborg|transcript|audio|conversationHistory/,
  );
  const payloads = state.submitRequests[0]?.payloads as
    | Array<Record<string, unknown>>
    | undefined;
  expect(payloads?.[0]).toMatchObject({
    post_index: 1,
    question_index: 0,
    selected_index: 0,
    is_correct: true,
    awarded_points: 0,
    question_text: "",
    lat: null,
    lng: null,
  });

  const storedValues = await page.evaluate(() => {
    const values: string[] = [];
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key) values.push(storage.getItem(key) ?? "");
      }
    }
    return values.join("\n");
  });
  expect(storedValues).not.toMatch(
    /syntetisk samtaleindhold|Danish democracy|Christiansborg|transcript|audio|conversationHistory/,
  );
});

const TEACHER_USER_ID = "bbbbbbbb-1111-4222-8333-cccccccc0001";

function base64UrlEncode(value: unknown) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function setupTeacherContext(context: BrowserContext) {
  let acknowledgementAccepted = false;
  const session = {
    access_token: "mock-pilen-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-pilen-refresh-token",
    user: {
      id: TEACHER_USER_ID,
      email: "pilen@test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Pilen Test Teacher" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };
  const cookieValue = `base64-${base64UrlEncode(session)}`;
  const cookieNames = [
    "sb-localhost-auth-token",
    "sb-127-auth-token",
    "sb-xodrzahqdgbsssntupjt-auth-token",
  ];

  await context.addCookies(
    cookieNames.flatMap((name) => [
      {
        name,
        value: cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      },
      {
        name: `${name}.0`,
        value: cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      },
    ]),
  );
  await context.addInitScript(() => {
    window.localStorage.setItem("gpslob_tour_finished", "true");
  });
  await context.routeWebSocket(/webpack-hmr/, (socket) => socket.close());
  await context.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();
    const body = url.includes("/user") ? session.user : session;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await context.route("**/realtime/**", (route: Route) =>
    route.abort("connectionrefused"),
  );
  await context.route("**/api/pilen/teacher-acknowledgement", async (route: Route) => {
    if (route.request().method() === "POST") {
      acknowledgementAccepted = true;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accepted: acknowledgementAccepted,
        version: "2026-08-30-v1",
      }),
    });
  });
  await context.route("**/rest/v1/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().method() === "GET" ? "[]" : "{}",
    });
  });
}

test("lærerflowet viser enkel Pilen-konfiguration uden tekniske AI-felter", async ({
  page,
  context,
}) => {
  await setupTeacherContext(context);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: STANDARD_PLAY_POST_LAT,
    longitude: STANDARD_PLAY_POST_LNG,
    accuracy: 5,
  });

  await page.goto("/dashboard/opret/manuel", {
    waitUntil: "domcontentloaded",
  });
  const firstPost = page.locator('article[id^="manuel-post-"]').first();
  await expect(firstPost).toBeVisible({ timeout: 30_000 });
  await firstPost.locator("select").first().selectOption("character");

  await expect(
    firstPost.getByRole("heading", { name: "Pilen fortæller", exact: true }),
  ).toBeVisible();
  await expect(
    firstPost.getByText(
      "Eleverne møder Pilen ved posten og taler kort med ham på engelsk.",
    ),
  ).toBeVisible();
  await firstPost.getByTestId("pilen-topic").fill("Det danske demokrati");
  await firstPost.getByTestId("pilen-place").fill("Christiansborg Slotsplads");
  await firstPost.getByTestId("pilen-duration").selectOption("90");
  await expect(firstPost.getByText("Sprog: Engelsk")).toBeVisible();
  await expect(firstPost.getByText("højst 90 sek.")).toBeVisible();
  const acknowledgement = page.getByTestId("pilen-teacher-acknowledgement");
  await expect(acknowledgement).toContainText(
    "Pilen bruger en ekstern AI-tjeneste til den korte stemmesamtale.",
  );
  await expect(
    acknowledgement.getByText(
      /nødvendig tilladelse fra forælder\/værge er på plads/i,
    ),
  ).toBeVisible();
  await expect(
    acknowledgement.getByRole("link", { name: "Om Pilen og persondata" }),
  ).toHaveAttribute("href", "/privacy#pilen-fortaeller");
  await expect(acknowledgement.locator("input")).toHaveCount(1);
  await expect(acknowledgement).not.toContainText(/alder|fødselsdato|elevnavn|upload/i);
  await acknowledgement.getByRole("checkbox").check();
  await expect(firstPost).not.toContainText(/system prompt|provider|temperature|LLM/i);

  await expect
    .poll(async () => {
      return page.evaluate(() =>
        window.localStorage.getItem("draft_run_manuel"),
      );
    })
    .toContain('"postType":"character"');
  const draft = await page.evaluate(() =>
    window.localStorage.getItem("draft_run_manuel"),
  );
  expect(draft).toContain('"postType":"character"');
  expect(draft).toContain('"character":"pilen"');
  expect(draft).toContain('"language":"en"');
  expect(draft).toContain('"maxDurationSeconds":90');
  expect(draft).not.toMatch(/transcript|audio|conversationHistory|studentQuestion/i);
});
