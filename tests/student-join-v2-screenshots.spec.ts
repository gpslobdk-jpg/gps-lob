import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test.use({
  serviceWorkers: "block",
  viewport: { width: 390, height: 844 },
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test.describe.configure({ mode: "serial" });
test.setTimeout(45_000);

const REVIEW_DIR = join(tmpdir(), "skolegps-join-v2-review");
const CODE = "ABC123";
const SESSION_ID = "screenshot-session";

mkdirSync(REVIEW_DIR, { recursive: true });

const activeLookup = {
  kind: "active",
  sessionId: SESSION_ID,
  sessionStatus: "running",
  runTitle: "Skovløbet",
  schedule: null,
  scheduleGate: "active",
  raceType: "quiz",
};

async function prepare(page: Page) {
  await page.route("**/api/telemetry**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.context().route(
    /supabase.*realtime|realtime\/v1\/websocket/i,
    async (route: Route) => route.abort("connectionrefused"),
  );
}

async function openStart(page: Page, path = "/join") {
  await prepare(page);
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Deltag i et løb", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
}

async function openCode(page: Page) {
  await openStart(page);
  await page.getByRole("button", { name: "Deltag i et løb", exact: true }).click();
  await expect(page.locator("#join-code")).toBeFocused();
}

async function save(page: Page, name: string) {
  const devToolsButton = page.getByRole("button", { name: "Open Next.js Dev Tools" });
  if (await devToolsButton.count()) {
    await devToolsButton.evaluate((button) => {
      const root = button.getRootNode();
      if (root instanceof ShadowRoot) {
        root.host.remove();
      } else {
        button.remove();
      }
    });
  }
  await page.screenshot({ path: join(REVIEW_DIR, `state-${name}-390x844.png`) });
}

test.describe("lokale visuelle review-tilstande", () => {
  test("initial", async ({ page }) => {
    await openStart(page);
    await save(page, "initial");
    for (const size of [
      { width: 320, height: 568 },
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 412, height: 915 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(size);
      expect(await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )).toBe(false);
      await expect(
        page.getByRole("button", { name: "Deltag i et løb", exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Scan QR-kode", exact: true }),
      ).toBeInViewport();
      await page.screenshot({
        path: join(REVIEW_DIR, `start-${size.width}x${size.height}.png`),
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(REVIEW_DIR, "state-initial-390x844.png") });
  });

  test("kodeindtastning", async ({ page }) => {
    await openCode(page);
    await page.locator("#join-code").fill(CODE);
    await save(page, "code");
  });

  test("kode-loading", async ({ page }) => {
    let releaseLookup: (() => void) | undefined;
    const lookupGate = new Promise<void>((resolve) => {
      releaseLookup = resolve;
    });
    await page.route("**/api/join**", async (route) => {
      await lookupGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeLookup),
      });
    });
    await openCode(page);
    await page.locator("#join-code").fill(CODE);
    await page.locator("#join-code").press("Enter");
    await expect(page.getByRole("button", { name: "Tjekker koden..." })).toBeVisible();
    await save(page, "code-loading");
    releaseLookup?.();
    await expect(page.locator("#join-name")).toBeVisible();
  });

  test("ugyldig kode", async ({ page }) => {
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
    await expect(page.locator("#join-error")).toBeVisible();
    await save(page, "invalid");
  });

  test("udløbet link", async ({ page }) => {
    await openStart(page, "/join?expired=1");
    await expect(page.getByText("Linket kan ikke bruges længere", { exact: true })).toBeVisible();
    await save(page, "expired");
  });

  test("QR-modal", async ({ page }) => {
    await page.context().grantPermissions(["camera"], { origin: "http://localhost:3000" });
    await openStart(page);
    await page.getByRole("button", { name: "Scan QR-kode", exact: true }).click();
    await expect(page.getByTestId("join-qr-dialog")).toBeVisible();
    await save(page, "qr-modal");
    await page.getByTestId("join-qr-close").click();
  });

  test("QR-permission-info", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          throw new DOMException("Camera permission denied", "NotAllowedError");
        },
      });
    });
    await openStart(page);
    await page.getByRole("button", { name: "Scan QR-kode", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Kameraet kunne ikke åbnes" })).toBeVisible();
    await save(page, "qr-permission");
  });

  test("navnetrin", async ({ page }) => {
    await page.route("**/api/join**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeLookup),
      });
    });
    await openCode(page);
    await page.locator("#join-code").fill(CODE);
    await page.locator("#join-code").press("Enter");
    await expect(page.locator("#join-name")).toBeVisible();
    await save(page, "name");
  });

  test("join-loading", async ({ page }) => {
    let releaseRegistration: (() => void) | undefined;
    const registrationGate = new Promise<void>((resolve) => {
      releaseRegistration = resolve;
    });
    await page.route("**/api/join**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(activeLookup),
        });
        return;
      }
      await registrationGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          participantId: "screenshot-participant",
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
    await page.locator("#join-name").press("Enter");
    await expect(page.getByRole("button", { name: "Lukker dig ind..." })).toBeVisible();
    await save(page, "join-loading");
    releaseRegistration?.();
    await page.waitForURL(`**/play/${SESSION_ID}`);
  });

  test("resume", async ({ page }) => {
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
    await expect(page.getByRole("button", { name: "Fortsæt løbet", exact: true })).toBeVisible();
    await save(page, "resume");
  });

  test("netværksfejl", async ({ page }) => {
    await page.route("**/api/join**", async (route) => route.abort("failed"));
    await openCode(page);
    await page.locator("#join-code").fill(CODE);
    await page.locator("#join-code").press("Enter");
    await expect(page.locator("#join-error")).toContainText("Tjek nettet");
    await save(page, "network");
  });
});
