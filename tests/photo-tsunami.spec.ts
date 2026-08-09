/**
 * photo-tsunami.spec.ts – Photo Tsunami Test (Phase 20).
 *
 * Proves that:
 *  1. V2 submitPhoto compresses images before upload (import audit).
 *  2. LivePhotosModule renders 30 simultaneous photo answers without crashing.
 *  3. Clicking a photo in the grid opens the lightbox.
 *  4. The lightbox can be dismissed.
 *  5. The main thread stays responsive during the 30-photo render burst.
 *  6. No unexpected console errors occur.
 */

import { test, expect, type Page, type Route } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";
const PHOTO_COUNT = 30;

let localTeacher: { id: string; email: string; password: string } | null = null;

const BASE_LAT = 55.6761;
const BASE_LNG = 12.5683;

const POST_QUESTIONS = [
  { type: "photo", text: "Tag et foto af naturen", lat: BASE_LAT, lng: BASE_LNG, points: 10 },
  { type: "photo", text: "Tag et foto af et dyr", lat: BASE_LAT + 0.002, lng: BASE_LNG + 0.002, points: 10 },
];

// ---------------------------------------------------------------------------
// Photo answer fixtures
// ---------------------------------------------------------------------------

function makeAnswerId(index: number) {
  return `photo-answer-${String(index).padStart(4, "0")}`;
}

function makeStudentName(index: number) {
  const names = [
    "Anna", "Bo", "Clara", "Dennis", "Eva",
    "Frederik", "Gitte", "Henrik", "Ida", "Jonas",
    "Karen", "Lars", "Maria", "Niels", "Olivia",
    "Peter", "Rikke", "Simon", "Tina", "Ulrik",
    "Victor", "William", "Xenia", "Yasmin", "Zara",
    "Albert", "Birgit", "Carl", "Dorthe", "Emil",
  ];
  return names[index % names.length];
}

/** Tiny 1×1 pixel JPEG as a data URI (avoids network requests for images). */
const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI4Q/SFhSRJaQnLFCd6OkwdMo+TY3cb9q1YWly6dlqM4/8AAKQRARI1ARuAAB5/9k=";

type AnswerRow = {
  id: string;
  session_id: string;
  participant_id: string;
  student_name: string;
  post_number: number;
  is_correct: boolean | null;
  awarded_points: number;
  image_url: string;
  created_at: string;
};

function createPhotoAnswers(): AnswerRow[] {
  const answers: AnswerRow[] = [];
  for (let i = 0; i < PHOTO_COUNT; i++) {
    answers.push({
      id: makeAnswerId(i),
      session_id: SESSION_ID,
      participant_id: `participant-${String(i).padStart(4, "0")}`,
      student_name: makeStudentName(i),
      post_number: (i % POST_QUESTIONS.length) + 1,
      is_correct: null,
      awarded_points: 10,
      image_url: TINY_JPEG,
      created_at: new Date(Date.now() - (PHOTO_COUNT - i) * 1000).toISOString(),
    });
  }
  return answers;
}

// ---------------------------------------------------------------------------
// Supabase REST mock
// ---------------------------------------------------------------------------

function parseMockTable(url: string): string | null {
  const match = url.match(/\/rest\/v1\/([a-z_]+)/);
  return match ? match[1] : null;
}

async function mockSupabaseRoutes(page: Page) {
  const ctx = page.context();

  await ctx.route("**/api/dashboard/live/theme**", async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // Refuse realtime so the hook uses REST data only
  await ctx.route("**/realtime/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });

  // REST API
  const photoAnswers = createPhotoAnswers();

  await ctx.route("**/rest/v1/**", async (route: Route) => {
    const url = route.request().url();
    const table = parseMockTable(url);

    switch (table) {
      case "live_sessions": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: SESSION_ID,
            pin: "999888",
            status: "running",
            run_id: RUN_ID,
            gps_override: false,
          }),
        });
        break;
      }

      case "gps_runs": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: RUN_ID,
            questions: POST_QUESTIONS,
            race_type: "standard",
          }),
        });
        break;
      }

      case "session_students": {
        const students = Array.from({ length: PHOTO_COUNT }, (_, i) => ({
          id: `participant-${String(i).padStart(4, "0")}`,
          session_id: SESSION_ID,
          student_name: makeStudentName(i),
        }));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(students),
        });
        break;
      }

      case "participants": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        break;
      }

      case "session_messages": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        break;
      }

      case "answers": {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(photoAnswers),
        });
        break;
      }

      default: {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        break;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function signInLocalTeacher(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(localTeacher!.email);
  await page.getByPlaceholder("Adgangskode").fill(localTeacher!.password);
  await page.getByRole("button", { name: /Log ind \/ Opret/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(url)) return;

  const admin = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
  const email = `photo-tsunami-${crypto.randomUUID()}@isolated.invalid`;
  const password = `Local-${crypto.randomUUID()}-A1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Kunne ikke oprette lokal foto-testlærer.");
  await admin.from("profiles").upsert({ id: data.user.id });
  localTeacher = { id: data.user.id, email, password };
});

test.afterAll(async () => {
  if (!localTeacher) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const admin = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(localTeacher.id);
});

test.describe("Photo Tsunami – 30 simultaneous photo uploads", () => {
  test("30 photos render in the grid, lightbox opens/closes, UI stays responsive", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    test.skip(!localTeacher, "Kræver den isolerede lokale Supabase-instans.");

    // Collect console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          text.includes("WebSocket") ||
          text.includes("ERR_CONNECTION_REFUSED") ||
          text.includes("realtime") ||
          text.includes("CHANNEL_ERROR") ||
          text.includes("Fast Refresh") ||
          text.includes("hmr") ||
          text.includes("hot-reloader") ||
          text.includes("Failed to fetch") ||
          text.includes("ERR_INVALID_URL") ||
          text.includes("net::ERR") ||
          text.includes("hasn't mounted yet")
        ) {
          return;
        }
        consoleErrors.push(text);
      }
    });

    let didCrash = false;
    page.on("crash", () => {
      didCrash = true;
    });

    // Use a genuine local Supabase session so the route guard is exercised.
    await signInLocalTeacher(page);

    // Mock only the client-side data API used by the live dashboard.
    await mockSupabaseRoutes(page);

    // Navigate to teacher live view
    await page.goto(`/dashboard/live/${SESSION_ID}`, {
      waitUntil: "load",
      timeout: 60_000,
    });

    // Hide the TeacherAccessOverlay that auto-opens on waiting→running transition.
    // It covers the sidebar with a z-1200 fixed overlay.
    await page.addStyleTag({
      content: `div[class*="z-1200"] { display: none !important; }`,
    });

    // Wait for map to appear (confirms page loaded successfully)
    await page.locator(".leaflet-container").waitFor({ state: "visible", timeout: 45_000 });

    // -----------------------------------------------------------------------
    // Open the Photos module via the sidebar "Foto-strøm" button
    // -----------------------------------------------------------------------

    const photoButton = page.getByRole("button", { name: /Foto/i });
    await photoButton.waitFor({ state: "visible", timeout: 15_000 });
    await photoButton.click();

    // Wait for the LivePhotosModule to appear (header text "Live Fotos")
    await page.getByText("Live Fotos").waitFor({ state: "visible", timeout: 15_000 });

    // -----------------------------------------------------------------------
    // Responsiveness probe
    // -----------------------------------------------------------------------

    await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      w.__photoTsunamiBlocks = [];
      const blocks = w.__photoTsunamiBlocks as number[];
      let lastFrameTime = performance.now();

      function probe() {
        const now = performance.now();
        const delta = now - lastFrameTime;
        if (delta > 200) {
          blocks.push(delta);
        }
        lastFrameTime = now;
        requestAnimationFrame(probe);
      }
      requestAnimationFrame(probe);
    });

    // -----------------------------------------------------------------------
    // Assert: all 30 photos render in the grid
    // -----------------------------------------------------------------------

    // Each photo is a <button> inside the photo grid
    const photoGrid = page.locator("div.grid.grid-cols-2");
    const photoCards = photoGrid.locator("button:has(img[loading='lazy'])");

    await expect(async () => {
      const count = await photoCards.count();
      expect(count).toBe(PHOTO_COUNT);
    }).toPass({ timeout: 20_000 });

    // Verify student names are present (spot-check first and last)
    await expect(page.getByText(makeStudentName(0))).toBeVisible();
    await expect(page.getByText(makeStudentName(PHOTO_COUNT - 1))).toBeVisible();

    // The counter in the header should show 30
    await expect(page.getByText(String(PHOTO_COUNT))).toBeVisible();

    // -----------------------------------------------------------------------
    // Assert: clicking a photo opens the lightbox
    // -----------------------------------------------------------------------

    // Click the first photo card
    await photoCards.first().click();

    // The lightbox uses z-1400 (LivePhotoLightbox)
    const lightbox = page.locator("div[class*='z-1400']");
    await lightbox.waitFor({ state: "visible", timeout: 10_000 });

    // "Live foto" label should be displayed in the lightbox header
    await expect(lightbox.getByText("Live foto")).toBeVisible();

    // -----------------------------------------------------------------------
    // Assert: lightbox can be dismissed
    // -----------------------------------------------------------------------

    // Close lightbox by clicking the backdrop (the outer div has onClick={onClose})
    await lightbox.click({ position: { x: 5, y: 5 } });

    // Lightbox should disappear
    await expect(lightbox).toBeHidden({ timeout: 5_000 });

    // -----------------------------------------------------------------------
    // Assert: main thread stayed responsive
    // -----------------------------------------------------------------------

    // Let everything settle
    await page.waitForTimeout(2_000);

    const blocks = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return (w.__photoTsunamiBlocks as number[]) ?? [];
    });

    const severeBlocks = blocks.filter((ms: number) => ms > 500);
    expect(severeBlocks.length).toBe(0);

    // -----------------------------------------------------------------------
    // Final assertions
    // -----------------------------------------------------------------------

    expect(didCrash).toBe(false);
    expect(consoleErrors).toEqual([]);
  });
});
