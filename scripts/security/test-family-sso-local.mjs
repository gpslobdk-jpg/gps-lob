import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey || !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(url)) {
  throw new Error("ISOLATED_LOCAL_SUPABASE_REQUIRED");
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anonymous = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
const origin = "http://localhost:3001";
const password = `Local-${crypto.randomUUID()}-A1!`;
const email = `family-${crypto.randomUUID()}@isolated.invalid`;

function ok(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code ?? "ERROR"}`);
  return result.data;
}

const createdUser = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }), "create user");
const userId = createdUser.user.id;
ok(await admin.from("profiles").upsert({ id: userId }), "create teacher profile");

try {
  const requestId = random();
  const nonce = random();
  const requestHash = hash(requestId);
  const nonceHash = hash(nonce);
  ok(await admin.from("family_sso_requests").insert({
    request_hash: requestHash,
    nonce_hash: nonceHash,
    destination_origin: origin,
    return_path: "/skema",
    expires_at: new Date(Date.now() + 90_000).toISOString(),
  }), "insert request");

  const anonymousRead = await anonymous.from("family_sso_requests").select("id");
  assert.equal(anonymousRead.data?.length ?? 0, 0, "anonymous request read must fail closed");

  const authorization = ok(await admin.rpc("authorize_family_sso_request", {
    p_request_hash: requestHash,
    p_user_id: userId,
    p_verified_email: email,
    p_display_name: "Synthetic teacher",
    p_identity_provider: "email",
    p_destination_origin: origin,
  }), "authorize request");
  assert.equal(authorization, "authorized");

  const attempts = await Promise.all(Array.from({ length: 20 }, () => admin.rpc(
    "consume_family_sso_request",
    { p_request_hash: requestHash, p_nonce_hash: nonceHash, p_destination_origin: origin },
  )));
  const successfulRows = attempts.flatMap((attempt) => ok(attempt, "parallel consume") ?? []);
  assert.equal(successfulRows.length, 1, "parallel consume must issue at most one identity");
  assert.equal(successfulRows[0].user_id, userId);

  const replay = ok(await admin.rpc("consume_family_sso_request", {
    p_request_hash: requestHash,
    p_nonce_hash: nonceHash,
    p_destination_origin: origin,
  }), "replay consume");
  assert.equal(replay.length, 0, "consumed request must reject replay");

  for (const scenario of ["wrong-nonce", "expired", "revoked"]) {
    const nextRequest = random();
    const nextNonce = random();
    const nextRequestHash = hash(nextRequest);
    const nextNonceHash = hash(nextNonce);
    ok(await admin.from("family_sso_requests").insert({
      request_hash: nextRequestHash,
      nonce_hash: nextNonceHash,
      destination_origin: origin,
      return_path: "/tavle",
      expires_at: new Date(Date.now() + 90_000).toISOString(),
    }), `insert ${scenario}`);
    ok(await admin.rpc("authorize_family_sso_request", {
      p_request_hash: nextRequestHash,
      p_user_id: userId,
      p_verified_email: email,
      p_display_name: "Synthetic teacher",
      p_identity_provider: "email",
      p_destination_origin: origin,
    }), `authorize ${scenario}`);

    if (scenario === "wrong-nonce") {
      const result = ok(await admin.rpc("consume_family_sso_request", {
        p_request_hash: nextRequestHash,
        p_nonce_hash: hash(random()),
        p_destination_origin: origin,
      }), "wrong nonce");
      assert.equal(result.length, 0);
    } else if (scenario === "expired") {
      ok(await admin.from("family_sso_requests").update({
        created_at: new Date(Date.now() - 180_000).toISOString(),
        expires_at: new Date(Date.now() - 60_001).toISOString(),
      }).eq("request_hash", nextRequestHash), "expire request");
      const result = ok(await admin.rpc("consume_family_sso_request", {
        p_request_hash: nextRequestHash,
        p_nonce_hash: nextNonceHash,
        p_destination_origin: origin,
      }), "expired consume");
      assert.equal(result.length, 0);
    } else {
      ok(await admin.rpc("revoke_family_sso_requests_for_user", { p_user_id: userId }), "revoke requests");
      const result = ok(await admin.rpc("consume_family_sso_request", {
        p_request_hash: nextRequestHash,
        p_nonce_hash: nextNonceHash,
        p_destination_origin: origin,
      }), "revoked consume");
      assert.equal(result.length, 0);
    }
  }

  process.stdout.write("LOCAL_FAMILY_SSO_DATABASE_TEST_PASSED\n");
} finally {
  await admin.auth.admin.deleteUser(userId);
  await admin.from("family_sso_requests").delete().eq("verified_email", email);
}
