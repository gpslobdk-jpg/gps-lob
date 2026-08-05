import { NextResponse } from "next/server";

import { getBuilderHrefForRaceType } from "@/utils/gpsRuns";
import {
  isRunExecutionSharingEnabled,
  isSupportedRunExecutionShareRaceType,
  normalizeRunExecutionShareToken,
} from "@/lib/runExecutionShare";
import {
  generateRunExecutionShareToken,
  hashRunExecutionShareToken,
} from "@/lib/runExecutionShareServer";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { logHandledServerError } from "@/utils/telemetry/serverLogs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
} as const;

type ShareAction = "status" | "create" | "revoke" | "preview" | "claim";

type SharePayload = {
  action?: ShareAction;
  runId?: string;
  shareId?: string;
  token?: string;
};

type OwnedRunRow = {
  id: string;
  user_id: string;
  race_type: string | null;
};

type ActiveShareRow = {
  id: string;
  source_run_id: string;
  created_at: string;
};

type PreviewShareRpcRow = {
  share_title: string;
  share_subject: string;
  share_grade_levels: string[] | null;
  share_race_type: string | null;
};

type CreateShareRpcRow = {
  share_id: string;
  share_created_at: string;
};

type ClaimShareRpcRow = {
  copied_run_id: string | null;
  already_claimed: boolean;
  copied_race_type: string;
  copy_deleted: boolean;
};

function respond(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function readRpcRow<T>(value: unknown) {
  if (Array.isArray(value)) {
    return (value[0] ?? null) as T | null;
  }

  return value && typeof value === "object" ? (value as T) : null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function getSafeDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "unknown";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(code)
    ? code
    : "unknown";
}

function hasDatabaseMessage(error: unknown, expected: string) {
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.includes(expected);
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user: error ? null : user };
}

async function fetchOwnedRun(
  runId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase
    .from("gps_runs")
    .select("id,user_id,race_type")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle<OwnedRunRow>();

  if (error) throw error;
  return data ?? null;
}

async function handleOwnerStatus(payload: SharePayload) {
  if (!isUuid(payload.runId)) {
    return respond({ error: "Løbet blev ikke fundet." }, 400);
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return respond({ error: "Du skal være logget ind." }, 401);

  const run = await fetchOwnedRun(payload.runId, user.id, supabase);
  if (!run) return respond({ error: "Løbet blev ikke fundet." }, 404);

  const supported = isSupportedRunExecutionShareRaceType(run.race_type);
  if (!supported) {
    return respond({ supported: false, activeShare: null });
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: "Deling er midlertidigt utilgængelig." }, 503);
  }

  const { data, error } = await adminSupabase
    .from("gps_run_execution_shares")
    .select("id,source_run_id,created_at")
    .eq("source_run_id", run.id)
    .eq("owner_id", user.id)
    .is("revoked_at", null)
    .maybeSingle<ActiveShareRow>();

  if (error) throw error;

  return respond({
    supported: true,
    activeShare: data ? { id: data.id, createdAt: data.created_at } : null,
  });
}

async function handleCreate(payload: SharePayload) {
  if (!isUuid(payload.runId)) {
    return respond({ error: "Løbet blev ikke fundet." }, 400);
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return respond({ error: "Du skal være logget ind." }, 401);

  const run = await fetchOwnedRun(payload.runId, user.id, supabase);
  if (!run) return respond({ error: "Løbet blev ikke fundet." }, 404);

  if (!isSupportedRunExecutionShareRaceType(run.race_type)) {
    return respond(
      { error: "Denne løbstype kan endnu ikke deles til afvikling." },
      400
    );
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: "Deling er midlertidigt utilgængelig." }, 503);
  }

  const token = generateRunExecutionShareToken();
  const tokenHash = hashRunExecutionShareToken(token);
  if (!tokenHash) {
    return respond({ error: "Delingslinket kunne ikke oprettes." }, 500);
  }

  const { data, error } = await adminSupabase.rpc(
    "create_gps_run_execution_share",
    {
      p_source_run_id: run.id,
      p_owner_id: user.id,
      p_token_hash: tokenHash,
    }
  );

  if (error) {
    if (hasDatabaseMessage(error, "share_unsupported_run_type")) {
      return respond(
        { error: "Denne løbstype kan endnu ikke deles til afvikling." },
        400
      );
    }
    if (hasDatabaseMessage(error, "share_source_unavailable")) {
      return respond({ error: "Løbet blev ikke fundet." }, 404);
    }
    throw error;
  }

  const row = readRpcRow<CreateShareRpcRow>(data);
  if (!row?.share_id) {
    return respond({ error: "Delingslinket kunne ikke oprettes." }, 500);
  }

  return respond({
    token,
    share: {
      id: row.share_id,
      createdAt: row.share_created_at,
    },
  });
}

async function handleRevoke(payload: SharePayload) {
  if (!isUuid(payload.shareId)) {
    return respond({ error: "Delingslinket blev ikke fundet." }, 400);
  }

  const { user } = await getAuthenticatedUser();
  if (!user) return respond({ error: "Du skal være logget ind." }, 401);

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: "Deling er midlertidigt utilgængelig." }, 503);
  }

  const { error } = await adminSupabase.rpc(
    "revoke_gps_run_execution_share",
    {
      p_share_id: payload.shareId,
      p_owner_id: user.id,
    }
  );

  if (error) {
    if (hasDatabaseMessage(error, "share_unavailable")) {
      return respond({ error: "Delingslinket blev ikke fundet." }, 404);
    }
    throw error;
  }

  return respond({ revoked: true });
}

async function handlePreview(payload: SharePayload) {
  const token = normalizeRunExecutionShareToken(payload.token);
  const tokenHash = hashRunExecutionShareToken(token);
  if (!token || !tokenHash) {
    return respond(
      { error: "Delingslinket er ugyldigt eller deaktiveret.", terminal: true },
      404
    );
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: "Deling er midlertidigt utilgængelig." }, 503);
  }

  const { data, error } = await adminSupabase.rpc(
    "preview_gps_run_execution_share",
    { p_token_hash: tokenHash }
  );

  if (error) {
    if (hasDatabaseMessage(error, "share_invalid_or_inactive")) {
      return respond(
        { error: "Delingslinket er ugyldigt eller deaktiveret.", terminal: true },
        404
      );
    }
    throw error;
  }

  const row = readRpcRow<PreviewShareRpcRow>(data);
  if (!row || !isSupportedRunExecutionShareRaceType(row.share_race_type)) {
    return respond(
      { error: "Delingslinket er ugyldigt eller deaktiveret.", terminal: true },
      404
    );
  }

  return respond({
    run: {
      title: row.share_title,
      subject: row.share_subject,
      gradeLevels: row.share_grade_levels ?? [],
    },
  });
}

async function handleClaim(payload: SharePayload) {
  const token = normalizeRunExecutionShareToken(payload.token);
  const tokenHash = hashRunExecutionShareToken(token);
  if (!token || !tokenHash) {
    return respond(
      { error: "Delingslinket er ugyldigt eller deaktiveret.", terminal: true },
      404
    );
  }

  const { user } = await getAuthenticatedUser();
  if (!user) return respond({ error: "Du skal være logget ind." }, 401);

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return respond({ error: "Deling er midlertidigt utilgængelig." }, 503);
  }

  const { data, error } = await adminSupabase.rpc(
    "claim_gps_run_execution_share",
    {
      p_token_hash: tokenHash,
      p_teacher_id: user.id,
    }
  );

  if (error) {
    if (hasDatabaseMessage(error, "share_unsupported_run_type")) {
      return respond(
        {
          error: "Denne løbstype kan endnu ikke hentes som kopi.",
          terminal: true,
        },
        400
      );
    }
    if (hasDatabaseMessage(error, "share_invalid_or_inactive")) {
      return respond(
        { error: "Delingslinket er ugyldigt eller deaktiveret.", terminal: true },
        404
      );
    }
    throw error;
  }

  const row = readRpcRow<ClaimShareRpcRow>(data);
  if (row?.copy_deleted) {
    return respond(
      {
        error:
          "Du har tidligere hentet dette løb, men din kopi er siden blevet slettet. Kontakt eventuelt den, der delte løbet.",
        terminal: true,
      },
      410
    );
  }

  const destination = row?.copied_run_id
    ? getBuilderHrefForRaceType(row.copied_run_id, row.copied_race_type)
    : null;

  if (!row?.copied_run_id || !destination) {
    return respond({ error: "Kopien kunne ikke åbnes." }, 500);
  }

  return respond({
    alreadyClaimed: Boolean(row.already_claimed),
    destination,
  });
}

export async function POST(request: Request) {
  const requestPath = new URL(request.url).pathname;

  if (!isRunExecutionSharingEnabled()) {
    return respond(
      { error: "Del til afvikling er ikke aktiveret.", terminal: true },
      404
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return respond({ error: "Ugyldig forespørgsel." }, 415);
  }

  if (!isSameOriginRequest(request)) {
    return respond({ error: "Ugyldig forespørgsel." }, 403);
  }

  let payload: SharePayload;
  try {
    payload = (await request.json()) as SharePayload;
  } catch {
    return respond({ error: "Ugyldig forespørgsel." }, 400);
  }

  try {
    switch (payload.action) {
      case "status":
        return await handleOwnerStatus(payload);
      case "create":
        return await handleCreate(payload);
      case "revoke":
        return await handleRevoke(payload);
      case "preview":
        return await handlePreview(payload);
      case "claim":
        return await handleClaim(payload);
      default:
        return respond({ error: "Ugyldig handling." }, 400);
    }
  } catch (error) {
    const safeCode = getSafeDatabaseErrorCode(error);
    await logHandledServerError({
      route: "/api/run-execution-share",
      method: "POST",
      status: 500,
      error: new Error(`run_execution_share_failed_${safeCode}`),
      requestPath,
      routeType: "route",
      context: typeof payload.action === "string" ? payload.action : "unknown",
    });

    return respond({ error: "Delingen kunne ikke behandles. Prøv igen." }, 500);
  }
}
