import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const APP_BASE_URL = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/u, "");
const LOCAL_ENV_PATH = path.join(process.cwd(), ".env.local");
const TEST_TIMEOUT_MS = 90_000;

type LocalConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

type Fixture = {
  runId: string;
  sessionId: string;
  teacherId: string;
};

function isLocalUrl(value: string | undefined) {
  return /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/|$)/u.test(value ?? "");
}

function loadLocalEnv() {
  if (!existsSync(LOCAL_ENV_PATH)) return;

  for (const rawLine of readFileSync(LOCAL_ENV_PATH, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7) : line;
    const separator = normalized.indexOf("=");
    if (separator === -1) continue;

    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function getLocalConfig(): LocalConfig | null {
  loadLocalEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!isLocalUrl(APP_BASE_URL) || !isLocalUrl(supabaseUrl) || !serviceRoleKey) {
    return null;
  }

  return { supabaseUrl, serviceRoleKey };
}

function adminClient(config: LocalConfig) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createFixture(admin: SupabaseClient): Promise<Fixture> {
  const teacher = await admin.auth.admin.createUser({
    email: `join-idempotency-${randomUUID()}@isolated.invalid`,
    password: `Local-${randomUUID()}-A1!`,
    email_confirm: true,
  });
  if (teacher.error || !teacher.data.user?.id) {
    throw teacher.error ?? new Error("Kunne ikke oprette syntetisk lærer.");
  }

  const runId = randomUUID();
  const sessionId = randomUUID();
  const { error: runError } = await admin.from("gps_runs").insert({
    id: runId,
    user_id: teacher.data.user.id,
    title: `Join-idempotency ${runId.slice(0, 8)}`,
    subject: "Test",
    questions: [],
    race_type: "manuel",
  });
  if (runError) throw runError;

  const { error: sessionError } = await admin.from("live_sessions").insert({
    id: sessionId,
    run_id: runId,
    teacher_id: teacher.data.user.id,
    pin: String(Math.floor(100_000 + Math.random() * 900_000)),
    status: "running",
  });
  if (sessionError) throw sessionError;

  return { runId, sessionId, teacherId: teacher.data.user.id };
}

async function deleteFixture(admin: SupabaseClient, fixture: Fixture | null, authUserIds: Set<string>) {
  if (!fixture) return;

  const { data: participantRows } = await admin
    .from("participants")
    .select("auth_user_id")
    .eq("session_id", fixture.sessionId);
  for (const row of participantRows ?? []) {
    if (typeof row.auth_user_id === "string" && row.auth_user_id) {
      authUserIds.add(row.auth_user_id);
    }
  }

  // All deletes are scoped to UUIDs created by this test's own fixture.
  await admin.from("answers").delete().eq("session_id", fixture.sessionId);
  await admin.from("participants").delete().eq("session_id", fixture.sessionId);
  await admin.from("session_students").delete().eq("session_id", fixture.sessionId);
  await admin.from("live_sessions").delete().eq("id", fixture.sessionId);
  await admin.from("gps_runs").delete().eq("id", fixture.runId);
  for (const authUserId of authUserIds) {
    await admin.auth.admin.deleteUser(authUserId);
  }
  await admin.auth.admin.deleteUser(fixture.teacherId);
}

async function postJoin(
  context: APIRequestContext,
  fixture: Fixture,
  participantId: string,
  studentName: string
) {
  return await context.post("/api/join", {
    data: { sessionId: fixture.sessionId, participantId, studentName },
  });
}

async function responseParticipantId(response: APIResponse) {
  const body = (await response.json()) as { participantId?: unknown };
  return typeof body.participantId === "string" ? body.participantId : null;
}

async function rememberParticipantAuth(response: APIResponse, authUserIds: Set<string>) {
  try {
    const key = "gpslob-participant-auth";
    const chunks = new Map<string, string>();
    for (const header of await response.headersArray()) {
      if (header.name.toLowerCase() !== "set-cookie") continue;
      const pair = header.value.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim();
      if (!new RegExp(`^${key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?:\\.\\d+)?$`).test(name)) continue;
      const value = decodeURIComponent(pair.slice(separator + 1));
      if (value) chunks.set(name, value);
    }

    const direct = chunks.get(key);
    const encoded = direct ?? [...chunks]
      .filter(([name]) => name.startsWith(`${key}.`))
      .sort(([left], [right]) => Number(left.slice(key.length + 1)) - Number(right.slice(key.length + 1)))
      .map(([, value]) => value)
      .join("");
    if (!encoded || !/^base64-[A-Za-z0-9_-]+$/u.test(encoded)) return;

    const parsed = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString("utf8")) as {
      user?: { id?: unknown };
    };
    if (typeof parsed.user?.id === "string") authUserIds.add(parsed.user.id);
  } catch {
    // Cleanup remains best effort; never log cookies or participant credentials.
  }
}

async function participantRows(admin: SupabaseClient, sessionId: string, ids: string[]) {
  const { data, error } = await admin
    .from("participants")
    .select("id,student_name,auth_user_id")
    .eq("session_id", sessionId)
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

test.describe("local join idempotency and ownership", () => {
  test.setTimeout(TEST_TIMEOUT_MS);

  test("parallel retry, lost response and same-name teams keep the correct participant identities", async () => {
    const config = getLocalConfig();
    test.skip(!config, "Kræver lokal app og lokal Supabase; hosted data må aldrig bruges.");
    if (!config) return;

    const admin = adminClient(config);
    const authUserIds = new Set<string>();
    let fixture: Fixture | null = null;
    const contexts: APIRequestContext[] = [];

    try {
      fixture = await createFixture(admin);
      const owner = await playwrightRequest.newContext({ baseURL: APP_BASE_URL });
      const foreign = await playwrightRequest.newContext({ baseURL: APP_BASE_URL });
      const sameNameA = await playwrightRequest.newContext({ baseURL: APP_BASE_URL });
      const sameNameB = await playwrightRequest.newContext({ baseURL: APP_BASE_URL });
      const parallelA = await playwrightRequest.newContext({ baseURL: APP_BASE_URL });
      const parallelB = await playwrightRequest.newContext({ baseURL: APP_BASE_URL });
      contexts.push(owner, foreign, sameNameA, sameNameB, parallelA, parallelB);

      const ownerId = randomUUID();
      const first = await postJoin(owner, fixture, ownerId, "Hold Ejer");
      await rememberParticipantAuth(first, authUserIds);
      expect(first.status()).toBeLessThan(300);
      expect(await responseParticipantId(first)).toBe(ownerId);

      // A normal retry uses the anonymous participant cookie already held by the
      // same browser context. Parallel responses must all resolve to one row.
      const [ownerRetryA, ownerRetryB] = await Promise.all([
        postJoin(owner, fixture, ownerId, "Hold Ejer"),
        postJoin(owner, fixture, ownerId, "Hold Ejer"),
      ]);
      for (const response of [ownerRetryA, ownerRetryB]) {
        await rememberParticipantAuth(response, authUserIds);
        expect(response.status()).toBeLessThan(300);
        expect(await responseParticipantId(response)).toBe(ownerId);
      }
      expect(await participantRows(admin, fixture.sessionId, [ownerId])).toHaveLength(1);

      const ownerBeforeForeignRetry = (await participantRows(admin, fixture.sessionId, [ownerId]))[0];
      expect(ownerBeforeForeignRetry?.auth_user_id).toBeTruthy();

      // This models a committed first request whose response/cookie was lost:
      // a fresh browser knows the opaque attempt id but is not its authenticated
      // owner. It must receive an explicit resolution failure, never a second
      // participant or a rebind of the existing row.
      const foreignRetry = await postJoin(foreign, fixture, ownerId, "Hold Ejer");
      await rememberParticipantAuth(foreignRetry, authUserIds);
      expect(foreignRetry.status()).toBe(409);
      const ownerAfterForeignRetry = (await participantRows(admin, fixture.sessionId, [ownerId]))[0];
      expect(ownerAfterForeignRetry?.auth_user_id).toBe(ownerBeforeForeignRetry?.auth_user_id);
      expect(await participantRows(admin, fixture.sessionId, [ownerId])).toHaveLength(1);

      // Equal display names are not an identity key: two independent devices
      // may intentionally create two participant rows with two UUIDs.
      const duplicateName = "Hold Samme Navn";
      const sameNameAId = randomUUID();
      const sameNameBId = randomUUID();
      const [sameNameAResponse, sameNameBResponse] = await Promise.all([
        postJoin(sameNameA, fixture, sameNameAId, duplicateName),
        postJoin(sameNameB, fixture, sameNameBId, duplicateName),
      ]);
      for (const response of [sameNameAResponse, sameNameBResponse]) {
        await rememberParticipantAuth(response, authUserIds);
        expect(response.status()).toBeLessThan(300);
      }
      const sameNameRows = await participantRows(admin, fixture.sessionId, [sameNameAId, sameNameBId]);
      expect(sameNameRows).toHaveLength(2);
      expect(sameNameRows.map((row) => row.student_name)).toEqual([duplicateName, duplicateName]);
      expect(new Set(sameNameRows.map((row) => row.id))).toEqual(new Set([sameNameAId, sameNameBId]));

      // Two first-time requests with an identical client attempt id can race.
      // One may win and the other must resolve as a conflict, but the database
      // must never contain two participants for that single attempt.
      const parallelId = randomUUID();
      const [parallelFirst, parallelSecond] = await Promise.all([
        postJoin(parallelA, fixture, parallelId, "Hold Parallel"),
        postJoin(parallelB, fixture, parallelId, "Hold Parallel"),
      ]);
      for (const response of [parallelFirst, parallelSecond]) {
        await rememberParticipantAuth(response, authUserIds);
      }
      expect([parallelFirst.status(), parallelSecond.status()].sort((a, b) => a - b)).toEqual([200, 409]);
      expect(await participantRows(admin, fixture.sessionId, [parallelId])).toHaveLength(1);
    } finally {
      await Promise.all(contexts.map((context) => context.dispose()));
      await deleteFixture(admin, fixture, authUserIds);
    }
  });
});
