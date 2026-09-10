import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION_ID = "teacher-roster-session-00000000-0000-0000-000000000001";
const RUN_ID = "teacher-roster-run-00000000-0000-0000-000000000001";
const TEACHER_ID = "teacher-roster-00000000-0000-0000-000000000001";

type ParticipantRow = {
  id: string;
  session_id: string;
  student_name: string;
  lat: number | null;
  lng: number | null;
  updated_at: string;
  last_updated: string;
  run_started_at: null;
  finished_at: null;
  start_offset: number;
};

function authCookie() {
  const payload = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 36_000,
    expires_at: Math.floor(Date.now() / 1_000) + 36_000,
    refresh_token: "mock-refresh-token",
    user: {
      id: TEACHER_ID,
      email: "teacher-roster@test.invalid",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Roster Testlærer" },
      created_at: "2026-09-10T10:00:00.000Z",
    },
  };

  return `base64-${Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "")}`;
}

function tableFromUrl(url: string) {
  return url.match(/\/rest\/v1\/([a-z_]+)/u)?.[1] ?? null;
}

async function mockTeacherLivePage(
  page: Page,
  getParticipants: () => ParticipantRow[],
  options: { sessionStatus?: "waiting" | "running" } = {}
) {
  const sessionCookie = authCookie();
  const browserOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").origin;
  await page.context().addCookies(
    [
      "sb-xodrzahqdgbsssntupjt-auth-token.0",
      // Enables the same synthetic browser test against the isolated local
      // Supabase stub used in CI-free QA. Production keeps the project-ref key.
      "sb-localhost-auth-token.0",
    ].map((name) => ({
      name,
      value: sessionCookie,
      url: browserOrigin,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    }))
  );

  await page.context().route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();
    const user = {
      id: TEACHER_ID,
      email: "teacher-roster@test.invalid",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Roster Testlærer" },
      created_at: "2026-09-10T10:00:00.000Z",
    };

    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 36_000,
          refresh_token: "mock-refresh-token",
          user,
        }),
      });
      return;
    }

    if (url.includes("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // The test deliberately has no working realtime transport. It proves the
  // visible-page recovery path reads `participants`, not session_students.
  await page.context().route("**/realtime/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });

  await page.route("**/api/dashboard/live/theme**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.context().route("**/rest/v1/**", async (route: Route) => {
    switch (tableFromUrl(route.request().url())) {
      case "live_sessions":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: SESSION_ID,
            run_id: RUN_ID,
            pin: "123456",
            status: options.sessionStatus ?? "waiting",
            gps_override: false,
          }),
        });
        return;
      case "gps_runs":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: RUN_ID, questions: [], race_type: "manuel" }),
        });
        return;
      case "session_students":
        // This must stay empty for the entire test. A participants-only join
        // must still become visible to the teacher.
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return;
      case "participants":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(getParticipants()),
        });
        return;
      case "session_messages":
      case "answers":
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        return;
      default:
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
  });
}

test.use({ serviceWorkers: "block" });
test.describe.configure({ mode: "serial" });
test.setTimeout(45_000);

test("lærerlobbyen genhenter participants uden session_students og bevarer hold med samme navn", async ({ page }) => {
  let participants: ParticipantRow[] = [];
  await mockTeacherLivePage(page, () => participants);

  await page.goto(`/dashboard/live/${SESSION_ID}`);
  await expect(page.getByRole("heading", { name: "DELTAGERE KLAR: 0", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const timestamp = new Date().toISOString();
  participants = [
    {
      id: "participant-blue-a",
      session_id: SESSION_ID,
      student_name: "Hold Blå",
      lat: null,
      lng: null,
      updated_at: timestamp,
      last_updated: timestamp,
      run_started_at: null,
      finished_at: null,
      start_offset: 0,
    },
    {
      id: "participant-blue-b",
      session_id: SESSION_ID,
      student_name: "Hold Blå",
      lat: null,
      lng: null,
      updated_at: timestamp,
      last_updated: timestamp,
      run_started_at: null,
      finished_at: null,
      start_offset: 0,
    },
  ];

  // This is the same recovery trigger used after a real connection returns.
  // The hook waits briefly before an authoritative refresh, so the acceptance
  // budget deliberately matches Phase 2's <=10-second degraded-path target.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect(page.getByRole("heading", { name: "DELTAGERE KLAR: 2", exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Hold Blå", { exact: true })).toHaveCount(2);
});

test("Fjern hold er tastaturbetjent, bekræftes og bliver stående ved serverfejl", async ({ page }) => {
  const timestamp = new Date().toISOString();
  let participants: ParticipantRow[] = [
    {
      id: "participant-remove-blue",
      session_id: SESSION_ID,
      student_name: "Hold Blå",
      lat: null,
      lng: null,
      updated_at: timestamp,
      last_updated: timestamp,
      run_started_at: null,
      finished_at: null,
      start_offset: 0,
    },
  ];
  let shouldFailRemoval = true;

  await mockTeacherLivePage(page, () => participants, { sessionStatus: "running" });
  await page.route("**/api/dashboard/live/participants/remove", async (route) => {
    if (shouldFailRemoval) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Holdet kunne ikke fjernes. Prøv igen." }),
      });
      return;
    }

    participants = [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ removed: true, participantId: "participant-remove-blue" }),
    });
  });

  await page.goto(`/dashboard/live/${SESSION_ID}`);
  const leaderboardButton = page.getByRole("button", { name: "Leaderboard", exact: true });
  await expect(leaderboardButton).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Luk QR-kode", exact: true }).click();

  await leaderboardButton.click();
  await expect(page.getByRole("heading", { name: "Leaderboard", exact: true })).toBeVisible();

  const actions = page.getByRole("button", { name: "Handlinger for Hold Blå", exact: true });
  await actions.focus();
  await page.keyboard.press("Enter");
  await expect(actions).toHaveAttribute("aria-expanded", "true");

  const menuItem = page.getByRole("menuitem", { name: "Fjern hold", exact: true });
  await menuItem.focus();
  await page.keyboard.press("Escape");
  await expect(menuItem).toBeHidden();

  await actions.click();
  await menuItem.click();
  const dialog = page.getByRole("dialog", { name: "Fjern hold", exact: true });
  await expect(dialog).toContainText(
    "Fjern “Hold Blå” fra løbet? Holdet kan ikke fortsætte. De andre hold fortsætter som før."
  );

  await dialog.getByRole("button", { name: "Fjern hold", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveText("Holdet kunne ikke fjernes. Prøv igen.");

  shouldFailRemoval = false;
  await dialog.getByRole("button", { name: "Fjern hold", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Hold Blå", { exact: true })).toHaveCount(0);
});
