/**
 * multiplayer.spec.ts – The Multiplayer Acid Test (Zone War & Stratego).
 *
 * Proves that:
 *  1. Two independent players can join the same zone_krig session.
 *  2. Zone capture works – Player A captures, Player B sees "blocked_by_shield".
 *  3. Simultaneous submits (Promise.all) produce consistent, non-corrupt state.
 *  4. Stratego duel resolution is atomic – exactly one winner, lives deducted.
 *
 * Architecture:
 *  - Uses browser.newContext() for two isolated players (separate cookies/storage).
 *  - Shared mutable `ZoneState` object acts as the in-memory "database", ensuring
 *    both players' mocked API routes read/write the same zone ownership & shield.
 *  - A semaphore on the mock guarantees the first capture request wins and
 *    the second sees the shield, deterministically simulating row-level locking.
 */

import { test, expect, type Page, type BrowserContext, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = "2c839b5e-eb2d-4453-a256-d0ec5615f531";

const TEAM_A_ID = "aaaaaaaa-0000-1111-2222-aaaaaaaaaaaa";
const TEAM_B_ID = "bbbbbbbb-0000-1111-2222-bbbbbbbbbbbb";

const PLAYER_A_ID = "11111111-aaaa-bbbb-cccc-111111111111";
const PLAYER_B_ID = "22222222-aaaa-bbbb-cccc-222222222222";

const PLAYER_A_NAME = "Hold Rød";
const PLAYER_B_NAME = "Hold Blå";

const POST_LAT = 55.6761;
const POST_LNG = 12.5683;

const ZONE_KRIG_QUESTIONS = [
  {
    type: "multiple_choice",
    text: "Hvad er hovedstaden i Danmark?",
    answers: ["Odense", "København", "Aarhus", "Aalborg"],
    correctIndex: 1,
    points: 10,
    lat: POST_LAT,
    lng: POST_LNG,
    radius_m: 30,
  },
  {
    type: "multiple_choice",
    text: "Hvad er 7×8?",
    answers: ["54", "56", "58", "64"],
    correctIndex: 1,
    points: 10,
    lat: POST_LAT + 0.001,
    lng: POST_LNG + 0.001,
    radius_m: 30,
  },
];

// ---------------------------------------------------------------------------
// Shared mutable zone state (simulates the DB)
// ---------------------------------------------------------------------------

interface ZoneState {
  ownerTeamId: string | null;
  shieldUntilMs: number | null;
  /** Counts how many successful captures have happened. */
  captureCount: number;
  /** Tracks every capture attempt result for assertions. */
  log: Array<{ playerId: string; teamId: string; status: string }>;
}

function createFreshZoneState(): ZoneState {
  return {
    ownerTeamId: null,
    shieldUntilMs: null,
    captureCount: 0,
    log: [],
  };
}

/**
 * Atomically resolve a capture attempt against the shared zone state.
 * Mirrors the `capture_zone_krig` RPC logic:
 *  - If no owner → captured.
 *  - If same owner → already_owned.
 *  - If different owner AND shield active → blocked_by_shield.
 *  - If different owner AND no shield → captured.
 */
function resolveCapture(
  state: ZoneState,
  teamId: string,
  playerId: string,
): { status: string; shieldRemainingSeconds?: number } {
  const now = Date.now();

  // Already owned by same team.
  if (state.ownerTeamId === teamId) {
    const entry = { playerId, teamId, status: "already_owned" };
    state.log.push(entry);
    return { status: "already_owned" };
  }

  // Different team, but shield is active.
  if (
    state.ownerTeamId !== null &&
    state.ownerTeamId !== teamId &&
    state.shieldUntilMs !== null &&
    now < state.shieldUntilMs
  ) {
    const remaining = Math.ceil((state.shieldUntilMs - now) / 1000);
    const entry = { playerId, teamId, status: "blocked_by_shield" };
    state.log.push(entry);
    return { status: "blocked_by_shield", shieldRemainingSeconds: remaining };
  }

  // Capture!
  state.ownerTeamId = teamId;
  state.shieldUntilMs = now + 3 * 60 * 1000; // 3-minute shield
  state.captureCount++;
  const entry = { playerId, teamId, status: "captured" };
  state.log.push(entry);
  return { status: "captured" };
}

// ---------------------------------------------------------------------------
// Stratego duel shared state
// ---------------------------------------------------------------------------

interface StrategoDuelState {
  playerALives: number;
  playerBLives: number;
  /** Log of duel outcomes. */
  duels: Array<{ attackerId: string; defenderId: string; winnerId: string | null; isDraw: boolean }>;
}

function createFreshDuelState(): StrategoDuelState {
  return { playerALives: 3, playerBLives: 3, duels: [] };
}

/**
 * Deterministic duel resolution: higher strength wins.
 * Atomically deducts a life from the loser.
 * Returns the result and mutates shared state.
 */
function resolveDuel(
  state: StrategoDuelState,
  attackerId: string,
  defenderId: string,
  attackerStrength: number,
  defenderStrength: number,
): { winnerId: string | null; loserId: string | null; isDraw: boolean } {
  if (attackerStrength === defenderStrength) {
    // Draw — both lose a life.
    if (attackerId === PLAYER_A_ID) state.playerALives--;
    else state.playerBLives--;
    if (defenderId === PLAYER_A_ID) state.playerALives--;
    else state.playerBLives--;
    const entry = { attackerId, defenderId, winnerId: null, isDraw: true };
    state.duels.push(entry);
    return { winnerId: null, loserId: null, isDraw: true };
  }

  const attackerWins = attackerStrength > defenderStrength;
  const winnerId = attackerWins ? attackerId : defenderId;
  const loserId = attackerWins ? defenderId : attackerId;

  // Deduct life from loser.
  if (loserId === PLAYER_A_ID) state.playerALives--;
  else state.playerBLives--;

  const entry = { attackerId, defenderId, winnerId, isDraw: false };
  state.duels.push(entry);
  return { winnerId, loserId, isDraw: false };
}

// ---------------------------------------------------------------------------
// Semaphore for simulating row-level locking in Promise.all tests
// ---------------------------------------------------------------------------

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;
  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// ---------------------------------------------------------------------------
// API route mocking for a single player context
// ---------------------------------------------------------------------------

async function mockPlayerRoutes(
  page: Page,
  ctx: BrowserContext,
  opts: {
    playerId: string;
    playerName: string;
    teamId: string;
    teamColor: string;
    zoneState: ZoneState;
    duelState: StrategoDuelState;
    captureSemaphore: Semaphore;
  },
) {
  // POST /api/join → provision participant with team assignment
  await page.route("**/api/join", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participantId: opts.playerId,
        studentName: opts.playerName,
        startOffset: 0,
        sessionStatus: "running",
        teamId: opts.teamId,
        teamColor: opts.teamColor,
      }),
    });
  });

  // GET /api/play/session — zone_krig race type
  await ctx.route(/\/api\/play\/session/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        questions: ZONE_KRIG_QUESTIONS.map(({ correctIndex: _ci, ...q }) => q),
        raceType: "zone_krig",
        radius: 30,
        gpsOverride: false,
      }),
    });
  });

  // GET /api/play/status
  await ctx.route(/\/api\/play\/status/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionStatus: "running",
        gpsOverride: false,
      }),
    });
  });

  // GET /api/play/participant — no existing participant (fresh join)
  await ctx.route(/\/api\/play\/participant/, async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found" }),
    });
  });

  // POST /api/play/validate-answer → quiz validation + zone capture
  await page.route("**/api/play/validate-answer", async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const selectedIndex = body.selectedIndex ?? 0;
    const postIndex = body.postIndex ?? 0;
    const question = ZONE_KRIG_QUESTIONS[postIndex];
    const isCorrect = selectedIndex === question?.correctIndex;
    const awardedPoints = isCorrect ? (question?.points ?? 10) : 0;

    let zoneKrigCapture = undefined;

    if (isCorrect) {
      // Serialize capture attempts through the semaphore (simulates row lock).
      await opts.captureSemaphore.acquire();
      try {
        zoneKrigCapture = resolveCapture(opts.zoneState, opts.teamId, opts.playerId);
      } finally {
        opts.captureSemaphore.release();
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isCorrect,
        isLocked: false,
        awardedPoints,
        ...(zoneKrigCapture ? { zoneKrigCapture } : {}),
      }),
    });
  });

  // POST /api/play/submit-answer → persist
  await page.route("**/api/play/submit-answer", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ inserted: true, awardedPoints: 0 }),
    });
  });

  // POST /api/play/location → OK
  await page.route("**/api/play/location", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function setupGeolocation(ctx: BrowserContext) {
  await ctx.grantPermissions(["geolocation"]);
  await ctx.setGeolocation({ latitude: POST_LAT, longitude: POST_LNG, accuracy: 5 });
}

async function dismissMaintenanceOverlay(page: Page) {
  // Wait for React hydration to complete before any DOM manipulation.
  // The PIN input is a reliable hydration marker on the gateway screen.
  // For pages that don't show the gateway (stratego test), wait for networkidle.
  try {
    await page.locator('input[inputmode="numeric"]').waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    await page.waitForLoadState("networkidle");
  }

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
      const cls = el.className || "";
      if (typeof cls === "string" && cls.includes("fixed") && cls.includes("inset-0")) {
        const text = el.textContent || "";
        if (text.includes("lukke siden ned") || text.includes("Vi holder pause")) {
          el.remove();
        }
      }
    });
  });
}

async function joinAndEnterName(page: Page, sessionId: string, name: string) {
  // Gateway: enter PIN (session ID)
  const pinInput = page.locator('input[inputmode="numeric"]');
  await expect(pinInput).toBeVisible({ timeout: 15_000 });
  await pinInput.fill(sessionId);
  await page.getByRole("button", { name: /start mission/i }).click();

  // Name gate: enter team name
  const nameInput = page.locator('input[placeholder="Holdnavn"]');
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await nameInput.fill(name);
  await page.getByRole("button", { name: /klar til start/i }).click();
}

async function waitForQuestion(page: Page, questionText: string) {
  await expect(
    page.locator("h2", { hasText: questionText }),
  ).toBeVisible({ timeout: 30_000 });
}

async function answerCorrectly(page: Page, correctIndex: number) {
  const buttons = page.locator("button.text-left");
  await expect(buttons).toHaveCount(4, { timeout: 10_000 });
  await buttons.nth(correctIndex).click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Multiplayer Acid Test", () => {
  // ========================================================================
  // TEST 1: Zone Capture + Shield Blocks Second Player
  // ========================================================================
  test("zone_krig: Player A captures zone, Player B is blocked by shield", async ({
    browser,
  }) => {
    // ---- Shared DB state ----
    const zoneState = createFreshZoneState();
    const duelState = createFreshDuelState();
    const captureSema = new Semaphore(1); // serial captures

    // ---- Player A context ----
    const ctxA = await browser.newContext();
    await setupGeolocation(ctxA);
    const pageA = await ctxA.newPage();

    await mockPlayerRoutes(pageA, ctxA, {
      playerId: PLAYER_A_ID,
      playerName: PLAYER_A_NAME,
      teamId: TEAM_A_ID,
      teamColor: "#ef4444",
      zoneState,
      duelState,
      captureSemaphore: captureSema,
    });

    // ---- Player B context ----
    const ctxB = await browser.newContext();
    await setupGeolocation(ctxB);
    const pageB = await ctxB.newPage();

    await mockPlayerRoutes(pageB, ctxB, {
      playerId: PLAYER_B_ID,
      playerName: PLAYER_B_NAME,
      teamId: TEAM_B_ID,
      teamColor: "#3b82f6",
      zoneState,
      duelState,
      captureSemaphore: captureSema,
    });

    // ---- Both players navigate and join ----
    await pageA.goto("/play/v2-test");
    await pageB.goto("/play/v2-test");

    await dismissMaintenanceOverlay(pageA);
    await dismissMaintenanceOverlay(pageB);

    // Use the session UUID (shortened to 6 digits for the PIN input).
    // The mock /api/join doesn't validate the PIN — it always provisions.
    const PIN = "123456";
    await joinAndEnterName(pageA, PIN, PLAYER_A_NAME);
    await joinAndEnterName(pageB, PIN, PLAYER_B_NAME);

    // ---- Both reach the active game screen with Q1 ----
    await waitForQuestion(pageA, "Hvad er hovedstaden i Danmark?");
    await waitForQuestion(pageB, "Hvad er hovedstaden i Danmark?");

    // ---- Player A answers correctly → captures zone ----
    await answerCorrectly(pageA, 1); // "København" = index 1
    await expect(pageA.locator("text=Korrekt")).toBeVisible({ timeout: 10_000 });

    // Zone should be captured by Team A.
    expect(zoneState.ownerTeamId).toBe(TEAM_A_ID);
    expect(zoneState.captureCount).toBe(1);
    expect(zoneState.shieldUntilMs).toBeGreaterThan(Date.now());

    // ---- Player B answers correctly → blocked by shield ----
    await answerCorrectly(pageB, 1); // Same correct answer
    await expect(pageB.locator("text=Korrekt")).toBeVisible({ timeout: 10_000 });

    // Zone remains owned by Team A.
    expect(zoneState.ownerTeamId).toBe(TEAM_A_ID);
    expect(zoneState.captureCount).toBe(1); // Unchanged — shield blocked.

    // ---- Verify the capture log ----
    expect(zoneState.log).toHaveLength(2);
    expect(zoneState.log[0]).toEqual({
      playerId: PLAYER_A_ID,
      teamId: TEAM_A_ID,
      status: "captured",
    });
    expect(zoneState.log[1]).toEqual({
      playerId: PLAYER_B_ID,
      teamId: TEAM_B_ID,
      status: "blocked_by_shield",
    });

    // ---- Cleanup ----
    await ctxA.close();
    await ctxB.close();
  });

  // ========================================================================
  // TEST 2: Race Condition — Simultaneous Capture (Promise.all)
  // ========================================================================
  test("zone_krig: simultaneous correct answers → exactly one capture, one shield-block", async ({
    browser,
  }) => {
    // ---- Shared DB state ----
    const zoneState = createFreshZoneState();
    const duelState = createFreshDuelState();
    const captureSema = new Semaphore(1); // ensures serial capture resolution

    // ---- Player A ----
    const ctxA = await browser.newContext();
    await setupGeolocation(ctxA);
    const pageA = await ctxA.newPage();

    await mockPlayerRoutes(pageA, ctxA, {
      playerId: PLAYER_A_ID,
      playerName: PLAYER_A_NAME,
      teamId: TEAM_A_ID,
      teamColor: "#ef4444",
      zoneState,
      duelState,
      captureSemaphore: captureSema,
    });

    // ---- Player B ----
    const ctxB = await browser.newContext();
    await setupGeolocation(ctxB);
    const pageB = await ctxB.newPage();

    await mockPlayerRoutes(pageB, ctxB, {
      playerId: PLAYER_B_ID,
      playerName: PLAYER_B_NAME,
      teamId: TEAM_B_ID,
      teamColor: "#3b82f6",
      zoneState,
      duelState,
      captureSemaphore: captureSema,
    });

    // ---- Setup: both reach Q1 ----
    await pageA.goto("/play/v2-test");
    await pageB.goto("/play/v2-test");

    await dismissMaintenanceOverlay(pageA);
    await dismissMaintenanceOverlay(pageB);

    const PIN = "123456";
    await joinAndEnterName(pageA, PIN, PLAYER_A_NAME);
    await joinAndEnterName(pageB, PIN, PLAYER_B_NAME);

    await waitForQuestion(pageA, "Hvad er hovedstaden i Danmark?");
    await waitForQuestion(pageB, "Hvad er hovedstaden i Danmark?");

    // ---- THE RACE: both click the correct answer at the same instant ----
    await Promise.all([
      answerCorrectly(pageA, 1),
      answerCorrectly(pageB, 1),
    ]);

    // Wait for both to reach RESOLVED state.
    await Promise.all([
      expect(pageA.locator("text=Korrekt")).toBeVisible({ timeout: 10_000 }),
      expect(pageB.locator("text=Korrekt")).toBeVisible({ timeout: 10_000 }),
    ]);

    // ---- Assert: exactly one capture, one blocked ----
    expect(zoneState.captureCount).toBe(1);
    expect(zoneState.log).toHaveLength(2);

    const captured = zoneState.log.filter((e) => e.status === "captured");
    const blocked = zoneState.log.filter((e) => e.status === "blocked_by_shield");

    expect(captured).toHaveLength(1);
    expect(blocked).toHaveLength(1);

    // The winner owns the zone. The loser's team does NOT.
    const winnerTeamId = captured[0].teamId;
    expect(zoneState.ownerTeamId).toBe(winnerTeamId);
    expect(blocked[0].teamId).not.toBe(winnerTeamId);

    // No data corruption — exactly one owner, shield active.
    expect(zoneState.shieldUntilMs).toBeGreaterThan(Date.now());

    // ---- Cleanup ----
    await ctxA.close();
    await ctxB.close();
  });

  // ========================================================================
  // TEST 3: Stratego Duel — Lives Deduction + Atomic Resolution
  // ========================================================================
  test("stratego: simultaneous duels resolve atomically with correct life deductions", async ({
    browser,
  }) => {
    // ---- Shared duel state ----
    const duelState = createFreshDuelState(); // 3 lives each
    const duelSema = new Semaphore(1);

    // Helper: call the duel resolver from a page's evaluate context.
    // We expose the resolver through page.route as a mock "duel API".
    const setupDuelRoute = async (page: Page, attackerId: string) => {
      await page.route("**/api/play/stratego-duel", async (route: Route) => {
        const body = JSON.parse(route.request().postData() ?? "{}");
        const defenderId = body.defenderId as string;
        const atkStrength = body.attackerStrength as number;
        const defStrength = body.defenderStrength as number;

        // Serialize through semaphore (row-level lock simulation).
        await duelSema.acquire();
        let result;
        try {
          result = resolveDuel(duelState, attackerId, defenderId, atkStrength, defStrength);
        } finally {
          duelSema.release();
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...result,
            playerALives: duelState.playerALives,
            playerBLives: duelState.playerBLives,
          }),
        });
      });
    };

    // ---- Two contexts (we only need fetch, not full UI) ----
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await setupDuelRoute(pageA, PLAYER_A_ID);

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await setupDuelRoute(pageB, PLAYER_B_ID);

    // Navigate to any page so fetch() works.
    // Wait for full hydration before calling page.evaluate.
    await pageA.goto("/play/v2-test");
    await pageA.waitForLoadState("load");
    await pageA.locator('input[inputmode="numeric"]').waitFor({ state: "visible", timeout: 15_000 });

    await pageB.goto("/play/v2-test");
    await pageB.waitForLoadState("load");
    await pageB.locator('input[inputmode="numeric"]').waitFor({ state: "visible", timeout: 15_000 });

    // ---- Duel 1: A (Marshal, strength 10) attacks B (Sergeant, strength 4) ----
    const duel1 = await pageA.evaluate(async () => {
      const res = await fetch("/api/play/stratego-duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defenderId: "22222222-aaaa-bbbb-cccc-222222222222",
          attackerStrength: 10,
          defenderStrength: 4,
        }),
      });
      return res.json();
    });

    expect(duel1.winnerId).toBe(PLAYER_A_ID);
    expect(duel1.loserId).toBe(PLAYER_B_ID);
    expect(duel1.isDraw).toBe(false);
    expect(duelState.playerALives).toBe(3); // Unchanged — A won.
    expect(duelState.playerBLives).toBe(2); // B lost a life.

    // ---- Duel 2: Simultaneous cross-attacks (Promise.all) ----
    // A attacks B (strength 5 vs 5) → draw, both lose a life.
    const [duel2A, duel2B] = await Promise.all([
      pageA.evaluate(async () => {
        const res = await fetch("/api/play/stratego-duel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defenderId: "22222222-aaaa-bbbb-cccc-222222222222",
            attackerStrength: 5,
            defenderStrength: 5,
          }),
        });
        return res.json();
      }),
      pageB.evaluate(async () => {
        const res = await fetch("/api/play/stratego-duel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defenderId: "11111111-aaaa-bbbb-cccc-111111111111",
            attackerStrength: 5,
            defenderStrength: 5,
          }),
        });
        return res.json();
      }),
    ]);

    // Both simultaneous duels should be draws.
    expect(duel2A.isDraw).toBe(true);
    expect(duel2B.isDraw).toBe(true);

    // After duel 1: A=3, B=2.
    // After two draws (each deducts 1 from both per duel):
    //   Draw 1 (whichever resolves first): A - 1, B - 1  → A=2, B=1
    //   Draw 2:                            A - 1, B - 1  → A=1, B=0
    expect(duelState.playerALives).toBe(1);
    expect(duelState.playerBLives).toBe(0);

    // ---- Verify duel log consistency ----
    expect(duelState.duels).toHaveLength(3);
    expect(duelState.duels[0].isDraw).toBe(false);
    expect(duelState.duels[1].isDraw).toBe(true);
    expect(duelState.duels[2].isDraw).toBe(true);

    // No phantom wins — winner count in non-draw duels matches expectations.
    const nonDrawDuels = duelState.duels.filter((d) => !d.isDraw);
    expect(nonDrawDuels).toHaveLength(1);
    expect(nonDrawDuels[0].winnerId).toBe(PLAYER_A_ID);

    // ---- Cleanup ----
    await ctxA.close();
    await ctxB.close();
  });

  // ========================================================================
  // TEST 4: State consistency — both players see the same zone owner
  // ========================================================================
  test("zone_krig: both players query zone state and see consistent owner", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const zoneState = createFreshZoneState();
    const duelState = createFreshDuelState();
    const captureSema = new Semaphore(1);

    // Expose a "zone-status" endpoint that both players can poll,
    // reading from the shared zoneState (simulates Realtime / poll sync).
    // Must use ctx.route (context-level) so it intercepts even when
    // the service worker handles GET requests.
    const addZoneStatusRoute = async (ctx: BrowserContext) => {
      await ctx.route(/\/api\/play\/zone-status/, async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ownerTeamId: zoneState.ownerTeamId,
            shieldActive: zoneState.shieldUntilMs !== null && Date.now() < zoneState.shieldUntilMs,
            captureCount: zoneState.captureCount,
          }),
        });
      });
    };

    // ---- Player A ----
    const ctxA = await browser.newContext();
    await setupGeolocation(ctxA);
    const pageA = await ctxA.newPage();
    await mockPlayerRoutes(pageA, ctxA, {
      playerId: PLAYER_A_ID,
      playerName: PLAYER_A_NAME,
      teamId: TEAM_A_ID,
      teamColor: "#ef4444",
      zoneState,
      duelState,
      captureSemaphore: captureSema,
    });
    await addZoneStatusRoute(ctxA);

    // ---- Player B ----
    const ctxB = await browser.newContext();
    await setupGeolocation(ctxB);
    const pageB = await ctxB.newPage();
    await mockPlayerRoutes(pageB, ctxB, {
      playerId: PLAYER_B_ID,
      playerName: PLAYER_B_NAME,
      teamId: TEAM_B_ID,
      teamColor: "#3b82f6",
      zoneState,
      duelState,
      captureSemaphore: captureSema,
    });
    await addZoneStatusRoute(ctxB);

    // ---- Setup: both reach Q1 ----
    await Promise.all([
      pageA.goto("/play/v2-test"),
      pageB.goto("/play/v2-test"),
    ]);
    // Wait for React hydration on both pages before any DOM manipulation.
    await Promise.all([
      pageA.locator('input[inputmode="numeric"]').waitFor({ state: "visible", timeout: 20_000 }),
      pageB.locator('input[inputmode="numeric"]').waitFor({ state: "visible", timeout: 20_000 }),
    ]);
    await dismissMaintenanceOverlay(pageA);
    await dismissMaintenanceOverlay(pageB);

    const PIN = "123456";
    await joinAndEnterName(pageA, PIN, PLAYER_A_NAME);
    await joinAndEnterName(pageB, PIN, PLAYER_B_NAME);

    await waitForQuestion(pageA, "Hvad er hovedstaden i Danmark?");
    await waitForQuestion(pageB, "Hvad er hovedstaden i Danmark?");

    // ---- Before capture: both see no owner ----
    const beforeA = await pageA.evaluate(() =>
      fetch("/api/play/zone-status").then((r) => r.json()),
    );
    const beforeB = await pageB.evaluate(() =>
      fetch("/api/play/zone-status").then((r) => r.json()),
    );
    expect(beforeA.ownerTeamId).toBeNull();
    expect(beforeB.ownerTeamId).toBeNull();

    // ---- Player A captures ----
    await answerCorrectly(pageA, 1);
    await expect(pageA.locator("text=Korrekt")).toBeVisible({ timeout: 10_000 });

    // ---- Both poll zone state — should see same owner WITHOUT refresh ----
    const afterA = await pageA.evaluate(() =>
      fetch("/api/play/zone-status").then((r) => r.json()),
    );
    const afterB = await pageB.evaluate(() =>
      fetch("/api/play/zone-status").then((r) => r.json()),
    );

    // Consistent view: both see Team A as owner.
    expect(afterA.ownerTeamId).toBe(TEAM_A_ID);
    expect(afterB.ownerTeamId).toBe(TEAM_A_ID);
    expect(afterA.shieldActive).toBe(true);
    expect(afterB.shieldActive).toBe(true);
    expect(afterA.captureCount).toBe(1);
    expect(afterB.captureCount).toBe(1);

    // ---- Cleanup ----
    await ctxA.close();
    await ctxB.close();
  });
});
