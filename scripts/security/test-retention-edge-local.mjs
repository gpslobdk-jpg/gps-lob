import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)) {
  throw new Error("ISOLATED_LOCAL_SUPABASE_REQUIRED");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: secret, error: secretError } = await admin.rpc(
  "get_student_data_retention_cron_secret",
);
if (secretError || typeof secret !== "string" || !secret) {
  throw new Error("LOCAL_RETENTION_SECRET_UNAVAILABLE");
}

let passed = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    const response = await fetch(`${url}/functions/v1/student-data-retention`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-student-data-retention-secret": secret,
      },
      body: JSON.stringify({ batchSize: 20, maxBatches: 2 }),
    });
    const body = await response.json();
    if (response.ok && body?.ok === true) {
      passed = true;
      break;
    }
  } catch {
    // The local Edge worker may still be booting.
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

if (!passed) throw new Error("LOCAL_RETENTION_EDGE_SMOKE_FAILED");
process.stdout.write("LOCAL_RETENTION_EDGE_SMOKE_PASSED\n");
