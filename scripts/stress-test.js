/**
 * Usage:
 *   node scripts/stress-test.js 123456
 *   node scripts/stress-test.js 123456 http://localhost:3000 100 75
 *
 * Arguments:
 *   1. PIN code (required, 6 digits)
 *   2. Base URL (optional, default: http://localhost:3000)
 *   3. Student count (optional, default: 100)
 *   4. Delay in ms between join requests (optional, default: 75)
 *
 * Example:
 *   node scripts/stress-test.js 482931 http://localhost:3000 100 60
 *
 * Make sure your local Next.js server is running before you start the test.
 */

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_STUDENT_COUNT = 100;
const DEFAULT_DELAY_MS = 75;
const DEFAULT_NAME_PREFIX = "Test Elev";

function parsePositiveInteger(value, fallback) {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePin(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function normalizeBaseUrl(value) {
  const trimmed = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_BASE_URL;
  return trimmed.replace(/\/$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function resolveSessionFromPin(baseUrl, pin) {
  const response = await fetch(`${baseUrl}/api/join?pin=${encodeURIComponent(pin)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-store",
    },
    cache: "no-store",
  });

  const payload = await readJsonSafely(response);

  if (!response.ok) {
    const reason =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : `PIN lookup failed with status ${response.status}`;
    throw new Error(reason);
  }

  if (!payload || payload.kind !== "active" || typeof payload.sessionId !== "string") {
    throw new Error("PIN lookup did not return an active session.");
  }

  return {
    sessionId: payload.sessionId,
    sessionStatus: typeof payload.sessionStatus === "string" ? payload.sessionStatus : "unknown",
    runTitle: typeof payload.runTitle === "string" ? payload.runTitle : "",
  };
}

async function joinStudent(baseUrl, sessionId, studentName) {
  const response = await fetch(`${baseUrl}/api/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({
      sessionId,
      studentName,
    }),
  });

  const payload = await readJsonSafely(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error:
        payload && typeof payload === "object" && typeof payload.error === "string"
          ? payload.error
          : `Join failed with status ${response.status}`,
    };
  }

  return {
    ok: true,
    status: response.status,
    participantId:
      payload && typeof payload === "object" && typeof payload.participantId === "string"
        ? payload.participantId
        : null,
  };
}

async function main() {
  const pin = normalizePin(process.argv[2]);
  const baseUrl = normalizeBaseUrl(process.argv[3]);
  const studentCount = parsePositiveInteger(process.argv[4], DEFAULT_STUDENT_COUNT);
  const delayMs = parsePositiveInteger(process.argv[5], DEFAULT_DELAY_MS);
  const namePrefix = process.env.STRESS_TEST_NAME_PREFIX?.trim() || DEFAULT_NAME_PREFIX;

  if (pin.length !== 6) {
    console.error("Missing or invalid PIN. Usage: node scripts/stress-test.js 123456");
    process.exit(1);
  }

  console.log("");
  console.log("Stress test starting...");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`PIN: ${pin}`);
  console.log(`Students: ${studentCount}`);
  console.log(`Delay: ${delayMs}ms`);

  const sessionInfo = await resolveSessionFromPin(baseUrl, pin);

  console.log(`Session: ${sessionInfo.sessionId}`);
  console.log(`Status: ${sessionInfo.sessionStatus}`);
  if (sessionInfo.runTitle) {
    console.log(`Run: ${sessionInfo.runTitle}`);
  }
  console.log("");

  const startedAt = Date.now();
  let successCount = 0;
  const failures = [];

  for (let index = 1; index <= studentCount; index += 1) {
    if (index > 1) {
      await sleep(delayMs);
    }

    const studentName = `${namePrefix} ${index}`;
    const result = await joinStudent(baseUrl, sessionInfo.sessionId, studentName);

    if (result.ok) {
      successCount += 1;
    } else {
      failures.push({
        studentName,
        status: result.status,
        error: result.error,
      });
    }

    if (index === 1 || index === studentCount || index % 10 === 0) {
      console.log(
        `[${index}/${studentCount}] joined=${successCount} failed=${failures.length} last="${studentName}"`
      );
    }
  }

  const durationMs = Date.now() - startedAt;

  console.log("");
  console.log("Stress test finished.");
  console.log(`Successful joins: ${successCount}/${studentCount}`);
  console.log(`Failed joins: ${failures.length}`);
  console.log(`Duration: ${(durationMs / 1000).toFixed(2)}s`);

  if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const failure of failures.slice(0, 10)) {
      console.log(`- ${failure.studentName} (${failure.status}): ${failure.error}`);
    }

    if (failures.length > 10) {
      console.log(`- ... and ${failures.length - 10} more`);
    }

    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("");
  console.error("Stress test aborted.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
