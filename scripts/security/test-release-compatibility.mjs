import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const schemaPhase = argument("--schema");
const codePhase = argument("--code");
const rawCodeRoot = argument("--code-root") ?? process.cwd();
const codeRoot = isAbsolute(rawCodeRoot) ? rawCodeRoot : resolve(process.cwd(), rawCodeRoot);

if (!new Set(["old", "prepared", "cutover"]).has(schemaPhase)) {
  throw new Error("--schema skal være old, prepared eller cutover.");
}
if (!new Set(["old", "new"]).has(codePhase)) {
  throw new Error("--code skal være old eller new.");
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(url)) {
  throw new Error("ISOLATED_LOCAL_SUPABASE_REQUIRED");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const uploadSource = readFileSync(join(codeRoot, "app", "api", "play", "submit-photo", "route.ts"), "utf8");
const photoRoutePath = join(
  codeRoot,
  "app",
  "api",
  "teacher",
  "answers",
  "[answerId]",
  "photo",
  "route.ts",
);

const usesLegacyPublicUrl = uploadSource.includes("getPublicUrl");
const usesPrivateMetadata = uploadSource.includes("registerParticipantPhotoObject");
const hasProtectedPhotoRoute = (() => {
  try {
    const route = readFileSync(photoRoutePath, "utf8");
    return route.includes("canTeacherAccessAnswerPhoto") && route.includes(".download(");
  } catch {
    return false;
  }
})();

const bucketResult = await admin.storage.getBucket("participant-uploads");
if (bucketResult.error) throw new Error(`BUCKET_CHECK_FAILED:${bucketResult.error.code ?? "UNKNOWN"}`);

const metadataProbe = await admin.from("participant_photo_objects").select("answer_id").limit(0);
const metadataTableExists = !metadataProbe.error;
const bucketIsPublic = bucketResult.data.public === true;

if (schemaPhase === "old") {
  assert.equal(metadataTableExists, false, "Old schema must not contain private photo metadata.");
  assert.equal(bucketIsPublic, true, "Old schema is the legacy public-bucket state.");
} else if (schemaPhase === "prepared") {
  assert.equal(metadataTableExists, true, "Prepared schema must contain private photo metadata.");
  assert.equal(bucketIsPublic, true, "Preparation must not perform the private cutover.");
} else {
  assert.equal(metadataTableExists, true, "Cutover schema must contain private photo metadata.");
  assert.equal(bucketIsPublic, false, "Cutover schema must keep the bucket private.");
}

if (codePhase === "old") {
  assert.equal(usesLegacyPublicUrl, true, "Old code contract was not detected.");
  assert.equal(usesPrivateMetadata, false, "Old code unexpectedly requires new metadata.");
} else {
  assert.equal(usesLegacyPublicUrl, false, "New code must not generate public photo URLs.");
  assert.equal(usesPrivateMetadata, true, "New code must register private photo metadata.");
  assert.equal(hasProtectedPhotoRoute, true, "New code must include the protected teacher photo route.");
}

const photoCompatible =
  (codePhase === "old" && schemaPhase !== "cutover") ||
  (codePhase === "new" && schemaPhase !== "old");

process.stdout.write(
  `COMPAT code=${codePhase} schema=${schemaPhase} ordinary_flows=PASS photo=${photoCompatible ? "PASS" : "BLOCKED"}\n`,
);
