/**
 * Backend stress test: 25 concurrent POST /api/play/submit-answer requests.
 *
 * Usage:
 *   node tests/stress-backend.js --session-id <SESSION_ID> [options]
 *
 * Options:
 *   --base-url <url>       Base URL of the running Next.js app (default: http://localhost:3000)
 *   --count <n>            Number of concurrent participants (default: 25)
 *   --post-index <n>       0-based post index to answer (default: 0)
 *   --help                 Show usage
 *
 * Prerequisites:
 *   - A live session must be active at the given session ID.
 *   - The Next.js dev/prod server must be running at --base-url.
 */

import { performance } from "node:perf_hooks";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_COUNT = 25;
const DEFAULT_POST_INDEX = 0;
const DEFAULT_LAT = 55.6761;
const DEFAULT_LNG = 12.5683;

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function usage() {
  return `
Usage:
  node tests/stress-backend.mjs --session-id <SESSION_ID> [options]

Options:
  --base-url <url>       Base URL (default: ${DEFAULT_BASE_URL})
  --count <n>            Concurrent participants (default: ${DEFAULT_COUNT})
  --post-index <n>       0-based question index (default: ${DEFAULT_POST_INDEX})
  --help                 Show this help
`.trim();
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * POST JSON and return { ok, status, body, ms, cookies }.
 * `cookies` is the raw Set-Cookie header array (needed for auth forwarding).
 */
async function postJson(url, payload, cookieHeader = null) {
  const headers = { "Content-Type": "application/json" };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      redirect: "manual",
    });

    const ms = performance.now() - start;
    const contentType = res.headers.get("content-type") ?? "";
    const body =
      res.status === 204
        ? null
        : contentType.includes("application/json")
          ? await res.json().catch(() => null)
          : await res.text().catch(() => null);

    // Collect Set-Cookie headers (may be multiple)
    const cookies = res.headers.getSetCookie?.() ?? [];

    return { ok: res.ok, status: res.status, body, ms, cookies };
  } catch (err) {
    return {
      ok: false,
      status: "NETWORK",
      body: { error: err.message },
      ms: performance.now() - start,
      cookies: [],
    };
  }
}

/**
 * Collapse Set-Cookie headers into a single Cookie header string
 * by extracting name=value from each entry.
 */
function buildCookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .map((header) => header.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Barrier for synchronized concurrent release
// ---------------------------------------------------------------------------

function createBarrier() {
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  return { wait, release: () => release?.() };
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function avg(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function p95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)];
}

function statusCounts(items) {
  const counts = {};
  for (const item of items) {
    const key = String(item.status);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const baseUrl = (args["base-url"] || DEFAULT_BASE_URL).replace(/\/$/, "");
  const sessionId = args["session-id"];
  if (!sessionId) {
    console.error("Error: --session-id is required.\n");
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const count = args.count ? Number.parseInt(args.count, 10) : DEFAULT_COUNT;
  const postIndex = args["post-index"] !== undefined ? Number.parseInt(args["post-index"], 10) : DEFAULT_POST_INDEX;

  if (!Number.isInteger(count) || count < 1) {
    console.error("Error: --count must be a positive integer.");
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("Stress-test configuration");
  console.log(`  Base URL:     ${baseUrl}`);
  console.log(`  Session ID:   ${sessionId}`);
  console.log(`  Participants: ${count}`);
  console.log(`  Post index:   ${postIndex}`);
  console.log("");

  // -----------------------------------------------------------------------
  // Phase 1: Join participants (sequential — each needs its own auth session)
  // -----------------------------------------------------------------------
  console.log(`Phase 1: Joining ${count} participants via /api/join ...`);

  const participants = [];
  // Keep names ≤ 20 chars (join route enforces max 20)
  const shortStamp = String(Date.now()).slice(-6);

  for (let i = 0; i < count; i++) {
    const studentName = `S${shortStamp}-${String(i + 1).padStart(2, "0")}`;
    const result = await postJson(`${baseUrl}/api/join`, {
      sessionId,
      studentName,
    });

    if (!result.ok) {
      console.error(`  [${i + 1}] JOIN FAILED (${result.status}):`, result.body);
      continue;
    }

    const cookieHeader = buildCookieHeader(result.cookies);
    if (!cookieHeader) {
      console.error(`  [${i + 1}] JOIN OK but no cookies returned — auth will fail.`);
      continue;
    }

    participants.push({
      index: i + 1,
      studentName,
      participantId: result.body?.participantId ?? null,
      sessionId: result.body?.sessionId ?? sessionId,
      cookieHeader,
      joinMs: result.ms,
    });
  }

  console.log(`  Joined: ${participants.length}/${count}`);
  if (participants.length === 0) {
    console.error("No participants joined successfully. Aborting.");
    process.exitCode = 1;
    return;
  }

  const joinLatencies = participants.map((p) => p.joinMs);
  console.log(
    `  Join latency: avg ${avg(joinLatencies).toFixed(0)} ms, p95 ${p95(joinLatencies).toFixed(0)} ms, max ${Math.max(...joinLatencies).toFixed(0)} ms`
  );
  console.log("");

  // -----------------------------------------------------------------------
  // Phase 2: Fire concurrent submit-answer requests
  // -----------------------------------------------------------------------
  console.log(`Phase 2: Firing ${participants.length} concurrent POST /api/play/submit-answer ...`);

  const barrier = createBarrier();
  const answeredAt = new Date().toISOString();

  const submitPromises = participants.map(async (p) => {
    // Wait for barrier so all requests fire simultaneously
    await barrier.wait;

    const workerStart = performance.now();

    const payload = {
      payloads: [
        {
          session_id: p.sessionId,
          participant_id: p.participantId,
          student_name: p.studentName,
          post_index: postIndex + 1,
          question_index: postIndex,
          selected_index: 0,
          answer_index: 0,
          is_correct: true,
          answered_at: answeredAt,
          lat: DEFAULT_LAT + p.index * 0.00001,
          lng: DEFAULT_LNG + p.index * 0.00001,
        },
      ],
    };

    const result = await postJson(
      `${baseUrl}/api/play/submit-answer`,
      payload,
      p.cookieHeader
    );

    return {
      participant: p.studentName,
      ok: result.ok,
      status: result.status,
      body: result.body,
      ms: performance.now() - workerStart,
    };
  });

  // Release the barrier — all promises fire concurrently
  barrier.release();
  const submitResults = await Promise.all(submitPromises);
  console.log("  Done.\n");

  // -----------------------------------------------------------------------
  // Phase 3: Report
  // -----------------------------------------------------------------------
  const successes = submitResults.filter((r) => r.ok);
  const failures = submitResults.filter((r) => !r.ok);
  const latencies = submitResults.map((r) => r.ms);

  console.log("=== STRESS-TEST REPORT ===");
  console.log(`Concurrent requests: ${submitResults.length}`);
  console.log(`Successes: ${successes.length}`);
  console.log(`Failures:  ${failures.length}`);
  console.log(`Status codes: ${JSON.stringify(statusCounts(submitResults))}`);
  console.log("");

  console.log("Latency (submit-answer):");
  console.log(`  Avg: ${avg(latencies).toFixed(0)} ms`);
  console.log(`  P95: ${p95(latencies).toFixed(0)} ms`);
  console.log(`  Max: ${Math.max(...latencies).toFixed(0)} ms`);
  console.log(`  Min: ${Math.min(...latencies).toFixed(0)} ms`);
  console.log("");

  if (failures.length > 0) {
    console.log("Failed requests:");
    for (const f of failures.slice(0, 10)) {
      const errorMsg =
        f.body?.error ?? (typeof f.body === "string" ? f.body.slice(0, 200) : JSON.stringify(f.body)?.slice(0, 200));
      console.log(`  [${f.participant}] ${f.status} — ${errorMsg}`);
    }
    if (failures.length > 10) {
      console.log(`  ... and ${failures.length - 10} more.`);
    }
    console.log("");
  }

  // Check for locked (duplicate) responses
  const lockedResults = successes.filter((r) => r.body?.isLocked === true);
  const insertedResults = successes.filter((r) => r.body?.inserted === true);
  console.log("Duplicate handling:");
  console.log(`  inserted=true responses: ${insertedResults.length}`);
  console.log(`  isLocked=true responses: ${lockedResults.length}`);
  console.log("");

  // Verdict
  const has500 = submitResults.some((r) => r.status === 500);
  const hasNetwork = submitResults.some((r) => r.status === "NETWORK");

  if (!has500 && !hasNetwork && failures.length === 0) {
    console.log("VERDICT: PASS — No 500 errors, no network failures.");
  } else if (has500) {
    console.log("VERDICT: FAIL — One or more 500 errors detected.");
    process.exitCode = 1;
  } else if (hasNetwork) {
    console.log("VERDICT: FAIL — Network errors (is the server running?).");
    process.exitCode = 1;
  } else {
    console.log(`VERDICT: WARN — ${failures.length} non-200 responses (check status codes above).`);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exitCode = 1;
});
