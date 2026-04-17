import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Phase 42 — Premium Photo Builder E2E
 *
 * Verifies a teacher can fill in the Photo Race form and save it to the
 * archive. All Supabase calls (auth, REST, realtime) are mocked so nothing
 * touches the real database.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEACHER_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee42";

test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function makeAuthCookieValue() {
  const session = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-refresh-token",
    user: {
      id: TEACHER_USER_ID,
      email: "phase42@test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Phase42 Teacher" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };
  return (
    "base64-" +
    Buffer.from(JSON.stringify(session))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  );
}

// ---------------------------------------------------------------------------
// Supabase mock setup
// ---------------------------------------------------------------------------

async function setupSupabaseMocks(page: Page) {
  const ctx = page.context();

  // --- Auth endpoints ---
  await ctx.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();
    const userPayload = {
      id: TEACHER_USER_ID,
      email: "phase42@test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Phase42 Teacher" },
      created_at: "2024-01-01T00:00:00Z",
    };

    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 36000,
          refresh_token: "mock-refresh-token",
          user: userPayload,
        }),
      });
      return;
    }
    if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(userPayload),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // --- REST endpoints ---
  let insertedPayload: Record<string, unknown> | null = null;

  await ctx.route("**/rest/v1/**", async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Profile lookup — return premium plan
    if (url.includes("profiles")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: TEACHER_USER_ID,
          plan_type: "premium",
          beta_access: true,
        }),
      });
      return;
    }

    // gps_runs INSERT — capture the payload and return success
    if (url.includes("gps_runs") && method === "POST") {
      try {
        insertedPayload = JSON.parse((await route.request().postData()) ?? "{}");
      } catch {
        /* ignore */
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify([{ id: "mock-run-id-42" }]),
      });
      return;
    }

    // Fallback — empty array for GETs, empty object otherwise
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: method === "GET" ? "[]" : "{}",
    });
  });

  // --- Realtime — just abort ---
  await ctx.route("**/realtime/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });

  // --- Auth cookie ---
  await ctx.addCookies([
    {
      name: "sb-xodrzahqdgbsssntupjt-auth-token.0",
      value: makeAuthCookieValue(),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  return { getInsertedPayload: () => insertedPayload };
}

// ---------------------------------------------------------------------------
// Maintenance / overlay dismissal
// ---------------------------------------------------------------------------

async function dismissOverlays(page: Page) {
  await page.addStyleTag({
    content: `
      div[class*="z-[9999]"] { display: none !important; }
      div[class*="z-1200"]   { display: none !important; }
    `,
  });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("Premium Photo Builder", () => {
  test.use({ actionTimeout: 15_000 });

  test("Teacher can create a Photo Race and see it in the archive", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // 1. Setup mocks & navigate
    const { getInsertedPayload } = await setupSupabaseMocks(page);
    await page.goto("/dashboard/opret/foto", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await dismissOverlays(page);

    // 2. Fill in the Race Title
    const titleInput = page.getByPlaceholder("F.eks. Foto-eventyr i Vordingborg");
    await titleInput.waitFor({ state: "visible", timeout: 15_000 });
    await titleInput.fill("Phase 42 — Naturfoto i Skovparken");

    // 3. Fill the default first Photo Mission
    //    a) "Hvad skal de finde?" (AI prompt)
    const aiPromptInput = page.getByPlaceholder("fx Bøgeblad, Rød postkasse, Sten").first();
    await aiPromptInput.fill("Bøgetræ");

    //    b) Student instruction
    const instructionTextarea = page
      .getByPlaceholder(
        "f.eks. Find et stort egetræ og tag et sjovt holdbillede med det."
      )
      .first();
    await instructionTextarea.fill(
      "Find et stort bøgetræ i parken og tag et gruppebillede foran det."
    );

    // 4. Click "Hent pin til kortet" to assign coordinates from map centre
    const pinButton = page.getByRole("button", { name: /Hent pin til kortet/i }).first();
    await pinButton.click();

    // Verify the pin was placed (the card should now show coordinates)
    await expect(page.getByText(/Pin gemt:/i).first()).toBeVisible({ timeout: 5_000 });

    // 5. Click "Gem løb i arkivet"
    const saveButton = page.getByRole("button", { name: /Gem løb i arkivet/i });
    await saveButton.click();

    // 6. Assert the success notice appears
    await expect(
      page.getByText("Foto-missionen er gemt i arkivet!")
    ).toBeVisible({ timeout: 10_000 });

    // 7. Verify the mocked Supabase insert was called with expected shape
    const payload = getInsertedPayload();
    expect(payload).not.toBeNull();
    if (payload) {
      expect(payload).toHaveProperty("title", "Phase 42 — Naturfoto i Skovparken");
      expect(payload).toHaveProperty("race_type", "foto");
      expect(payload).toHaveProperty("user_id", TEACHER_USER_ID);
      const questions = (payload as { questions: unknown[] }).questions;
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThanOrEqual(1);
    }
  });
});
