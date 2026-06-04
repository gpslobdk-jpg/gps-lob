import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

type SmokeQuestion = {
  id: number;
  type: "multiple_choice";
  text: string;
  answers: [string, string, string, string];
  correctIndex: number;
  points: number;
  lat: number;
  lng: number;
  radius_m: number;
};

type SmokeSession = {
  runId: string;
  sessionId: string;
  pin: string;
};

type GameTeam = {
  id: string;
  team_name: string;
  color: string;
};

type GameZone = {
  id: string;
  zone_index: number;
  owner_team_id: string | null;
  shield_until: string | null;
};

type JoinResponse = {
  participantId: string;
  teamId: string;
  teamName?: string | null;
};

const BASE_URL = process.env.ZONE_KRIG_SMOKE_BASE_URL ?? "https://www.gpslob.dk";
const LOCAL_ENV_PATH = path.join(process.cwd(), ".env.local");

const QUESTIONS: SmokeQuestion[] = [
  {
    id: 1,
    type: "multiple_choice",
    text: "Smoke zone 1 korrekt capture",
    answers: ["Rigtig zone 1", "Forkert zone 1 A", "Forkert zone 1 B", "Forkert zone 1 C"],
    correctIndex: 0,
    points: 10,
    lat: 55.6761,
    lng: 12.5683,
    radius_m: 30,
  },
  {
    id: 2,
    type: "multiple_choice",
    text: "Smoke zone 2 forkert forsøg",
    answers: ["Rigtig zone 2", "Forkert zone 2 A", "Forkert zone 2 B", "Forkert zone 2 C"],
    correctIndex: 0,
    points: 10,
    lat: 55.6767,
    lng: 12.569,
    radius_m: 30,
  },
  {
    id: 3,
    type: "multiple_choice",
    text: "Smoke zone 3 modstander uden skjold",
    answers: ["Rigtig zone 3", "Forkert zone 3 A", "Forkert zone 3 B", "Forkert zone 3 C"],
    correctIndex: 0,
    points: 10,
    lat: 55.6755,
    lng: 12.5689,
    radius_m: 30,
  },
  {
    id: 4,
    type: "multiple_choice",
    text: "Smoke zone 4 modstander med skjold",
    answers: ["Rigtig zone 4", "Forkert zone 4 A", "Forkert zone 4 B", "Forkert zone 4 C"],
    correctIndex: 0,
    points: 10,
    lat: 55.6763,
    lng: 12.5674,
    radius_m: 30,
  },
  {
    id: 5,
    type: "multiple_choice",
    text: "Smoke zone 5 egen zone",
    answers: ["Rigtig zone 5", "Forkert zone 5 A", "Forkert zone 5 B", "Forkert zone 5 C"],
    correctIndex: 0,
    points: 10,
    lat: 55.6758,
    lng: 12.5678,
    radius_m: 30,
  },
];

test.describe.configure({ retries: 0 });

function loadLocalEnv() {
  if (!existsSync(LOCAL_ENV_PATH)) return;

  const envText = readFileSync(LOCAL_ENV_PATH, "utf8");
  for (const line of envText.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

function requireAdminClient() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  test.skip(!supabaseUrl || !serviceRoleKey, "Supabase admin env vars are required for production smoke setup.");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getTeacherId(admin: SupabaseClient) {
  const configuredTeacherId = process.env.ZONE_KRIG_SMOKE_TEACHER_ID?.trim();
  if (configuredTeacherId) return configuredTeacherId;

  const { data, error } = await admin
    .from("gps_runs")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1);

  if (error) throw error;

  const teacherId = typeof data?.[0]?.user_id === "string" ? data[0].user_id : "";
  expect(teacherId, "Could not infer teacher user_id for smoke run.").toBeTruthy();
  return teacherId;
}

async function createControlledZoneKrigSession(admin: SupabaseClient): Promise<SmokeSession> {
  const teacherId = await getTeacherId(admin);
  const runId = randomUUID();
  const sessionId = randomUUID();
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const nowIso = new Date().toISOString();
  const endsAtIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { error: runError } = await admin.from("gps_runs").insert({
    id: runId,
    user_id: teacherId,
    title: `Zone Krig production flow smoke ${nowIso}`,
    subject: "Produktionstest",
    description: "Kontrolleret Zone Krig smoke-test",
    topic: "Kontrolleret Zone Krig smoke-test",
    questions: QUESTIONS,
    race_type: "zone_krig",
    radius: 30,
    game_config: {},
    bonus_enabled: false,
  });
  if (runError) throw runError;

  const { error: sessionError } = await admin.from("live_sessions").insert({
    id: sessionId,
    run_id: runId,
    teacher_id: teacherId,
    pin,
    status: "running",
    gps_override: true,
    ends_at: endsAtIso,
  });
  if (sessionError) throw sessionError;

  return { runId, sessionId, pin };
}

async function waitForHydratedJoinForm(page: Page) {
  const pinInput = page.locator('input[inputmode="numeric"]');
  const nameInput = page.locator('input[placeholder="Dit navn"]');
  const submitButton = page.locator("form").locator('button[type="submit"]');

  await page.waitForLoadState("load");
  await expect(pinInput).toBeVisible({ timeout: 15_000 });
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await expect(submitButton).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(
    () => {
      const input = document.querySelector('input[placeholder="Dit navn"]');
      return input ? Object.keys(input).some((key) => key.startsWith("__reactProps$")) : false;
    },
    null,
    { timeout: 15_000 }
  );

  return { pinInput, nameInput, submitButton };
}

async function fillJoinForm(page: Page, pin: string, name: string) {
  const { pinInput, nameInput, submitButton } = await waitForHydratedJoinForm(page);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await pinInput.fill("");
    await pinInput.fill(pin);
    await nameInput.fill("");
    await nameInput.fill(name);

    try {
      await expect(pinInput).toHaveValue(pin, { timeout: 3_000 });
      await expect(nameInput).toHaveValue(name, { timeout: 3_000 });
      await expect(submitButton).toBeEnabled({ timeout: 3_000 });
      return submitButton;
    } catch {
      await expect(nameInput).toBeVisible({ timeout: 15_000 });
    }
  }

  await expect(submitButton).toBeEnabled({ timeout: 3_000 });
  return submitButton;
}

async function joinStudent(page: Page, session: SmokeSession) {
  const studentName = `P4-smoke-${String(Date.now()).slice(-6)}`;
  await page.goto(`${BASE_URL}/join?pin=${encodeURIComponent(session.pin)}`, { waitUntil: "domcontentloaded" });

  const submitButton = await fillJoinForm(page, session.pin, studentName);
  const joinResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/join") && response.request().method() === "POST",
    { timeout: 30_000 }
  );

  await Promise.all([
    page.waitForURL(new RegExp(`/play/${session.sessionId}(?:[/?#]|$)`), { timeout: 30_000 }),
    submitButton.click(),
  ]);

  const joinResponse = await joinResponsePromise;
  expect(joinResponse.ok(), "POST /api/join should succeed").toBe(true);

  const joinData = (await joinResponse.json()) as JoinResponse;
  expect(joinData.participantId, "Join response participantId").toBeTruthy();
  expect(joinData.teamId, "Join response teamId").toBeTruthy();
  return joinData;
}

async function waitForRows<T>(
  fetchRows: () => Promise<T[]>,
  predicate: (rows: T[]) => boolean,
  description: string
) {
  const deadline = Date.now() + 15_000;
  let lastRows: T[] = [];

  while (Date.now() < deadline) {
    lastRows = await fetchRows();
    if (predicate(lastRows)) return lastRows;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  expect(lastRows, description).toEqual(expect.anything());
  throw new Error(`Timed out waiting for ${description}`);
}

async function fetchZones(admin: SupabaseClient, sessionId: string) {
  const { data, error } = await admin
    .from("game_zones")
    .select("id,zone_index,owner_team_id,shield_until")
    .eq("session_id", sessionId)
    .order("zone_index");
  if (error) throw error;
  return (data ?? []) as GameZone[];
}

async function fetchTeams(admin: SupabaseClient, sessionId: string) {
  const { data, error } = await admin
    .from("game_teams")
    .select("id,team_name,color")
    .eq("session_id", sessionId)
    .order("team_name");
  if (error) throw error;
  return (data ?? []) as GameTeam[];
}

async function setControlledZoneOwnership(
  admin: SupabaseClient,
  sessionId: string,
  myTeamId: string
) {
  const teams = await waitForRows(
    () => fetchTeams(admin, sessionId),
    (rows) => rows.length >= 2,
    "Zone Krig auto-balanced teams"
  );
  const opponent = teams.find((team) => team.id !== myTeamId);
  expect(opponent, "Opponent team should exist").toBeTruthy();

  await waitForRows(
    () => fetchZones(admin, sessionId),
    (rows) => rows.length === QUESTIONS.length,
    "initialized Zone Krig zones"
  );

  const shieldUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  const updates = [
    { zoneIndex: 2, ownerTeamId: opponent?.id ?? null, shieldUntil: null },
    { zoneIndex: 3, ownerTeamId: opponent?.id ?? null, shieldUntil },
    { zoneIndex: 4, ownerTeamId: myTeamId, shieldUntil: null },
  ];

  for (const update of updates) {
    const { error } = await admin
      .from("game_zones")
      .update({
        owner_team_id: update.ownerTeamId,
        shield_until: update.shieldUntil,
      })
      .eq("session_id", sessionId)
      .eq("zone_index", update.zoneIndex);

    if (error) throw error;
  }

  return { teams, opponent: opponent as GameTeam, shieldUntil };
}

async function selectZone(page: Page, zoneNumber: number) {
  await page.getByRole("button", { name: new RegExp(`Zone ${zoneNumber}\\b`, "i") }).click();
  await expect(page.getByRole("heading", { name: `Zone ${zoneNumber}` })).toBeVisible({ timeout: 10_000 });
}

async function openSelectedZoneQuestion(page: Page) {
  const openButton = page.getByRole("button", { name: /Åbn zone-spørgsmål/i });
  await expect(openButton).toBeEnabled({ timeout: 10_000 });
  await openButton.click();
}

async function answerVisibleQuestion(page: Page, answerLabel: string) {
  const submitResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/play/submit-answer") && response.request().method() === "POST",
    { timeout: 30_000 }
  );
  await page.getByRole("button", { name: answerLabel }).click();
  const response = await submitResponsePromise;
  expect(response.ok(), "POST /api/play/submit-answer should succeed").toBe(true);
  return response.json() as Promise<{
    inserted?: boolean;
    awardedPoints?: number;
    zoneKrigCapture?: { status?: string };
  }>;
}

async function answerVisibleQuestionWithImmediateFeedback(page: Page, answerLabel: string) {
  const submitResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/play/submit-answer") && response.request().method() === "POST",
    { timeout: 30_000 }
  );
  const answerButton = page.getByRole("button", { name: answerLabel });
  await answerButton.click();
  await expect(answerButton).toBeDisabled({ timeout: 2_000 });

  const response = await submitResponsePromise;
  expect(response.ok(), "POST /api/play/submit-answer should succeed").toBe(true);
  return response.json() as Promise<{
    inserted?: boolean;
    awardedPoints?: number;
    zoneKrigCapture?: { status?: string };
  }>;
}

async function expectAttemptUsedState(page: Page) {
  await expect(
    page.getByText("Dit forsøg på denne zone er brugt. En anden spiller på holdet kan angribe en zone senere.").first()
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Forsøg brugt/i })).toBeDisabled();
}

async function fetchAnswerCount(admin: SupabaseClient, sessionId: string, participantId: string, questionIndex: number) {
  const { count, error } = await admin
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .eq("question_index", questionIndex);

  if (error) throw error;
  return count ?? 0;
}

test("Zone Krig production flow covers capture, used attempts and zone ownership text", async ({ context, page }) => {
  test.setTimeout(120_000);
  const admin = requireAdminClient();
  const session = await createControlledZoneKrigSession(admin);
  await context.grantPermissions(["geolocation"], { origin: BASE_URL });
  await context.setGeolocation({ latitude: QUESTIONS[0].lat, longitude: QUESTIONS[0].lng, accuracy: 5 });

  const joinData = await joinStudent(page, session);
  const { opponent } = await setControlledZoneOwnership(admin, session.sessionId, joinData.teamId);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Zone Krig")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Neutral zone. Svar korrekt for at overtage den.")).toBeVisible({ timeout: 30_000 });

  await openSelectedZoneQuestion(page);
  await expect(page.getByText(QUESTIONS[0].text)).toBeVisible({ timeout: 10_000 });

  const correctBody = await answerVisibleQuestion(page, "Rigtig zone 1");
  expect(correctBody.inserted, "Correct answer should be persisted").toBe(true);
  expect(correctBody.zoneKrigCapture?.status, "Correct answer should capture neutral zone").toBe("captured");
  await expect(page.getByText("Fantastisk! I har erobret zonen!")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Tilbage til kortet/i }).click();

  await expect(page.getByRole("button", { name: /Zone 1\s+Din zone/i })).toBeVisible({ timeout: 10_000 });
  await expectAttemptUsedState(page);

  const zoneOne = (await fetchZones(admin, session.sessionId)).find((zone) => zone.zone_index === 0);
  expect(zoneOne?.owner_team_id, "game_zones owner should match teacher/live data source").toBe(joinData.teamId);

  await selectZone(page, 2);
  await expect(page.getByText("Neutral zone. Svar korrekt for at overtage den.")).toBeVisible({ timeout: 10_000 });
  await openSelectedZoneQuestion(page);
  await expect(page.getByText(QUESTIONS[1].text)).toBeVisible({ timeout: 10_000 });

  const wrongBody = await answerVisibleQuestionWithImmediateFeedback(page, "Forkert zone 2 A");
  expect(wrongBody.inserted, "Wrong answer should be persisted").toBe(true);
  expect(wrongBody.awardedPoints, "Wrong answer should award zero points").toBe(0);
  await expectAttemptUsedState(page);

  const wrongAnswerCount = await fetchAnswerCount(admin, session.sessionId, joinData.participantId, 1);
  expect(wrongAnswerCount, "Wrong attempt should be saved in answers").toBe(1);
  const zoneTwo = (await fetchZones(admin, session.sessionId)).find((zone) => zone.zone_index === 1);
  expect(zoneTwo?.owner_team_id, "Wrong answer should not capture zone").toBeNull();

  await selectZone(page, 1);
  await expectAttemptUsedState(page);

  await selectZone(page, 3);
  await expect(
    page.getByText(`Zonen ejes af ${opponent.team_name}. Svar korrekt for at overtage den.`)
  ).toBeVisible({ timeout: 10_000 });

  await selectZone(page, 4);
  await expect(page.getByText(new RegExp(`Zonen ejes af ${opponent.team_name} og er beskyttet i \\d{2}:\\d{2}\\.`))).toBeVisible({
    timeout: 10_000,
  });

  await selectZone(page, 5);
  await expect(page.getByText("I ejer denne zone.")).toBeVisible({ timeout: 10_000 });
});
