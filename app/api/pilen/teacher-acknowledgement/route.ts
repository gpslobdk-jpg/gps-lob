import { NextResponse } from "next/server";

import { PILEN_TEACHER_ACKNOWLEDGEMENT_VERSION } from "@/lib/pilenProductCopy";
import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
} as const;

type AcknowledgementRow = {
  accepted?: boolean | null;
  copy_version?: string | null;
  accepted_at?: string | null;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function authenticatedTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

async function findCurrentAcknowledgement(
  adminSupabase: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
) {
  return adminSupabase
    .from("pilen_realtime_teacher_acknowledgements")
    .select("accepted,copy_version,accepted_at")
    .eq("user_id", userId)
    .eq("copy_version", PILEN_TEACHER_ACKNOWLEDGEMENT_VERSION)
    .maybeSingle<AcknowledgementRow>();
}

export async function GET() {
  const user = await authenticatedTeacher();
  if (!user) return json({ error: "Du skal være logget ind." }, 401);

  const adminSupabase = createAdminClient();
  if (!adminSupabase) return json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, 503);

  const { data, error } = await findCurrentAcknowledgement(
    adminSupabase,
    user.id,
  );
  if (error) return json({ error: "Bekræftelsen kunne ikke hentes." }, 503);

  return json({
    accepted: data?.accepted === true,
    version: PILEN_TEACHER_ACKNOWLEDGEMENT_VERSION,
  });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "Ugyldig forespørgsel." }, 415);
  }

  let accepted = false;
  try {
    const payload = (await request.json()) as { accepted?: unknown };
    accepted = payload.accepted === true;
  } catch {
    accepted = false;
  }
  if (!accepted) return json({ error: "Bekræftelsen mangler." }, 400);

  const user = await authenticatedTeacher();
  if (!user) return json({ error: "Du skal være logget ind." }, 401);

  const adminSupabase = createAdminClient();
  if (!adminSupabase) return json({ error: ADMIN_ACCESS_MISSING_MESSAGE }, 503);

  const existing = await findCurrentAcknowledgement(adminSupabase, user.id);
  if (existing.error) {
    return json({ error: "Bekræftelsen kunne ikke kontrolleres." }, 503);
  }

  if (existing.data?.accepted !== true) {
    const { error } = await adminSupabase
      .from("pilen_realtime_teacher_acknowledgements")
      .insert({
        user_id: user.id,
        accepted: true,
        copy_version: PILEN_TEACHER_ACKNOWLEDGEMENT_VERSION,
        accepted_at: new Date().toISOString(),
      });

    if (error) {
      const retry = await findCurrentAcknowledgement(adminSupabase, user.id);
      if (retry.error || retry.data?.accepted !== true) {
        return json({ error: "Bekræftelsen kunne ikke gemmes." }, 503);
      }
    }
  }

  return json({
    accepted: true,
    version: PILEN_TEACHER_ACKNOWLEDGEMENT_VERSION,
  });
}
