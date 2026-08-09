import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET_NAME = "participant-uploads";
const SECRET_HEADER = "x-student-data-retention-secret";
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_MAX_BATCHES = 10;
const STORAGE_REMOVE_CHUNK_SIZE = 100;

type AdminClient = ReturnType<typeof createClient>;

type PhotoCandidate = {
  answer_id?: string | null;
  object_path?: string | null;
};

type JobTotals = {
  gpsRowsCleared: number;
  photoObjectsDeleted: number;
  sessionsDeleted: number;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

function asPositiveInteger(value: unknown, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.trunc(value), max));
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function rpcNumber(
  supabase: AdminClient,
  name: string,
  args: Record<string, unknown> = {}
) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(name);
  const numeric = Number(data);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

async function finishRun(
  supabase: AdminClient,
  runId: string,
  status: "succeeded" | "failed",
  totals: JobTotals,
  errorCode: string | null
) {
  const { error } = await supabase.rpc("finish_student_data_retention_run", {
    p_run_id: runId,
    p_status: status,
    p_gps_rows_cleared: totals.gpsRowsCleared,
    p_photo_objects_deleted: totals.photoObjectsDeleted,
    p_sessions_deleted: totals.sessionsDeleted,
    p_error_code: errorCode,
  });
  if (error) throw new Error("JOB_STATUS_WRITE_FAILED");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Retention environment is unavailable." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: expectedSecret, error: secretError } = await supabase.rpc(
    "get_student_data_retention_cron_secret"
  );
  const suppliedSecret = request.headers.get(SECRET_HEADER)?.trim() ?? "";
  if (
    secretError ||
    typeof expectedSecret !== "string" ||
    !suppliedSecret ||
    !safeEqual(suppliedSecret, expectedSecret)
  ) {
    return json({ error: "Unauthorized." }, 401);
  }

  let batchSize = DEFAULT_BATCH_SIZE;
  let maxBatches = DEFAULT_MAX_BATCHES;
  try {
    const body = (await request.json()) as {
      batchSize?: unknown;
      maxBatches?: unknown;
    };
    batchSize = asPositiveInteger(body.batchSize, DEFAULT_BATCH_SIZE, 1000);
    maxBatches = asPositiveInteger(body.maxBatches, DEFAULT_MAX_BATCHES, 50);
  } catch {
    // Cron requests may omit the optional tuning body.
  }

  const { data: runIdData, error: startError } = await supabase.rpc(
    "start_student_data_retention_run"
  );
  if (!startError && runIdData === null) {
    console.info("student_data_retention_skipped", { code: "ALREADY_RUNNING" });
    return json({ ok: true, skipped: true, code: "ALREADY_RUNNING" });
  }
  if (startError || typeof runIdData !== "string") {
    console.error("student_data_retention_failed", { code: "START_FAILED" });
    return json({ error: "Retention job could not start." }, 500);
  }

  const runId = runIdData;
  const totals: JobTotals = {
    gpsRowsCleared: 0,
    photoObjectsDeleted: 0,
    sessionsDeleted: 0,
  };

  try {
    totals.gpsRowsCleared = await rpcNumber(
      supabase,
      "clear_expired_participant_locations"
    );

    for (let batch = 0; batch < maxBatches; batch += 1) {
      const { data, error } = await supabase.rpc(
        "list_student_photo_retention_candidates",
        { p_limit: batchSize }
      );
      if (error) throw new Error("LIST_PHOTOS_FAILED");

      const rows = (Array.isArray(data) ? data : []) as PhotoCandidate[];
      if (rows.length === 0) break;

      const candidates = rows.filter(
        (row): row is { answer_id: string; object_path: string } =>
          typeof row.answer_id === "string" &&
          typeof row.object_path === "string" &&
          row.answer_id.length > 0 &&
          row.object_path.length > 0
      );
      if (candidates.length === 0) throw new Error("INVALID_PHOTO_CANDIDATES");

      for (const pathChunk of chunks(
        candidates.map((candidate) => candidate.object_path),
        STORAGE_REMOVE_CHUNK_SIZE
      )) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(pathChunk);
        if (storageError) throw new Error("PHOTO_DELETE_FAILED");
      }

      const { error: finalizeError } = await supabase.rpc(
        "finalize_student_photo_retention",
        { p_answer_ids: candidates.map((candidate) => candidate.answer_id) }
      );
      if (finalizeError) throw new Error("PHOTO_FINALIZE_FAILED");

      totals.photoObjectsDeleted += candidates.length;
      if (rows.length < batchSize) break;
    }

    for (let batch = 0; batch < maxBatches; batch += 1) {
      const { data, error } = await supabase.rpc(
        "list_student_photo_orphan_candidates",
        { p_limit: batchSize }
      );
      if (error) throw new Error("LIST_ORPHAN_PHOTOS_FAILED");

      const rows = (Array.isArray(data) ? data : []) as Array<{
        object_path?: string | null;
      }>;
      if (rows.length === 0) break;

      const paths = rows
        .map((row) => row.object_path)
        .filter((path): path is string => typeof path === "string" && path.length > 0);
      if (paths.length !== rows.length) {
        throw new Error("INVALID_ORPHAN_PHOTO_CANDIDATES");
      }

      for (const pathChunk of chunks(paths, STORAGE_REMOVE_CHUNK_SIZE)) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(pathChunk);
        if (storageError) throw new Error("ORPHAN_PHOTO_DELETE_FAILED");
      }

      totals.photoObjectsDeleted += paths.length;
      if (rows.length < batchSize) break;
    }

    for (let batch = 0; batch < maxBatches; batch += 1) {
      const deleted = await rpcNumber(
        supabase,
        "delete_expired_student_sessions",
        { p_limit: batchSize }
      );
      totals.sessionsDeleted += deleted;
      if (deleted < batchSize) break;
    }

    await rpcNumber(supabase, "delete_expired_retention_job_logs");
    await finishRun(supabase, runId, "succeeded", totals, null);

    console.info("student_data_retention_succeeded", totals);
    return json({ ok: true, ...totals });
  } catch (error) {
    const rawCode = error instanceof Error ? error.message : "UNKNOWN_FAILURE";
    const errorCode = /^[A-Z0-9_]{1,64}$/.test(rawCode)
      ? rawCode
      : "UNKNOWN_FAILURE";
    await finishRun(supabase, runId, "failed", totals, errorCode).catch(
      () => undefined
    );
    console.error("student_data_retention_failed", { code: errorCode });
    return json({ error: "Retention job failed.", code: errorCode }, 500);
  }
});
