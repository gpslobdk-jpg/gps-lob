import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test, type BrowserContext, type Route } from "@playwright/test";

const OUTPUT_DIR = path.join(os.tmpdir(), "skolegps-lynbygger-review");
const TEACHER_USER_ID = "bbbbbbbb-1111-4222-8333-cccccccc0001";

function base64UrlEncode(value: unknown) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeSessionPayload() {
  return {
    access_token: "mock-lynbygger-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-lynbygger-refresh-token",
    user: {
      id: TEACHER_USER_ID,
      email: "lynbygger@test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Lynbygger Test Teacher" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };
}

function makeGeneratedRun(topic: string) {
  return {
    title: `Lynløb om ${topic}`,
    questions: Array.from({ length: 5 }, (_, index) => ({
      question: `${topic}: fagligt spørgsmål ${index + 1}`,
      options: [`Korrekt svar ${index + 1}`, "Svarmulighed B", "Svarmulighed C", "Svarmulighed D"],
      correctAnswer: `Korrekt svar ${index + 1}`,
    })),
  };
}

async function setupDashboardContext(context: BrowserContext) {
  const session = makeSessionPayload();
  const cookieValue = `base64-${base64UrlEncode(session)}`;
  const cookieNames = [
    "sb-localhost-auth-token",
    "sb-127-auth-token",
    "sb-xodrzahqdgbsssntupjt-auth-token",
  ];

  await context.addCookies(
    cookieNames.flatMap((name) =>
      [name, `${name}.0`].map((cookieName) => ({
        name: cookieName,
        value: cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      })),
    ),
  );

  await context.addInitScript(() => {
    window.localStorage.setItem("gpslob_tour_finished", "true");
  });

  await context.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
      return;
    }
    if (url.includes("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await context.route("**/rest/v1/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().method() === "GET" ? "[]" : "{}",
    });
  });
}

test.use({ serviceWorkers: "block" });

test("gemmer den krævede visuelle Lynbygger-gennemgang", async ({ page, context }) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await setupDashboardContext(context);

  let mode: "success" | "loading" | "error" = "success";
  let releaseLoading = () => {};
  let loadingGate: Promise<void> = Promise.resolve();

  await page.route("**/api/manual-builder/interview", async (route) => {
    const topic = String((route.request().postDataJSON() as { manualTopic?: unknown }).manualTopic ?? "Vulkaner");
    if (mode === "loading") {
      await loadingGate;
    }
    if (mode === "error") {
      await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"hidden_detail"}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeGeneratedRun(topic)),
    });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard/opret/lynbygger", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("lynbygger-page")).toBeVisible();
  await page.screenshot({ path: path.join(OUTPUT_DIR, "01-tom-desktop.png"), animations: "disabled" });

  await page.getByLabel("Emne").fill("Vulkaner");
  await page.getByLabel("Klassetrin").selectOption("6. klasse");
  await page.screenshot({ path: path.join(OUTPUT_DIR, "02-udfyldt-desktop.png"), animations: "disabled" });

  mode = "loading";
  loadingGate = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });
  await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.screenshot({ path: path.join(OUTPUT_DIR, "03-loading.png"), animations: "disabled" });
  releaseLoading();

  await expect(page.getByTestId("lynbygger-placement-step")).toBeVisible();
  await page.screenshot({ path: path.join(OUTPUT_DIR, "04-placering.png"), animations: "disabled" });
  await page.getByTestId("lynbygger-teacher-approval").check();
  await page.getByTestId("lynbygger-place-manually").click();
  await expect(page).toHaveURL(/\/dashboard\/opret\/manuel$/);
  await expect(page.locator('article[id^="manuel-post-"]')).toHaveCount(5);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "05-manuel-bygger.png"), animations: "disabled" });

  mode = "error";
  await page.goto("/dashboard/opret/lynbygger", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Emne").fill("Demokrati");
  await page.getByLabel("Klassetrin").selectOption("9. klasse");
  await page.getByRole("button", { name: "⚡ Lav mit løb" }).click();
  await expect(page.getByTestId("lynbygger-error")).toBeVisible();
  await page.screenshot({ path: path.join(OUTPUT_DIR, "06-fejl.png"), animations: "disabled" });

  mode = "success";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/opret/lynbygger", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Emne").fill("Eventyr");
  await page.getByLabel("Klassetrin").selectOption("4. klasse");
  await page.screenshot({ path: path.join(OUTPUT_DIR, "07-mobil-390.png"), animations: "disabled" });
  await page.getByRole("button", { name: /Lav mit/ }).click();
  await expect(page.getByTestId("lynbygger-draft-review")).toBeVisible();
  const mobileLayout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(mobileLayout.clientWidth + 1);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "08-mobil-ai-udkast-390.png"),
    animations: "disabled",
    fullPage: true,
  });
});
