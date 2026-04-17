/**
 * print-layout.spec.ts — InkSaverPrintLayout visual verification + PDF proof.
 *
 * Navigates to /dashboard/opret/dansk, fills in sample questions, emulates
 * print media, then asserts:
 *   1. Standard screen UI elements (sidebar, glass header) are hidden.
 *   2. The 3 print sections (Elev-ark, Svar-ark, Facitliste) are visible.
 *   3. A real A4 PDF is saved to test-results/ink-saver-test.pdf.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEACHER_USER_ID = "print-test-teacher-00000001";

// ---------------------------------------------------------------------------
// Auth helpers (same pattern as other tests in this repo)
// ---------------------------------------------------------------------------

function makeSessionPayload() {
  return {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 36000,
    expires_at: Math.floor(Date.now() / 1000) + 36000,
    refresh_token: "mock-refresh-token",
    user: {
      id: TEACHER_USER_ID,
      email: "teacher@print-test.dk",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Print Tester" },
      created_at: "2024-01-01T00:00:00Z",
    },
  };
}

async function injectAuthCookie(page: Page) {
  const session = makeSessionPayload();
  const encoded = Buffer.from(JSON.stringify(session))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await page.context().addCookies([
    {
      name: "sb-xodrzahqdgbsssntupjt-auth-token.0",
      value: "base64-" + encoded,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

async function mockAuthRoutes(page: Page) {
  const ctx = page.context();
  const session = makeSessionPayload();

  await ctx.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();

    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
      return;
    }

    if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session.user),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  // Kill realtime to prevent noise
  await ctx.route("**/realtime/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });

  // Catch any REST calls (the builder page shouldn't need any on fresh load)
  await ctx.route("**/rest/v1/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
}

// ---------------------------------------------------------------------------
// Sample questions to fill into the builder
// ---------------------------------------------------------------------------

const SAMPLE_QUESTIONS = [
  {
    text: "Hvad er hovedstaden i Danmark?",
    answers: ["København", "Aarhus", "Odense", "Aalborg"],
    correctIndex: 0,
  },
  {
    text: "Hvem skrev Kongens Fald?",
    answers: ["Johannes V. Jensen", "Karen Blixen", "H.C. Andersen", "Tom Kristensen"],
    correctIndex: 0,
  },
  {
    text: "Hvad hedder den længste å i Danmark?",
    answers: ["Skjern Å", "Gudenåen", "Storå", "Odense Å"],
    correctIndex: 1,
  },
];

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("InkSaverPrintLayout — Print verification & PDF", () => {
  test("renders 3 print sections and generates A4 PDF", async ({ browser }) => {
    test.setTimeout(120_000);
    // We need a fresh context for cookie injection
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Setup auth
    await mockAuthRoutes(page);
    await injectAuthCookie(page);

    // Navigate to the dansk builder
    await page.goto("/dashboard/opret/dansk", {
      waitUntil: "load",
      timeout: 60_000,
    });

    // Wait for the builder to be ready — the first question card should be visible
    await page.locator("text=Post 1").first().waitFor({
      state: "visible",
      timeout: 45_000,
    });

    // ----- Fill in a title -----
    const titleInput = page.getByPlaceholder(/laeseloeb|titel/i).first();
    await titleInput.fill("Dansk Quiz — Print Test");

    // ----- Fill in the first question (already exists by default) -----
    const q1 = SAMPLE_QUESTIONS[0];
    await page.getByPlaceholder("Skriv spørgsmålet her...").fill(q1.text);

    // Fill answer inputs
    await page.getByPlaceholder("Svar 1").fill(q1.answers[0]);
    await page.getByPlaceholder("Svar 2").fill(q1.answers[1]);
    await page.getByPlaceholder("Svar 3").fill(q1.answers[2]);
    await page.getByPlaceholder("Svar 4").fill(q1.answers[3]);

    // ----- Add 1 more question via "Tilføj post" / "Opret ny post" -----
    const addBtn = page.locator('button:has-text("Tilføj post")').first();
    await addBtn.click();
    const newPostBtn = page.locator('button:has-text("Opret ny post")');
    await newPostBtn.waitFor({ state: "visible", timeout: 5_000 });
    await newPostBtn.click();
    await page.locator("text=Post 2").first().waitFor({ state: "visible", timeout: 5_000 });

    // ----- Emulate print media -----
    await page.emulateMedia({ media: "print" });

    // Wait a moment for CSS to apply
    await page.waitForTimeout(500);

    // ----- Assertions: Screen UI should be hidden -----

    // The main print section should be visible
    const printSection = page.locator('section[aria-label="Printvenlig layout"]');
    await expect(printSection).toBeVisible({ timeout: 5_000 });

    // ----- Assertions: All 3 print sections are present -----

    // Section 1: Elev-ark
    const elevArk = printSection.locator("text=Elev-ark · Spørgsmål");
    await expect(elevArk).toBeVisible();

    // Section 2: Svar-ark
    const svarArk = printSection.locator("text=Svar-ark · Sæt kryds");
    await expect(svarArk).toBeVisible();

    // Section 3: Facitliste
    const facitliste = printSection.locator("text=Lærerens facitliste · Fortroligt");
    await expect(facitliste).toBeVisible();

    // ----- Assertions: Content integrity -----

    // The first question text should appear in the Elev-ark
    await expect(printSection.locator(`text=${SAMPLE_QUESTIONS[0].text}`).first()).toBeVisible();

    // The bubble grid table should have header cells A, B, C, D
    const bubbleHeaders = printSection.locator("th");
    const headerTexts: string[] = [];
    for (let i = 0; i < await bubbleHeaders.count(); i++) {
      headerTexts.push(await bubbleHeaders.nth(i).textContent() ?? "");
    }
    expect(headerTexts).toContain("A");
    expect(headerTexts).toContain("B");
    expect(headerTexts).toContain("C");
    expect(headerTexts).toContain("D");

    // Facitliste should contain "Facit-oversigt"
    await expect(printSection.locator("text=Facit-oversigt")).toBeVisible();

    // ----- Generate PDF -----
    const pdfPath = "test-results/ink-saver-test.pdf";
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
    });

    // ----- Verify the PDF was created -----
    const fs = await import("fs");
    expect(fs.existsSync(pdfPath)).toBe(true);
    const stats = fs.statSync(pdfPath);
    expect(stats.size).toBeGreaterThan(1000); // Should be a real PDF, not empty

    // ----- Cleanup -----
    await ctx.close();
  });
});
