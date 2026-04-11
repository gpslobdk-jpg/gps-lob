import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET_NAME = "participant-uploads";
const SECRET_HEADER = "x-participant-uploads-cron-secret";
const SECRET_RPC = "get_participant_uploads_cleanup_secret";
const LIST_RPC = "list_participant_upload_cleanup_candidates";
const CLEAR_RPC = "clear_participant_upload_image_urls";
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_MAX_BATCHES = 10;
const MAX_BATCH_SIZE = 1000;
const MAX_BATCHES = 50;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const STORAGE_URL_PREFIXES = [
  `/storage/v1/object/public/${BUCKET_NAME}/`,
  `/storage/v1/object/authenticated/${BUCKET_NAME}/`,
  `/storage/v1/object/sign/${BUCKET_NAME}/`,
];

type CleanupCandidateRow = {
  answer_id?: string | null;
  image_url?: string | null;
};

type DeleteFailure = {
  path: string;
  message: string;
};

let cachedSecret: string | null = null;
let cachedSecretAt = 0;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function asPositiveInteger(value: unknown, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.trunc(value);
  if (normalized <= 0) {
    return fallback;
  }

  return Math.min(normalized, max);
}

function normalizeStoragePath(value: string) {
  let normalized = value.trim().replace(/^\/+/, "");
  const bucketPrefix = `${BUCKET_NAME}/`;

  if (normalized.startsWith(bucketPrefix)) {
    normalized = normalized.slice(bucketPrefix.length);
  }

  return normalized;
}

function extractParticipantUploadPath(imageUrl: string | null | undefined) {
  const rawValue = imageUrl?.trim();
  if (!rawValue) return null;

  if (!rawValue.includes("://")) {
    const normalized = normalizeStoragePath(rawValue);
    return normalized.length > 0 ? normalized : null;
  }

  try {
    const parsedUrl = new URL(rawValue);
    const matchingPrefix = STORAGE_URL_PREFIXES.find((prefix) => parsedUrl.pathname.startsWith(prefix));

    if (!matchingPrefix) return null;

    const normalized = normalizeStoragePath(
      decodeURIComponent(parsedUrl.pathname.slice(matchingPrefix.length))
    );

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }

  return mismatch === 0;
}

function isMissingStorageObjectError(error: unknown) {
  const message = error instanceof Error ? error.message : JSON.stringify(error ?? {});
  const normalized = message.toLowerCase();

  return (
    normalized.includes("not found") ||
    normalized.includes("no such key") ||
    normalized.includes("does not exist") ||
    normalized.includes("404")
  );
}

function chunkItems<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function readCleanupSecret(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdminClient>>>
) {
  const now = Date.now();
  if (cachedSecret && now - cachedSecretAt < 5 * 60 * 1000) {
    return cachedSecret;
  }

  const { data, error } = await supabase.rpc(SECRET_RPC);
  if (error) {
    throw new Error(error.message ?? "Could not read cleanup secret.");
  }

  const secret = typeof data === "string" ? data.trim() : "";
  if (!secret) {
    throw new Error("Cleanup secret is missing.");
  }

  cachedSecret = secret;
  cachedSecretAt = now;
  return secret;
}

async function listCleanupCandidates(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdminClient>>>,
  cutoffIso: string,
  batchSize: number
) {
  const { data, error } = await supabase.rpc(LIST_RPC, {
    p_cutoff: cutoffIso,
    p_limit: batchSize,
  });

  if (error) {
    throw new Error(error.message ?? "Could not list cleanup candidates.");
  }

  return Array.isArray(data) ? (data as CleanupCandidateRow[]) : [];
}

async function clearImageUrls(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdminClient>>>,
  answerIds: string[]
) {
  const { data, error } = await supabase.rpc(CLEAR_RPC, {
    p_answer_ids: answerIds,
  });

  if (error) {
    throw new Error(error.message ?? "Could not clear image URLs.");
  }

  return typeof data === "number" ? data : answerIds.length;
}

async function removeStoragePaths(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdminClient>>>,
  paths: string[]
) {
  const deletedPaths = new Set<string>();
  const failures: DeleteFailure[] = [];

  for (const chunk of chunkItems(paths, STORAGE_REMOVE_CHUNK_SIZE)) {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(chunk);

    if (!error) {
      for (const path of chunk) {
        deletedPaths.add(path);
      }
      continue;
    }

    for (const path of chunk) {
      const { error: singleError } = await supabase.storage.from(BUCKET_NAME).remove([path]);

      if (!singleError || isMissingStorageObjectError(singleError)) {
        deletedPaths.add(path);
        continue;
      }

      const failureMessage =
        singleError instanceof Error
          ? singleError.message
          : JSON.stringify(singleError ?? { message: "Unknown storage error" });

      failures.push({ path, message: failureMessage });
    }
  }

  return {
    deletedPaths: Array.from(deletedPaths),
    failures,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { Allow: "POST, OPTIONS" },
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabase = await getSupabaseAdminClient();
  if (!supabase) {
    return json({ error: "Supabase admin env is missing." }, 500);
  }

  let expectedSecret = "";
  try {
    expectedSecret = await readCleanupSecret(supabase);
  } catch (error) {
    console.error("Participant upload retention could not read cleanup secret:", error);
    return json({ error: "Cleanup secret lookup failed." }, 500);
  }

  const suppliedSecret = request.headers.get(SECRET_HEADER)?.trim() ?? "";
  if (!suppliedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return json({ error: "Unauthorized." }, 401);
  }

  let batchSize = DEFAULT_BATCH_SIZE;
  let maxBatches = DEFAULT_MAX_BATCHES;

  try {
    const body = (await request.json()) as { batchSize?: unknown; maxBatches?: unknown };
    batchSize = asPositiveInteger(body.batchSize, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    maxBatches = asPositiveInteger(body.maxBatches, DEFAULT_MAX_BATCHES, MAX_BATCHES);
  } catch {
    // Empty or invalid JSON body falls back to defaults.
  }

  const cutoffIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  let batchesProcessed = 0;
  let candidatesSeen = 0;
  let storageObjectsDeleted = 0;
  let answersCleared = 0;
  const deleteFailures: DeleteFailure[] = [];

  while (batchesProcessed < maxBatches) {
    let rows: CleanupCandidateRow[] = [];

    try {
      rows = await listCleanupCandidates(supabase, cutoffIso, batchSize);
    } catch (error) {
      console.error("Participant upload retention could not list cleanup candidates:", error);
      return json(
        {
          error: "Failed to list cleanup candidates.",
          cutoffIso,
          batchesProcessed,
          candidatesSeen,
          storageObjectsDeleted,
          answersCleared,
        },
        500
      );
    }

    if (rows.length === 0) {
      break;
    }

    batchesProcessed += 1;
    candidatesSeen += rows.length;

    const answerIdsWithoutPath: string[] = [];
    const pathToAnswerIds = new Map<string, string[]>();

    for (const row of rows) {
      const answerId = typeof row.answer_id === "string" ? row.answer_id.trim() : "";
      if (!answerId) {
        continue;
      }

      const path = extractParticipantUploadPath(row.image_url);
      if (!path) {
        answerIdsWithoutPath.push(answerId);
        continue;
      }

      const existingAnswerIds = pathToAnswerIds.get(path) ?? [];
      existingAnswerIds.push(answerId);
      pathToAnswerIds.set(path, existingAnswerIds);
    }

    const paths = Array.from(pathToAnswerIds.keys());
    const { deletedPaths, failures } = await removeStoragePaths(supabase, paths);
    storageObjectsDeleted += deletedPaths.length;
    deleteFailures.push(...failures);

    const clearedAnswerIds = [...answerIdsWithoutPath];
    for (const deletedPath of deletedPaths) {
      const answerIds = pathToAnswerIds.get(deletedPath) ?? [];
      clearedAnswerIds.push(...answerIds);
    }

    if (clearedAnswerIds.length === 0) {
      return json(
        {
          error: "Retention cleanup could not make progress.",
          cutoffIso,
          batchesProcessed,
          candidatesSeen,
          storageObjectsDeleted,
          answersCleared,
          failures: deleteFailures.slice(0, 20),
        },
        500
      );
    }

    try {
      answersCleared += await clearImageUrls(supabase, clearedAnswerIds);
    } catch (error) {
      console.error("Participant upload retention could not clear image URLs:", error);
      return json(
        {
          error: "Failed to clear image URLs.",
          cutoffIso,
          batchesProcessed,
          candidatesSeen,
          storageObjectsDeleted,
          answersCleared,
          failures: deleteFailures.slice(0, 20),
        },
        500
      );
    }

    if (rows.length < batchSize) {
      break;
    }
  }

  const reachedBatchCap = batchesProcessed >= maxBatches;
  const responseBody = {
    ok: deleteFailures.length === 0,
    cutoffIso,
    batchesProcessed,
    batchSize,
    maxBatches,
    reachedBatchCap,
    candidatesSeen,
    storageObjectsDeleted,
    answersCleared,
    storageDeleteFailures: deleteFailures.length,
    failures: deleteFailures.slice(0, 20),
  };

  if (deleteFailures.length > 0) {
    return json(responseBody, 500);
  }

  return json(responseBody, 200);
});