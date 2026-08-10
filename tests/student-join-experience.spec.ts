import { expect, test, type Page } from "@playwright/test";

import {
  extractJoinCodeFromQr,
  normalizeJoinCode,
  resolveSafeJoinQrTarget,
} from "@/lib/join/studentJoin";

test.use({ serviceWorkers: "block" });
test.describe.configure({ mode: "serial" });
test.setTimeout(45_000);

const CODE = "ABC123";
const STUDENT_NAME = "Hold Grøn";
const INVALID_COPY = "Den kode virker ikke. Tjek koden, og prøv igen.";
const FINISHED_COPY =
  "Løbet er slut. Få en ny kode af din lærer, hvis du skal deltage i et andet løb.";
const NETWORK_COPY =
  "Vi mistede forbindelsen. Tjek nettet, og prøv igen.";

type RaceType = "quiz" | "zone_krig" | "stratego";

type JoinObservation = {
  lookupCodes: Array<string | null>;
  registrations: Array<Record<string, unknown>>;
};

async function mockTelemetry(page: Page) {
  await page.route("**/api/telemetry**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
}

async function mockActiveJoin(
  page: Page,
  options: {
    raceType: RaceType;
    sessionId: string;
    runTitle: string;
    startOffset?: number;
  },
) {
  const observation: JoinObservation = {
    lookupCodes: [],
    registrations: [],
  };

  await mockTelemetry(page);
  await page.route("**/api/join**", async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      observation.lookupCodes.push(
        request.headers()["x-student-join-code"] ?? null,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "active",
          sessionId: options.sessionId,
          sessionStatus: "running",
          runTitle: options.runTitle,
          schedule: null,
          scheduleGate: "active",
          raceType: options.raceType,
        }),
      });
      return;
    }

    if (request.method() === "POST") {
      const registration = request.postDataJSON() as Record<string, unknown>;
      observation.registrations.push(registration);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          participantId: `participant-${options.sessionId}`,
          sessionId: options.sessionId,
          studentName: registration.studentName,
          sessionStatus: "running",
          teamId: null,
          teamName: null,
          teamColor: null,
          startOffset: options.startOffset ?? 0,
        }),
      });
      return;
    }

    await route.abort();
  });

  return observation;
}

async function openJoinStart(page: Page) {
  await page.goto("/join");
  await expect(
    page.getByRole("heading", { name: "Deltag i et løb", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "Deltag i et løb", exact: true }),
  ).toBeVisible();
}

async function openJoin(page: Page) {
  await openJoinStart(page);
  await page.getByRole("button", { name: "Deltag i et løb", exact: true }).click();
  const codeInput = page.getByLabel("Kode fra din lærer", { exact: true });
  await expect(codeInput).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const input = document.querySelector("#join-code");
    return (
      input !== null &&
      Object.keys(input).some((key) => key.startsWith("__reactProps$"))
    );
  });
  await expect(codeInput).toHaveAttribute("id", "join-code");
  await expect(
    page.getByRole("button", { name: "Fortsæt", exact: true }),
  ).toBeVisible();
  return codeInput;
}

async function submitCodeAndName(
  page: Page,
  options: {
    code?: string;
    name?: string;
    runTitle: string;
    submitCodeWithEnter?: boolean;
  },
) {
  const codeInput = page.getByLabel("Kode fra din lærer", { exact: true });
  await codeInput.fill(options.code ?? CODE);

  if (options.submitCodeWithEnter ?? true) {
    await codeInput.press("Enter");
  } else {
    await page
      .getByRole("button", { name: "Fortsæt", exact: true })
      .click();
  }

  const nameInput = page.getByLabel("Dit navn eller holdnavn", {
    exact: true,
  });
  await expect(nameInput).toBeVisible();
  await expect(nameInput).toHaveAttribute("id", "join-name");
  await expect(
    page.getByText(options.runTitle, { exact: true }).first(),
  ).toBeVisible();

  await nameInput.fill(options.name ?? STUDENT_NAME);
  await nameInput.press("Enter");
}

test.describe("join-code helpers", () => {
  test("normalizes lowercase, spaces, hyphens and empty values", () => {
    expect(normalizeJoinCode("abc123")).toBe("ABC123");
    expect(normalizeJoinCode(" ab-cd ef ")).toBe("ABCDEF");
    expect(normalizeJoinCode("")).toBe("");
    expect(normalizeJoinCode(null)).toBe("");
  });

  test("extracts only complete direct or trusted SkoleGPS join codes", () => {
    expect(extractJoinCodeFromQr(" ab-cd ef ")).toBe("ABCDEF");
    expect(
      extractJoinCodeFromQr(
        "https://skolegps.dk/join?pin=ab-cd-ef",
      ),
    ).toBe("ABCDEF");
    expect(
      extractJoinCodeFromQr(
        "/join?pin=ABC123",
        "http://localhost:3000",
      ),
    ).toBe("ABC123");

    expect(
      extractJoinCodeFromQr("https://example.com/join?pin=ABC123"),
    ).toBeNull();
    expect(
      extractJoinCodeFromQr("https://skolegps.dk/play/ABC123"),
    ).toBeNull();
    expect(extractJoinCodeFromQr("ABC12")).toBeNull();
    expect(extractJoinCodeFromQr("ABC1234")).toBeNull();
    expect(extractJoinCodeFromQr("ABC12!")).toBeNull();
    expect(extractJoinCodeFromQr("")).toBeNull();
    expect(
      resolveSafeJoinQrTarget(
        "https://skolegps.dk/find-bedrageren/join",
      ),
    ).toEqual({
      kind: "internal-route",
      href: "/find-bedrageren/join",
    });
  });
});

test.describe("/join browser experience", () => {
  test("fits 320, 375, 600 and desktop widths without student video", async ({
    page,
  }) => {
    for (const width of [320, 375, 600, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await openJoinStart(page);

      await expect(
        page.getByRole("button", { name: "Deltag i et løb", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Scan QR-kode", exact: true }),
      ).toBeVisible();
      await expect(page.locator("video")).toHaveCount(0);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasHorizontalOverflow, `horizontal overflow at ${width}px`).toBe(
        false,
      );
    }
  });

  test("rejects an empty code and opens the troubleshooting disclosure", async ({
    page,
  }) => {
    await openJoin(page);

    await page
      .getByRole("button", { name: "Fortsæt", exact: true })
      .click();
    await expect(page.locator("#join-error")).toHaveText(
      "Skriv koden på 6 tegn fra din lærer.",
    );

    const troubleshooting = page.locator("details").filter({
      hasText: "Problemer med at deltage?",
    });
    await expect(troubleshooting).not.toHaveAttribute("open", "");
    await troubleshooting
      .getByText("Problemer med at deltage?", { exact: true })
      .click();
    await expect(troubleshooting).toHaveAttribute("open", "");
    await expect(
      troubleshooting.getByText(
        "Kontrollér, at koden er skrevet korrekt.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("shows the exact invalid-code copy for a 404 lookup", async ({
    page,
  }) => {
    await mockTelemetry(page);
    await page.route("**/api/join**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ kind: "invalid" }),
      });
    });

    const codeInput = await openJoin(page);
    await codeInput.fill(CODE);
    await codeInput.press("Enter");

    await expect(page.locator("#join-error")).toHaveText(INVALID_COPY);
  });

  test("shows the exact finished-session copy", async ({ page }) => {
    await mockTelemetry(page);
    await page.route("**/api/join**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "finished",
          runTitle: "Afsluttet testløb",
          schedule: null,
          scheduleGate: "expired",
        }),
      });
    });

    const codeInput = await openJoin(page);
    await codeInput.fill(CODE);
    await codeInput.press("Enter");

    await expect(
      page.getByText(FINISHED_COPY, { exact: true }),
    ).toBeVisible();
  });

  test("shows the exact not-open copy for a scheduled run", async ({
    page,
  }) => {
    await mockTelemetry(page);
    await page.route("**/api/join**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "active",
          sessionId: "scheduled-session",
          sessionStatus: "waiting",
          runTitle: "Morgendagens løb",
          schedule: null,
          scheduleGate: "scheduled",
          raceType: "quiz",
        }),
      });
    });

    const codeInput = await openJoin(page);
    await codeInput.fill(CODE);
    await codeInput.press("Enter");

    await expect(page.locator("#join-error")).toHaveText(
      "Løbet er ikke åbnet endnu. Spørg din lærer.",
    );
  });

  test("asks only for a name after the code has been accepted", async ({
    page,
  }) => {
    const runTitle = "Navnetest";
    await mockActiveJoin(page, {
      raceType: "quiz",
      sessionId: "name-required-session",
      runTitle,
    });
    await openJoin(page);

    const codeInput = page.getByLabel("Kode fra din lærer", { exact: true });
    await codeInput.fill(CODE);
    await codeInput.press("Enter");
    const nameInput = page.getByLabel("Dit navn eller holdnavn", {
      exact: true,
    });
    await expect(nameInput).toBeVisible();
    await nameInput.press("Enter");

    await expect(page.locator("#join-error")).toHaveText(
      "Skriv dit navn eller holdnavn.",
    );
  });

  test("shows the exact network copy without technical details", async ({
    page,
  }) => {
    await mockTelemetry(page);
    await page.route("**/api/join**", async (route) => {
      await route.abort("failed");
    });

    const codeInput = await openJoin(page);
    await codeInput.fill(CODE);
    await codeInput.press("Enter");

    await expect(page.locator("#join-error")).toHaveText(NETWORK_COPY);
  });

  test("uses both Enter submissions and replace-navigation for an ordinary run", async ({
    page,
  }) => {
    const sessionId = "ordinary-join-session";
    const runTitle = "Skovens poster";
    const observation = await mockActiveJoin(page, {
      raceType: "quiz",
      sessionId,
      runTitle,
    });

    await page.route("**/student-join-history-sentinel", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>join history sentinel</title>",
      });
    });
    await page.goto("/student-join-history-sentinel");
    await openJoin(page);

    await submitCodeAndName(page, {
      code: "ab-c1 23",
      runTitle,
    });

    await page.waitForURL(`**/play/${sessionId}`, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(`/play/${sessionId}`);
    expect(new URL(page.url()).search).toBe("");
    expect(observation.lookupCodes).toEqual([CODE, CODE]);
    expect(observation.registrations[0]).toEqual({
      sessionId,
      studentName: STUDENT_NAME,
    });

    await page.goBack();
    await expect(page).toHaveURL(/\/student-join-history-sentinel$/);
  });

  for (const raceType of [
    "zone_krig",
    "stratego",
  ] as const) {
    test(`${raceType} keeps the standard /play/:session join route`, async ({
      page,
    }) => {
      const sessionId = `${raceType}-join-session`;
      const runTitle = `${raceType} testløb`;
      await mockActiveJoin(page, {
        raceType,
        sessionId,
        runTitle,
      });
      await openJoin(page);

      await submitCodeAndName(page, { runTitle });

      await page.waitForURL(`**/play/${sessionId}`, { timeout: 30_000 });
      expect(new URL(page.url()).pathname).toBe(`/play/${sessionId}`);
    });
  }

  test("a recent stored participant resumes through the server-validated play route", async ({
    page,
  }) => {
    const sessionId = "stored-resume-session";
    let joinLookupCount = 0;

    await page.addInitScript(
      ({ storageKey, storedParticipant }) => {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(storedParticipant),
        );
      },
      {
        storageKey: "gpslob_active_participant",
        storedParticipant: {
          participantId: "stored-participant",
          sessionId,
          studentName: "Gemt hold",
          startOffset: 2,
          savedAt: new Date().toISOString(),
          sessionStatus: "running",
        },
      },
    );
    await mockTelemetry(page);
    await page.route("**/api/join**", async (route) => {
      joinLookupCount += 1;
      await route.abort();
    });

    await page.goto("/join");
    await expect(
      page.getByRole("heading", {
        name: "Du har allerede et løb i gang",
        exact: true,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/join$/);
    await page
      .getByRole("button", { name: "Fortsæt løbet", exact: true })
      .click();
    await page.waitForURL(`**/play/${sessionId}`, { timeout: 30_000 });

    expect(new URL(page.url()).pathname).toBe(`/play/${sessionId}`);
    expect(joinLookupCount).toBe(0);
  });

  test("an explicit new pin overrides an old participant and saves the server offset", async ({
    page,
  }) => {
    const sessionId = "new-join-session";
    const runTitle = "Det nye løb";
    const serverStartOffset = 4;

    await page.addInitScript(
      ({ storageKey, storedParticipant }) => {
        try {
          if (window.sessionStorage.getItem("student-join-seeded")) return;
          window.sessionStorage.setItem("student-join-seeded", "1");
          window.localStorage.setItem(
            storageKey,
            JSON.stringify(storedParticipant),
          );
        } catch {
          // about:blank has no usable localStorage; the script runs again on /join.
        }
      },
      {
        storageKey: "gpslob_active_participant",
        storedParticipant: {
          participantId: "old-participant",
          sessionId: "old-session",
          studentName: "Gammelt hold",
          startOffset: 1,
          savedAt: new Date().toISOString(),
          sessionStatus: "running",
        },
      },
    );

    const observation = await mockActiveJoin(page, {
      raceType: "quiz",
      sessionId,
      runTitle,
      startOffset: serverStartOffset,
    });

    await page.goto(`/join?pin=${CODE}`);

    const nameInput = page.getByLabel("Dit navn eller holdnavn", {
      exact: true,
    });
    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    await expect(nameInput).toHaveAttribute("id", "join-name");
    await expect(page.getByText(runTitle, { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/join$/);

    await nameInput.fill(STUDENT_NAME);
    await nameInput.press("Enter");
    await page.waitForURL(`**/play/${sessionId}`, { timeout: 30_000 });

    const storedParticipant = await page.evaluate(() => {
      const raw = window.localStorage.getItem("gpslob_active_participant");
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    });

    expect(observation.lookupCodes).toEqual([CODE, CODE]);
    expect(storedParticipant).toMatchObject({
      participantId: `participant-${sessionId}`,
      sessionId,
      studentName: STUDENT_NAME,
      startOffset: serverStartOffset,
    });
  });
});
