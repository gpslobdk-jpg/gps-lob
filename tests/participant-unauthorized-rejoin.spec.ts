import { test, expect, type Page, type Route } from "@playwright/test";

const SESSION_ID = "11111111-1111-1111-1111-111111111111";
const ACTIVE_PARTICIPANT_STORAGE_KEY = "gpslob_active_participant";

async function setupMocks(page: Page) {
  // prevent realtime websocket connections
  await page.context().route(/supabase.*realtime|realtime\/v1\/websocket/i, async (route: Route) => {
    await route.abort("connectionrefused");
  });

  await page.context().route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionStatus: "running", gpsOverride: false }),
    });
  });

  await page.context().route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized" }),
    });
  });

  await page.context().route(/\/api\/play\/session/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ questions: [], raceType: "quiz", radius: 50, gpsOverride: false }),
    });
  });
}

async function dismissMaintenanceOverlay(page: Page) {
  await page.addStyleTag({
    content: `
      div[class*="fixed"][class*="inset-0"][class*="z-"] {
        display: none !important;
        pointer-events: none !important;
      }
    `,
  });

  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((el) => {
      const cls = typeof el.className === "string" ? el.className : "";
      if (!cls.includes("fixed") || !cls.includes("inset-0")) {
        return;
      }
      const text = el.textContent ?? "";
      if (text.includes("lukke siden ned") || text.includes("Vi holder pause")) {
        el.remove();
      }
    });
  });
}

test("401 from /api/play/participant shows Danish rejoin message and join button", async ({ page }) => {
  // Simulate a fresh join: user fills name -> POST /api/join returns a participant
  await page.context().route(/\/api\/join/, async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participantId: "p-joined-1",
        studentName: "TestElev",
        startOffset: 0,
        sessionStatus: "running",
        teamId: null,
        teamColor: null,
      }),
    });
  });

  await setupMocks(page);

  // Log browser console and requests to help diagnose flakiness
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('request', (req) => console.log('REQ:', req.method(), req.url()));

  // Ensure the app starts with a stored active participant so the client
  // immediately attempts to fetch the participant snapshot on load.
  await page.addInitScript((sessionId: string) => {
    try {
      const key = "gpslob_active_participant";
      const stored = {
        participantId: "p-saved-1",
        sessionId: sessionId,
        studentName: "TestElev",
        startOffset: 0,
        savedAt: new Date().toISOString(),
        sessionStatus: "running",
      };
      window.localStorage.setItem(key, JSON.stringify(stored));
    } catch (e) {
      // ignore
    }
  }, SESSION_ID);

  await page.goto(`/play/${SESSION_ID}`);

  await dismissMaintenanceOverlay(page);

  // Expect the new rejoin message and a button back to /join
  const rejoinLocator = page.locator("text=Du skal tilmelde dig løbet igen.").first();
  await expect(rejoinLocator, { timeout: 30000 }).toBeVisible();
  await expect(page.getByRole("button", { name: /Gå til join/i })).toBeVisible();

  // Ensure the session-missing text is NOT shown in this case
  await expect(page.locator("text=Løbet er muligvis afsluttet")).toHaveCount(0);
});
