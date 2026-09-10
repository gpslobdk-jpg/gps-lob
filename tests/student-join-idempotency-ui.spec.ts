import { expect, test, type Page, type Route } from "@playwright/test";

import { PENDING_JOIN_ATTEMPT_STORAGE_KEY } from "@/lib/join/pendingJoinAttempt";

const SESSION_ID = "join-idempotency-session";
const CODE = "ABC123";

const activeLookup = {
  kind: "active",
  sessionId: SESSION_ID,
  sessionStatus: "running",
  runTitle: "Skovløbet",
  schedule: null,
  scheduleGate: "active",
  raceType: "quiz",
};

type RegistrationBody = {
  sessionId?: unknown;
  studentName?: unknown;
  participantId?: unknown;
};

test.use({ serviceWorkers: "block" });
test.describe.configure({ mode: "serial" });
test.setTimeout(45_000);

async function preparePage(page: Page) {
  await page.route("**/api/telemetry**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.context().route(
    /supabase.*realtime|realtime\/v1\/websocket/i,
    async (route: Route) => route.abort("connectionrefused")
  );
}

async function openNameStep(page: Page) {
  await preparePage(page);
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Deltag i et løb", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Deltag i et løb", exact: true }).click();
  await page.locator("#join-code").fill(CODE);
  await page.locator("#join-code").press("Enter");
  await expect(page.locator("#join-name")).toBeVisible();
}

test("en usikker join-retry genbruger samme participantId og opretter ikke et nyt handoff", async ({ page }) => {
  const registrations: RegistrationBody[] = [];

  await page.route("**/api/join**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeLookup),
      });
      return;
    }

    const body = JSON.parse(route.request().postData() ?? "{}") as RegistrationBody;
    registrations.push(body);

    if (registrations.length === 1) {
      // The first response is lost after the browser has sent the attempted
      // registration. The client must retain this exact attempt identity.
      await route.abort("failed");
      return;
    }

    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Tilmeldingen skal afklares på den samme browser.",
      }),
    });
  });

  await openNameStep(page);
  await page.locator("#join-name").fill("Hold Grøn");
  await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());

  await expect(page.locator("#join-error")).toContainText("Tjek nettet");
  await expect.poll(() => registrations.length).toBe(1);

  await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => registrations.length).toBe(2);
  await expect(page.locator("#join-error")).toContainText(
    "Tilmeldingen skal afklares på den samme browser."
  );

  const [first, second] = registrations;
  expect(first).toMatchObject({ sessionId: SESSION_ID, studentName: "Hold Grøn" });
  expect(second).toMatchObject({ sessionId: SESSION_ID, studentName: "Hold Grøn" });
  expect(first.participantId).toEqual(second.participantId);
  expect(first.participantId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );

  const storage = await page.evaluate((pendingKey) => ({
    pending: window.localStorage.getItem(pendingKey),
    handoff: window.localStorage.getItem("gpslob_active_participant"),
  }), PENDING_JOIN_ATTEMPT_STORAGE_KEY);
  expect(JSON.parse(storage.pending ?? "null")).toMatchObject({ participantId: first.participantId });
  expect(storage.handoff).toBeNull();
  await expect(page).toHaveURL(/\/join$/);
});
