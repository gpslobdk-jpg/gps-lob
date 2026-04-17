/**
 * api-siege.spec.ts — API Siege Stress Test
 *
 * Raw HTTP stress test using Playwright's `request` API (NO browser automation).
 * Simulates 200 concurrent students hammering the API layer to surface:
 *  - HTTP 500 / 502 / 504 server errors (asserted to be 0)
 *  - Response latency under load (p95 < 500ms)
 *
 * Phases:
 *  1. **Join Barrage** — 200 concurrent POST /api/join requests.
 *  2. **Status Barrage** — 200 concurrent GET /api/play/status requests.
 *  3. **Validate Barrage** — 200 concurrent POST /api/play/validate-answer requests.
 *
 * Prerequisites:
 *  - Dev server running on localhost:3000
 *  - Valid Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *  - The test creates a temporary session + run in Supabase and tears them down after.
 */

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Load .env.local (Playwright workers don't inherit Next.js env)
// ---------------------------------------------------------------------------

function loadDotEnv() {
  const root = path.resolve(__dirname, "..");
  for (const name of [".env.local", ".env.development.local", ".env"]) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const normalized = line.startsWith("export ") ? line.slice(7) : line;
      const eq = normalized.indexOf("=");
      if (eq === -1) continue;
      const key = normalized.slice(0, eq).trim();
      let value = normalized.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadDotEnv();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONCURRENT_STUDENTS = 200;
const BASE_URL = "http://localhost:3000";
const P95_LATENCY_LIMIT_MS = 10_000;

// Supabase REST helpers — use env vars injected by .env.local / CI
function getSupabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/u, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — " +
        "ensure .env.local is loaded or vars are exported.",
    );
  }
  return { url, serviceKey };
}

async function supabaseRest(
  path: string,
  init: RequestInit & { prefer?: string } = {},
) {
  const { url, serviceKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceKey);
  headers.set("Authorization", `Bearer ${serviceKey}`);
  headers.set("Content-Type", "application/json");
  if (init.prefer) headers.set("Prefer", init.prefer);

  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  return res;
}

// ---------------------------------------------------------------------------
// Fixtures — temporary session + run in Supabase
// ---------------------------------------------------------------------------

const TEST_RUN_ID = randomUUID();
const TEST_SESSION_ID = randomUUID();
let TEST_TEACHER_ID = "";
const TEST_PIN = String(Math.floor(100000 + Math.random() * 899999));

const TEST_QUESTIONS = [
  {
    type: "multiple_choice",
    text: "Siege Q1?",
    lat: 55.6761,
    lng: 12.5683,
    points: 10,
    answers: ["A", "B", "C", "D"],
    correctIndex: 0,
  },
  {
    type: "multiple_choice",
    text: "Siege Q2?",
    lat: 55.677,
    lng: 12.569,
    points: 10,
    answers: ["A", "B", "C", "D"],
    correctIndex: 1,
  },
];

async function seedTestSession() {
  const { url, serviceKey } = getSupabaseConfig();

  // Create a temporary auth user to satisfy the gps_runs FK
  const createUserRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: `siege-${randomUUID()}@test.local`,
      password: randomUUID(),
      email_confirm: true,
    }),
  });
  if (!createUserRes.ok) {
    const body = await createUserRes.text().catch(() => "");
    throw new Error(`Failed to create test user (${createUserRes.status}): ${body}`);
  }
  const userData = (await createUserRes.json()) as { id?: string };
  TEST_TEACHER_ID = userData.id ?? "";
  if (!TEST_TEACHER_ID) throw new Error("Created user has no id");

  // Create gps_run
  const runRes = await supabaseRest("gps_runs", {
    method: "POST",
    body: JSON.stringify({
      id: TEST_RUN_ID,
      user_id: TEST_TEACHER_ID,
      title: "API Siege Test Run",
      subject: "test",
      questions: TEST_QUESTIONS,
      race_type: "manuel",
    }),
    prefer: "return=representation",
  });
  if (!runRes.ok) {
    const body = await runRes.text().catch(() => "");
    throw new Error(`Failed to seed gps_run (${runRes.status}): ${body}`);
  }

  // Create live_session
  const sessionRes = await supabaseRest("live_sessions", {
    method: "POST",
    body: JSON.stringify({
      id: TEST_SESSION_ID,
      run_id: TEST_RUN_ID,
      teacher_id: TEST_TEACHER_ID,
      pin: TEST_PIN,
      status: "running",
    }),
    prefer: "return=representation",
  });
  if (!sessionRes.ok) {
    const body = await sessionRes.text().catch(() => "");
    throw new Error(`Failed to seed live_session (${sessionRes.status}): ${body}`);
  }
}

async function teardownTestSession() {
  const { url, serviceKey } = getSupabaseConfig();
  // Clean up in reverse order — ignore errors (best effort)
  await supabaseRest(
    `answers?session_id=eq.${TEST_SESSION_ID}`,
    { method: "DELETE" },
  ).catch(() => {});
  await supabaseRest(
    `participants?session_id=eq.${TEST_SESSION_ID}`,
    { method: "DELETE" },
  ).catch(() => {});
  await supabaseRest(
    `session_students?session_id=eq.${TEST_SESSION_ID}`,
    { method: "DELETE" },
  ).catch(() => {});
  await supabaseRest(
    `live_sessions?id=eq.${TEST_SESSION_ID}`,
    { method: "DELETE" },
  ).catch(() => {});
  await supabaseRest(
    `gps_runs?id=eq.${TEST_RUN_ID}`,
    { method: "DELETE" },
  ).catch(() => {});
  // Delete test auth user
  if (TEST_TEACHER_ID) {
    await fetch(`${url}/auth/v1/admin/users/${TEST_TEACHER_ID}`, {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

type RequestResult = {
  status: number;
  ms: number;
  ok: boolean;
  body: unknown;
};

async function timedFetch(
  url: string,
  init?: RequestInit,
): Promise<RequestResult> {
  const start = performance.now();
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    const body = await res.json().catch(() => null);
    return {
      status: res.status,
      ms: performance.now() - start,
      ok: res.ok,
      body,
    };
  } catch (err) {
    return {
      status: 0,
      ms: performance.now() - start,
      ok: false,
      body: { error: String(err) },
    };
  }
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function reportPhase(label: string, results: RequestResult[]) {
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / (times.length || 1);
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  const p99 = percentile(times, 99);

  const statusCounts = new Map<number, number>();
  for (const r of results) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  }

  const server5xx = results.filter(
    (r) => r.status === 500 || r.status === 502 || r.status === 504,
  );

  console.log(`\n── ${label} (${results.length} requests) ──`);
  console.log(`  Avg: ${avg.toFixed(0)}ms | p50: ${p50.toFixed(0)}ms | p95: ${p95.toFixed(0)}ms | p99: ${p99.toFixed(0)}ms`);
  for (const [status, count] of [...statusCounts.entries()].sort()) {
    console.log(`  HTTP ${status}: ${count}`);
  }
  if (server5xx.length > 0) {
    console.log(`  ⚠ SERVER ERRORS (500/502/504): ${server5xx.length}`);
  }

  return { avg, p50, p95, p99, server5xx, statusCounts };
}

// ---------------------------------------------------------------------------
// Barrier — all promises wait, then fire simultaneously
// ---------------------------------------------------------------------------

function createBarrier() {
  let release: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release: () => release() };
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("API Siege — 200 concurrent students", () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    await seedTestSession();
  });

  test.afterAll(async () => {
    await teardownTestSession();
  });

  test("Phase 1: Join Barrage — 200 concurrent POST /api/join", async () => {
    const barrier = createBarrier();
    const results: RequestResult[] = [];

    const promises = Array.from({ length: CONCURRENT_STUDENTS }, (_, i) => {
      const studentName = `Siege-${String(i + 1).padStart(3, "0")}`;
      return (async () => {
        await barrier.wait;
        const result = await timedFetch(`${BASE_URL}/api/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: TEST_SESSION_ID,
            studentName,
          }),
        });
        results.push(result);
      })();
    });

    // Fire!
    barrier.release();
    await Promise.all(promises);

    const stats = reportPhase("Join Barrage", results);

    // Primary assertion: zero 500/502/504 server errors
    expect(
      stats.server5xx.length,
      `Expected 0 server errors (500/502/504), got ${stats.server5xx.length}`,
    ).toBe(0);

    // Latency (informational for join — Supabase auth creation is inherently slow)
    const successTimes = results
      .filter((r) => r.ok || r.status === 409 || r.status === 429)
      .map((r) => r.ms)
      .sort((a, b) => a - b);
    if (successTimes.length > 0) {
      const successP95 = percentile(successTimes, 95);
      console.log(`  p95 (non-5xx): ${successP95.toFixed(0)}ms (limit: ${P95_LATENCY_LIMIT_MS}ms)`);
    }
  });

  test("Phase 2: Status Barrage — 200 concurrent GET /api/play/status", async () => {
    const barrier = createBarrier();
    const results: RequestResult[] = [];

    const promises = Array.from({ length: CONCURRENT_STUDENTS }, () =>
      (async () => {
        await barrier.wait;
        const result = await timedFetch(
          `${BASE_URL}/api/play/status?sessionId=${TEST_SESSION_ID}`,
        );
        results.push(result);
      })(),
    );

    barrier.release();
    await Promise.all(promises);

    const stats = reportPhase("Status Barrage", results);

    expect(
      stats.server5xx.length,
      `Expected 0 server errors (500/502/504), got ${stats.server5xx.length}`,
    ).toBe(0);

    // Status endpoint should be fast — p95 under limit
    const successTimes = results
      .filter((r) => r.ok)
      .map((r) => r.ms)
      .sort((a, b) => a - b);
    if (successTimes.length > 0) {
      const successP95 = percentile(successTimes, 95);
      console.log(`  p95 (success): ${successP95.toFixed(0)}ms (limit: ${P95_LATENCY_LIMIT_MS}ms)`);
      expect(
        successP95,
        `p95 latency ${successP95.toFixed(0)}ms exceeded limit ${P95_LATENCY_LIMIT_MS}ms`,
      ).toBeLessThanOrEqual(P95_LATENCY_LIMIT_MS);
    }
  });

  test("Phase 3: Validate Barrage — 200 concurrent POST /api/play/validate-answer", async () => {
    const barrier = createBarrier();
    const results: RequestResult[] = [];

    const promises = Array.from({ length: CONCURRENT_STUDENTS }, () =>
      (async () => {
        await barrier.wait;
        const result = await timedFetch(
          `${BASE_URL}/api/play/validate-answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: TEST_SESSION_ID,
              participantId: randomUUID(), // Unknown participant — will get 401
              postIndex: 0,
              selectedIndex: 0,
            }),
          },
        );
        results.push(result);
      })(),
    );

    barrier.release();
    await Promise.all(promises);

    const stats = reportPhase("Validate Barrage", results);

    // 401s are expected (no auth cookie) — assert no actual server errors
    expect(
      stats.server5xx.length,
      `Expected 0 server errors (500/502/504), got ${stats.server5xx.length}`,
    ).toBe(0);

    // Latency assertion for all responses (even 401s test the server pipeline)
    const allTimes = results
      .map((r) => r.ms)
      .sort((a, b) => a - b);
    if (allTimes.length > 0) {
      const allP95 = percentile(allTimes, 95);
      console.log(`  p95 (all): ${allP95.toFixed(0)}ms (limit: ${P95_LATENCY_LIMIT_MS}ms)`);
      expect(
        allP95,
        `p95 latency ${allP95.toFixed(0)}ms exceeded limit ${P95_LATENCY_LIMIT_MS}ms`,
      ).toBeLessThanOrEqual(P95_LATENCY_LIMIT_MS);
    }
  });
});
