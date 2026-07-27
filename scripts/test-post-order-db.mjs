import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

function requireLocalDatabaseConfig() {
  const urlValue =
    process.env.POST_ORDER_DB_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.POST_ORDER_DB_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey =
    process.env.POST_ORDER_DB_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!urlValue || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Local DB test not run: set POST_ORDER_DB_URL, POST_ORDER_DB_ANON_KEY and POST_ORDER_DB_SERVICE_ROLE_KEY."
    );
  }

  const url = new URL(urlValue);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const knownRemoteHost =
    hostname.endsWith(".supabase.co") ||
    hostname.endsWith(".supabase.in") ||
    hostname.includes("supabase.com");

  if (!localHosts.has(hostname) || knownRemoteHost) {
    throw new Error(
      `Refusing post-order DB test against non-local host: ${hostname}`
    );
  }

  return { url: url.origin, anonKey, serviceRoleKey, hostname };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectNoError(result, context) {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

const config = requireLocalDatabaseConfig();
const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};
const admin = createClient(config.url, config.serviceRoleKey, clientOptions);
const cleanup = {
  sessionIds: [],
  runIds: [],
  userIds: [],
};

async function verifyRequiredLocalSchema() {
  for (const table of ["gps_runs", "live_sessions", "participants"]) {
    const { error } = await admin
      .from(table)
      .select("id", { head: true, count: "exact" });
    if (error) {
      throw new Error(
        `Local DB schema is not ready: required table ${table} is unavailable (${error.message}).`
      );
    }
  }
}

async function createTeacher(label) {
  const email = `post-order-${label}-${randomUUID()}@local.test`;
  const password = `Local-${randomUUID()}-Aa1!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  const user = expectNoError(created, `create ${label} user`).user;
  assert(user?.id, `${label} user id is missing`);
  cleanup.userIds.push(user.id);

  const client = createClient(config.url, config.anonKey, clientOptions);
  expectNoError(
    await client.auth.signInWithPassword({ email, password }),
    `sign in ${label} user`
  );
  return { client, user };
}

async function createRunAndSession({
  teacherId,
  mode,
  postCount,
  raceType = "manuel",
  status = "waiting",
}) {
  const runId = randomUUID();
  const sessionId = randomUUID();
  const questions = Array.from({ length: postCount }, (_, index) => ({
    id: index + 1,
    type: "multiple_choice",
    text: `Post ${index + 1}`,
    answers: ["A", "B", "C", "D"],
    correctIndex: 0,
  }));

  expectNoError(
    await admin.from("gps_runs").insert({
      id: runId,
      user_id: teacherId,
      title: `Local post-order test ${runId}`,
      subject: "Test",
      description: "Isolated localhost integration test",
      topic: "Test",
      questions,
      race_type: raceType,
      post_order_mode: mode,
    }),
    "insert test run"
  );
  cleanup.runIds.push(runId);

  expectNoError(
    await admin.from("live_sessions").insert({
      id: sessionId,
      run_id: runId,
      teacher_id: teacherId,
      pin: String(Math.floor(100000 + Math.random() * 900000)),
      status,
      post_order_mode: mode,
      route_version: 1,
    }),
    "insert test live session"
  );
  cleanup.sessionIds.push(sessionId);

  return { runId, sessionId };
}

async function insertParticipants(sessionId, count, options = {}) {
  const baseTimestamp = Date.parse("2026-07-27T08:00:00.000Z");
  const rows = Array.from({ length: count }, (_, index) => ({
    id: options.ids?.[index] ?? randomUUID(),
    session_id: sessionId,
    student_name: `${options.prefix ?? "Hold"} ${index + 1}`,
    created_at: new Date(
      baseTimestamp + (options.sameCreatedAt ? 0 : index * 1000)
    ).toISOString(),
    start_offset: options.startOffsets?.[index] ?? null,
  }));

  expectNoError(
    await admin.from("participants").insert(rows),
    "insert test participants"
  );
  return rows;
}

async function readParticipants(sessionId) {
  return expectNoError(
    await admin
      .from("participants")
      .select("id,created_at,start_offset")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    "read test participants"
  );
}

async function readSession(sessionId) {
  return expectNoError(
    await admin
      .from("live_sessions")
      .select("status,post_order_mode,route_version")
      .eq("id", sessionId)
      .single(),
    "read test session"
  );
}

async function startSession(client, sessionId) {
  return client.rpc("start_live_session_with_post_assignments", {
    p_session_id: sessionId,
  });
}

async function verifyStartCases(teacher, intruder) {
  const fixed = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "fixed",
    postCount: 6,
  });
  await insertParticipants(fixed.sessionId, 6);
  expectNoError(
    await startSession(teacher.client, fixed.sessionId),
    "start fixed session"
  );
  assert(
    (await readParticipants(fixed.sessionId)).every(
      ({ start_offset }) => start_offset === 0
    ),
    "fixed session did not assign offset 0 to every participant"
  );

  const twelvePosts = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "distributed_circular",
    postCount: 12,
  });
  await insertParticipants(twelvePosts.sessionId, 6, {
    sameCreatedAt: true,
    ids: [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000006",
    ],
  });
  expectNoError(
    await startSession(teacher.client, twelvePosts.sessionId),
    "start 12-post session"
  );
  const deterministicOffsets = (
    await readParticipants(twelvePosts.sessionId)
  ).map(({ start_offset }) => start_offset);
  assert(
    JSON.stringify(deterministicOffsets) ===
      JSON.stringify([0, 2, 4, 6, 8, 10]),
    `unexpected deterministic offsets: ${JSON.stringify(deterministicOffsets)}`
  );
  const firstStartSnapshot = JSON.stringify(deterministicOffsets);
  expectNoError(
    await startSession(teacher.client, twelvePosts.sessionId),
    "repeat 12-post start"
  );
  assert(
    JSON.stringify(
      (await readParticipants(twelvePosts.sessionId)).map(
        ({ start_offset }) => start_offset
      )
    ) === firstStartSnapshot,
    "repeated start moved an existing participant"
  );
  const startedSession = await readSession(twelvePosts.sessionId);
  assert(startedSession.status === "running", "started session is not running");
  assert(
    deterministicOffsets.every(Number.isInteger),
    "session became running without complete assignments"
  );

  const fourPosts = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "distributed_circular",
    postCount: 4,
  });
  await insertParticipants(fourPosts.sessionId, 6);
  expectNoError(
    await startSession(teacher.client, fourPosts.sessionId),
    "start 4-post session"
  );
  const fourPostOffsets = (await readParticipants(fourPosts.sessionId)).map(
    ({ start_offset }) => start_offset
  );
  const loads = [0, 1, 2, 3].map(
    (postIndex) =>
      fourPostOffsets.filter((offset) => offset === postIndex).length
  );
  assert(
    Math.max(...loads) - Math.min(...loads) <= 1,
    `4-post load is uneven: ${JSON.stringify(loads)}`
  );

  const onePost = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "distributed_circular",
    postCount: 1,
  });
  await insertParticipants(onePost.sessionId, 6);
  expectNoError(
    await startSession(teacher.client, onePost.sessionId),
    "start 1-post session"
  );
  assert(
    (await readParticipants(onePost.sessionId)).every(
      ({ start_offset }) => start_offset === 0
    ),
    "1-post session did not assign offset 0"
  );

  const zeroPosts = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "distributed_circular",
    postCount: 0,
  });
  await insertParticipants(zeroPosts.sessionId, 2);
  const zeroPostStart = await startSession(teacher.client, zeroPosts.sessionId);
  assert(zeroPostStart.error, "0-post distributed session unexpectedly started");
  assert(
    (await readSession(zeroPosts.sessionId)).status === "waiting",
    "0-post failure left the session running"
  );
  assert(
    (await readParticipants(zeroPosts.sessionId)).every(
      ({ start_offset }) => start_offset === null
    ),
    "0-post failure partially assigned participants"
  );

  const unauthorized = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "distributed_circular",
    postCount: 4,
  });
  await insertParticipants(unauthorized.sessionId, 2);
  const unauthorizedStart = await startSession(
    intruder.client,
    unauthorized.sessionId
  );
  assert(
    unauthorizedStart.error,
    "unrelated teacher unexpectedly started the session"
  );
  assert(
    (await readSession(unauthorized.sessionId)).status === "waiting",
    "unauthorized start changed session status"
  );

  const special = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "distributed_circular",
    postCount: 4,
    raceType: "podcast",
  });
  await insertParticipants(special.sessionId, 4);
  expectNoError(
    await startSession(teacher.client, special.sessionId),
    "start special fixed session"
  );
  const specialSession = await readSession(special.sessionId);
  assert(
    specialSession.post_order_mode === "fixed",
    "special race did not fail closed to fixed"
  );
  assert(
    (await readParticipants(special.sessionId)).every(
      ({ start_offset }) => start_offset === 0
    ),
    "special race received distributed offsets"
  );
}

async function verifyLateJoinCases(teacher, intruder) {
  const distributed = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "distributed_circular",
    postCount: 6,
  });
  const [existing] = await insertParticipants(distributed.sessionId, 1);
  expectNoError(
    await startSession(teacher.client, distributed.sessionId),
    "start late-join session"
  );
  const [lateA, lateB] = await insertParticipants(distributed.sessionId, 2, {
    prefix: "Sent hold",
  });

  const concurrentResults = await Promise.all([
    admin.rpc("assign_live_participant_start_offset", {
      p_session_id: distributed.sessionId,
      p_participant_id: lateA.id,
    }),
    admin.rpc("assign_live_participant_start_offset", {
      p_session_id: distributed.sessionId,
      p_participant_id: lateB.id,
    }),
  ]);
  concurrentResults.forEach((result, index) =>
    expectNoError(result, `concurrent late join ${index + 1}`)
  );

  const afterConcurrentJoin = await readParticipants(distributed.sessionId);
  const lateOffsets = afterConcurrentJoin
    .filter(({ id }) => id === lateA.id || id === lateB.id)
    .map(({ start_offset }) => start_offset)
    .sort((left, right) => left - right);
  assert(
    JSON.stringify(lateOffsets) === JSON.stringify([1, 3]),
    `concurrent late joins were not serialized: ${JSON.stringify(lateOffsets)}`
  );
  assert(
    afterConcurrentJoin.find(({ id }) => id === existing.id)?.start_offset === 0,
    "late join moved an existing participant"
  );

  const lateAOffset = afterConcurrentJoin.find(
    ({ id }) => id === lateA.id
  )?.start_offset;
  expectNoError(
    await admin.rpc("assign_live_participant_start_offset", {
      p_session_id: distributed.sessionId,
      p_participant_id: lateA.id,
    }),
    "repeat late join"
  );
  assert(
    (await readParticipants(distributed.sessionId)).find(
      ({ id }) => id === lateA.id
    )?.start_offset === lateAOffset,
    "rejoin changed the participant offset"
  );

  const unauthorizedAssignment = await intruder.client.rpc(
    "assign_live_participant_start_offset",
    {
      p_session_id: distributed.sessionId,
      p_participant_id: lateA.id,
    }
  );
  assert(
    unauthorizedAssignment.error,
    "authenticated non-service user unexpectedly executed late-join assignment"
  );

  const fixed = await createRunAndSession({
    teacherId: teacher.user.id,
    mode: "fixed",
    postCount: 4,
  });
  await insertParticipants(fixed.sessionId, 1);
  expectNoError(
    await startSession(teacher.client, fixed.sessionId),
    "start fixed late-join session"
  );
  const [fixedLateJoin] = await insertParticipants(fixed.sessionId, 1, {
    prefix: "Fast sent hold",
  });
  expectNoError(
    await admin.rpc("assign_live_participant_start_offset", {
      p_session_id: fixed.sessionId,
      p_participant_id: fixedLateJoin.id,
    }),
    "assign fixed late join"
  );
  assert(
    (await readParticipants(fixed.sessionId)).find(
      ({ id }) => id === fixedLateJoin.id
    )?.start_offset === 0,
    "fixed late join did not receive offset 0"
  );
}

async function cleanUp() {
  if (cleanup.sessionIds.length > 0) {
    await admin.from("live_sessions").delete().in("id", cleanup.sessionIds);
  }
  if (cleanup.runIds.length > 0) {
    await admin.from("gps_runs").delete().in("id", cleanup.runIds);
  }
  for (const userId of cleanup.userIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

console.log(`Post-order DB test host confirmed: ${config.hostname}`);

try {
  await verifyRequiredLocalSchema();
  const teacher = await createTeacher("teacher");
  const intruder = await createTeacher("intruder");
  await verifyStartCases(teacher, intruder);
  await verifyLateJoinCases(teacher, intruder);
  console.log("Post-order DB integration tests passed.");
} finally {
  await cleanUp();
}
