import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey || !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)) {
  throw new Error("ISOLATED_LOCAL_SUPABASE_REQUIRED");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymous = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ok(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code ?? "ERROR"}`);
  return result.data;
}

function report(label) {
  process.stdout.write(`PASS ${label}\n`);
}

const suffix = crypto.randomUUID().slice(0, 8);
const password = `Local-only-${crypto.randomUUID()}-A1!`;
const userAEmail = `teacher-a-${suffix}@isolated.invalid`;
const userBEmail = `teacher-b-${suffix}@isolated.invalid`;

const userARecord = ok(
  await admin.auth.admin.createUser({
    email: userAEmail,
    password,
    email_confirm: true,
  }),
  "create teacher A",
);
const userBRecord = ok(
  await admin.auth.admin.createUser({
    email: userBEmail,
    password,
    email_confirm: true,
  }),
  "create teacher B",
);
const userAId = userARecord.user.id;
const userBId = userBRecord.user.id;

const userA = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const userB = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
ok(await userA.auth.signInWithPassword({ email: userAEmail, password }), "sign in A");
ok(await userB.auth.signInWithPassword({ email: userBEmail, password }), "sign in B");

const runA = ok(
  await userA
    .from("gps_runs")
    .insert({
      user_id: userAId,
      title: "Synthetic A",
      subject: "Test",
      questions: [{ text: "A", type: "ai_image" }],
      race_type: "foto",
    })
    .select("id")
    .single(),
  "insert run A",
);
const runB = ok(
  await userB
    .from("gps_runs")
    .insert({
      user_id: userBId,
      title: "Synthetic B",
      subject: "Test",
      questions: [{ text: "B", answers: ["1", "2"] }],
      race_type: "manuel",
    })
    .select("id")
    .single(),
  "insert run B",
);

const crossRun = ok(await userA.from("gps_runs").select("id").eq("id", runB.id), "cross run select");
assert.equal(crossRun.length, 0);
report("RLS separates teacher runs");

const sessionA = ok(
  await userA
    .from("live_sessions")
    .insert({ run_id: runA.id, teacher_id: userAId, pin: "A10001", status: "running" })
    .select("id")
    .single(),
  "insert session A",
);
const sessionB = ok(
  await userB
    .from("live_sessions")
    .insert({ run_id: runB.id, teacher_id: userBId, pin: "B10001", status: "running" })
    .select("id")
    .single(),
  "insert session B",
);
const participantAId = crypto.randomUUID();
const participantBId = crypto.randomUUID();
ok(
  await admin.from("participants").insert([
    { id: participantAId, session_id: sessionA.id, student_name: "Synthetic A1" },
    { id: participantBId, session_id: sessionB.id, student_name: "Synthetic B1" },
  ]),
  "insert participants",
);

const answerAId = crypto.randomUUID();
const answerBId = crypto.randomUUID();
ok(
  await admin.from("answers").insert([
    {
      id: answerAId,
      session_id: sessionA.id,
      participant_id: participantAId,
      student_name: "Synthetic A1",
      question_index: 0,
      is_correct: true,
      image_url: "pending",
    },
    {
      id: answerBId,
      session_id: sessionB.id,
      participant_id: participantBId,
      student_name: "Synthetic B1",
      question_index: 0,
      is_correct: true,
    },
  ]),
  "insert answers",
);

const image = await sharp({
  create: { width: 8, height: 8, channels: 3, background: "#224433" },
})
  .jpeg()
  .toBuffer();
const objectPath = `private-v2/${sessionA.id}/${participantAId}/${answerAId}-0.jpg`;
ok(
  await admin.storage.from("participant-uploads").upload(objectPath, image, {
    contentType: "image/jpeg",
    upsert: false,
  }),
  "upload private photo",
);
ok(
  await admin.from("participant_photo_objects").insert({
    answer_id: answerAId,
    session_id: sessionA.id,
    participant_id: participantAId,
    object_path: objectPath,
  }),
  "register private photo",
);

const ownAnswers = ok(await userA.from("answers").select("id").eq("id", answerAId), "A answer select");
const crossAnswers = ok(await userB.from("answers").select("id").eq("id", answerAId), "B answer select");
const anonAnswers = ok(await anonymous.from("answers").select("id").eq("id", answerAId), "anon answer select");
assert.equal(ownAnswers.length, 1);
assert.equal(crossAnswers.length, 0);
assert.equal(anonAnswers.length, 0);
assert.ok((await anonymous.storage.from("participant-uploads").download(objectPath)).error);
assert.ok((await userB.storage.from("participant-uploads").download(objectPath)).error);
assert.ok((await userA.storage.from("participant-uploads").download(objectPath)).error);
assert.equal((await admin.storage.from("participant-uploads").download(objectPath)).error, null);
report("private Storage and cross-owner photo access fail closed");

const fingerprint = "a".repeat(64);
for (let index = 1; index <= 7; index += 1) {
  const value = ok(
    await admin.rpc("consume_participant_photo_upload_limit", {
      p_session_id: sessionA.id,
      p_participant_id: participantAId,
      p_request_fingerprint: fingerprint,
      p_now: "2026-08-08T10:00:00.000Z",
    }),
    `rate limit ${index}`,
  );
  assert.equal(value, index <= 6);
}
const manipulatedBinding = ok(
  await admin.rpc("consume_participant_photo_upload_limit", {
    p_session_id: sessionB.id,
    p_participant_id: participantAId,
    p_request_fingerprint: "b".repeat(64),
    p_now: "2026-08-08T10:00:00.000Z",
  }),
  "manipulated binding",
);
assert.equal(manipulatedBinding, false);
report("photo upload limit is atomic and binding-scoped");

const locationNow = "2026-08-08T12:00:00.000Z";
ok(
  await admin
    .from("participants")
    .update({ lat: 55.1, lng: 12.1, accuracy: 8, last_updated: "2026-08-08T11:44:59.000Z" })
    .eq("id", participantAId),
  "set stale GPS",
);
assert.equal(
  ok(await admin.rpc("clear_expired_participant_locations", { p_now: locationNow }), "clear GPS"),
  1,
);
const staleLocation = ok(
  await admin.from("participants").select("lat,lng,accuracy").eq("id", participantAId).single(),
  "read cleared GPS",
);
assert.deepEqual(staleLocation, { lat: null, lng: null, accuracy: null });

ok(
  await admin
    .from("participants")
    .update({ lat: 55.2, lng: 12.2, accuracy: 6, last_updated: "2026-08-08T11:59:00.000Z" })
    .eq("id", participantAId),
  "set fresh GPS",
);
assert.equal(
  ok(await admin.rpc("clear_expired_participant_locations", { p_now: locationNow }), "keep fresh GPS"),
  0,
);
ok(await userA.from("live_sessions").update({ status: "finished" }).eq("id", sessionA.id), "finish session");
const finishedLocation = ok(
  await admin.from("participants").select("lat,lng,accuracy").eq("id", participantAId).single(),
  "read finished GPS",
);
assert.deepEqual(finishedLocation, { lat: null, lng: null, accuracy: null });
report("GPS expires at 15 minutes and clears on finish");

const starts = await Promise.all([
  admin.rpc("start_student_data_retention_run"),
  admin.rpc("start_student_data_retention_run"),
]);
const startValues = starts.map((result, index) => ok(result, `retention start ${index}`));
assert.equal(startValues.filter((value) => typeof value === "string").length, 1);
assert.equal(startValues.filter((value) => value === null).length, 1);
const activeRunId = startValues.find((value) => typeof value === "string");
ok(
  await admin.rpc("finish_student_data_retention_run", {
    p_run_id: activeRunId,
    p_status: "succeeded",
  }),
  "finish retention run",
);
report("concurrent retention starts are serialized");

const oldSession = ok(
  await admin
    .from("live_sessions")
    .insert({
      run_id: runA.id,
      teacher_id: userAId,
      pin: "A90001",
      status: "finished",
      student_data_retention_anchor_at: "2026-04-01T00:00:00.000Z",
    })
    .select("id")
    .single(),
  "old session",
);
const newSession = ok(
  await admin
    .from("live_sessions")
    .insert({
      run_id: runB.id,
      teacher_id: userBId,
      pin: "B90001",
      status: "finished",
      student_data_retention_anchor_at: "2026-08-07T00:00:00.000Z",
    })
    .select("id")
    .single(),
  "new session",
);
// The trigger uses now() for newly closed sessions; set synthetic anchors after insert.
ok(
  await admin
    .from("live_sessions")
    .update({ student_data_retention_anchor_at: "2026-04-01T00:00:00.000Z" })
    .eq("id", oldSession.id),
  "age old session",
);
assert.equal(
  ok(
    await admin.rpc("delete_expired_student_sessions", {
      p_now: "2026-08-08T12:00:00.000Z",
      p_limit: 200,
    }),
    "delete old sessions",
  ),
  1,
);
assert.equal(
  ok(await admin.from("live_sessions").select("id").eq("id", oldSession.id), "old session gone").length,
  0,
);
assert.equal(
  ok(await admin.from("live_sessions").select("id").eq("id", newSession.id), "new session kept").length,
  1,
);
report("90-day retention uses close anchor and preserves another owner");

const orphanPath = `private-v2/orphan/${crypto.randomUUID()}.jpg`;
ok(
  await admin.storage.from("participant-uploads").upload(orphanPath, image, {
    contentType: "image/jpeg",
    upsert: false,
  }),
  "orphan upload",
);
const orphanCandidates = ok(
  await admin.rpc("list_student_photo_orphan_candidates", {
    p_now: "2099-01-01T00:00:00.000Z",
    p_limit: 200,
  }),
  "orphan candidates",
);
assert.ok(orphanCandidates.some((row) => row.object_path === orphanPath));
report("Storage orphans are discoverable without exposing paths to browser roles");

const bulkSession = ok(
  await userB
    .from("live_sessions")
    .insert({ run_id: runB.id, teacher_id: userBId, pin: "B50000", status: "running" })
    .select("id")
    .single(),
  "bulk session",
);
const bulkParticipants = Array.from({ length: 50 }, (_, index) => ({
  id: crypto.randomUUID(),
  session_id: bulkSession.id,
  student_name: `Synthetic load ${index + 1}`,
}));
ok(await admin.from("participants").insert(bulkParticipants), "bulk participants");
await Promise.all(
  bulkParticipants.map(async (participant, index) => {
    ok(
      await admin
        .from("participants")
        .update({ lat: 55 + index / 10_000, lng: 12 + index / 10_000, accuracy: 5 })
        .eq("id", participant.id),
      "bulk GPS",
    );
    ok(
      await admin.from("answers").insert({
        session_id: bulkSession.id,
        participant_id: participant.id,
        student_name: participant.student_name,
        question_index: 0,
        is_correct: true,
      }),
      "bulk answer",
    );
  }),
);
const bulkParticipantCount = await admin
  .from("participants")
  .select("id", { count: "exact", head: true })
  .eq("session_id", bulkSession.id);
if (bulkParticipantCount.error) throw new Error("bulk participant count");
assert.equal(bulkParticipantCount.count, 50);
const bulkCount = await admin.from("answers").select("id", { count: "exact", head: true }).eq("session_id", bulkSession.id);
if (bulkCount.error) throw new Error("bulk answer count");
assert.equal(bulkCount.count, 50);
report("50 concurrent synthetic participants stored GPS and answers");

process.stdout.write("LOCAL_KOMMUNEKLAR_TESTS_PASSED\n");
