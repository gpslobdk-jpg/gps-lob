import { expect, test, type Page, type Route } from "@playwright/test";

test.use({
  serviceWorkers: "block",
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test.describe.configure({ mode: "serial" });
test.setTimeout(45_000);

const CODE = "ABC123";
const SESSION_ID = "join-v2-session";

const activeLookup = {
  kind: "active",
  sessionId: SESSION_ID,
  sessionStatus: "running",
  runTitle: "Skovløbet",
  schedule: null,
  scheduleGate: "active",
  raceType: "quiz",
};

async function preparePage(page: Page) {
  await page.route("**/api/telemetry**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.context().route(
    /supabase.*realtime|realtime\/v1\/websocket/i,
    async (route: Route) => route.abort("connectionrefused"),
  );
  await page.context().grantPermissions(["camera"], {
    origin: "http://localhost:3000",
  });
}

async function openStart(page: Page, path = "/join") {
  await preparePage(page);
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Deltag i et løb", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
}

async function openCode(page: Page) {
  await openStart(page);
  await page
    .getByRole("button", { name: "Deltag i et løb", exact: true })
    .click();
  await expect(page.locator("#join-code")).toBeFocused();
}

async function mockActiveLookup(page: Page) {
  await page.route("**/api/join**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(activeLookup),
    });
  });
}

test.describe("Elevoplevelsen 2.0 /join UI", () => {
  test("1. startskærmen viser de to tydelige valg", async ({ page }) => {
    await openStart(page);
    await expect(
      page.getByRole("button", { name: "Deltag i et løb", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Scan QR-kode", exact: true }),
    ).toBeVisible();
  });

  test("2. kodehandlingen åbner og fokuserer det robuste kodefelt", async ({ page }) => {
    await openCode(page);
    await expect(page.locator("#join-code")).toHaveCount(1);
    await expect(page.locator("#join-name")).toBeHidden();
  });

  test("3. QR-handlingen åbner scannerflowet med ét tryk", async ({ page }) => {
    await openStart(page);
    await page.getByRole("button", { name: "Scan QR-kode", exact: true }).click();
    await expect(page.getByTestId("join-qr-dialog")).toBeVisible();
    await expect(page.getByText("Starter kamera...", { exact: true })).toBeVisible();
    await page.getByTestId("join-qr-close").click();
  });

  test("4. QR-dialogen styrer fokus, scroll, Escape og fokusretur", async ({ page }) => {
    await openStart(page);
    const trigger = page.getByRole("button", { name: "Scan QR-kode", exact: true });
    await trigger.click();
    await expect(page.getByTestId("join-qr-close")).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("join-qr-dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("5. gyldig kode fører til det separate navnetrin", async ({ page }) => {
    await mockActiveLookup(page);
    await openCode(page);
    await page.locator("#join-code").fill(CODE);
    await page.locator("#join-code").press("Enter");
    await expect(
      page.getByRole("heading", { name: "Hvad skal vi kalde dig?", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#join-name")).toBeFocused();
  });

  test("6. ugyldig kode giver en kort elevvenlig fejl", async ({ page }) => {
    await page.route("**/api/join**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ kind: "invalid" }),
      });
    });
    await openCode(page);
    await page.locator("#join-code").fill(CODE);
    await page.locator("#join-code").press("Enter");
    await expect(page.locator("#join-error")).toHaveText(
      "Den kode virker ikke. Tjek koden, og prøv igen.",
    );
  });

  test("7. expired=1 forklarer hvad eleven skal gøre", async ({ page }) => {
    await openStart(page, "/join?expired=1");
    await expect(page.getByText("Linket kan ikke bruges længere", { exact: true })).toBeVisible();
    await expect(page.getByText(/Få en ny kode af din lærer/)).toBeVisible();
  });

  test("8. missingSession=1 viser et klart næste skridt", async ({ page }) => {
    await openStart(page, "/join?missingSession=1");
    await expect(page.getByText("Løb ikke fundet", { exact: true })).toBeVisible();
    await expect(page.getByText(/Åbn et nyt link, eller skriv koden/)).toBeVisible();
  });

  test("9. netværksfejl bevarer koden og kan prøves igen", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/join**", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeLookup),
      });
    });
    await openCode(page);
    await page.locator("#join-code").fill(CODE);
    await page.locator("#join-code").press("Enter");
    await expect(page.locator("#join-error")).toContainText("Tjek nettet");
    await expect(page.locator("#join-code")).toHaveValue(CODE);
    await page.getByRole("button", { name: "Fortsæt", exact: true }).click();
    await expect(page.locator("#join-name")).toBeVisible();
  });

  test("10. dobbelt navnesubmit opretter kun én deltager", async ({ page }) => {
    let registrations = 0;
    await page.route("**/api/join**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(activeLookup),
        });
        return;
      }

      registrations += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          participantId: "participant-one",
          sessionId: SESSION_ID,
          studentName: "Hold Grøn",
          sessionStatus: "running",
          startOffset: 0,
        }),
      });
    });
    await openCode(page);
    await page.locator("#join-code").fill(CODE);
    await page.locator("#join-code").press("Enter");
    await page.locator("#join-name").fill("Hold Grøn");
    await page.locator("form").evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect.poll(() => registrations).toBe(1);
  });

  test("11. et nyligt løb vises som en tydelig Fortsæt-handling", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("gpslob_active_participant", JSON.stringify({
        participantId: "saved-participant",
        sessionId: "saved-session",
        studentName: "Gemt hold",
        startOffset: 0,
        savedAt: new Date().toISOString(),
        sessionStatus: "running",
      }));
    });
    await openStart(page);
    await expect(
      page.getByRole("button", { name: "Fortsæt løbet", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/join$/);
  });

  test("12. en eksplicit ny kode overstyrer gammel lokal state", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("gpslob_active_participant", JSON.stringify({
        participantId: "old-participant",
        sessionId: "old-session",
        studentName: "Gammelt hold",
        startOffset: 0,
        savedAt: new Date().toISOString(),
        sessionStatus: "running",
      }));
    });
    await mockActiveLookup(page);
    await preparePage(page);
    await page.goto(`/join?pin=${CODE}`);
    await expect(page.locator("#join-name")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("join-resume-card")).toBeHidden();
    await expect(page).toHaveURL(/\/join$/);
  });

  test("13. reduced motion slår den dekorative bevægelse fra", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openStart(page);
    const animationName = await page.locator(".join-map-dot").first().evaluate(
      (element) => getComputedStyle(element).animationName,
    );
    expect(animationName).toBe("none");
  });

  test("14. 320px har ingen vandret overflow og begge valg er synlige", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openStart(page);
    await expect(
      page.getByRole("button", { name: "Deltag i et løb", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Scan QR-kode", exact: true }),
    ).toBeInViewport();
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )).toBe(false);
  });

  test("15. tastaturfokus følger startvalg og kodefelt", async ({ page }) => {
    await openStart(page);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Deltag i et løb", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Scan QR-kode", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#join-code")).toBeFocused();
  });

  test("gammel lokal state over seks timer vises ikke som resume", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("gpslob_active_participant", JSON.stringify({
        participantId: "stale-participant",
        sessionId: "stale-session",
        studentName: "Gammelt hold",
        startOffset: 0,
        savedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        sessionStatus: "running",
      }));
    });
    await openStart(page);
    await expect(page.getByTestId("join-resume-card")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Deltag i et løb", exact: true }),
    ).toBeVisible();
  });
});
