import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
  ADMIN_ACCESS_MISSING_MESSAGE,
  createAdminClient,
} from "@/utils/supabase/admin";
import { PARTICIPANT_AUTH_STORAGE_KEY } from "@/utils/supabase/participantAuth";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;
type ParticipantRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  start_offset?: number | string | null;
  zone_krig_team_id?: string | null;
  auth_user_id?: string | null;
};

export async function createParticipantClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: PARTICIPANT_AUTH_STORAGE_KEY,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Route handlers kan skrive cookies; i andre miljøer ignorerer vi stille.
          }
        },
      },
    }
  );
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export type ParticipantRequestContext = {
  authUserId: string;
  participantId: string;
  sessionId: string;
  studentName: string;
  startOffset: number | string | null;
  teamId: string | null;
  adminSupabase: AdminSupabaseClient;
};

type ResolveParticipantRequestOptions = {
  adminSupabase?: AdminSupabaseClient;
  claimedParticipantId?: string | null;
  claimedSessionId?: string | null;
};

type ResolveParticipantRequestResult =
  | { ok: true; data: ParticipantRequestContext }
  | { ok: false; status: number; error: string };

export async function resolveParticipantRequestContext(
  options: ResolveParticipantRequestOptions = {}
): Promise<ResolveParticipantRequestResult> {
  const adminSupabase = options.adminSupabase ?? createAdminClient();
  if (!adminSupabase) {
    return {
      ok: false,
      status: 503,
      error: ADMIN_ACCESS_MISSING_MESSAGE,
    };
  }

  const participantSupabase = await createParticipantClient();
  const {
    data: { user },
    error: userError,
  } = await participantSupabase.auth.getUser();

  if (userError || !user?.id) {
    return {
      ok: false,
      status: 401,
      error: "Deltager-login mangler eller er udløbet.",
    };
  }

  const { data: participantRow, error: participantError } = await adminSupabase
    .from("participants")
    .select("id,session_id,student_name,start_offset,zone_krig_team_id,auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle<ParticipantRow>();

  if (participantError) {
    console.error("Kunne ikke slå deltager op via auth_user_id:", participantError);
    return {
      ok: false,
      status: 500,
      error: "Kunne ikke validere deltager-login.",
    };
  }

  const participantId = asTrimmedString(participantRow?.id);
  const sessionId = asTrimmedString(participantRow?.session_id);
  const studentName = asTrimmedString(participantRow?.student_name);

  if (!participantId || !sessionId) {
    return {
      ok: false,
      status: 401,
      error: "Deltager-login er ikke knyttet til en aktiv deltager.",
    };
  }

  const claimedParticipantId = asTrimmedString(options.claimedParticipantId);
  if (claimedParticipantId && claimedParticipantId !== participantId) {
    return {
      ok: false,
      status: 403,
      error: "Deltager-id matcher ikke den aktive deltager-session.",
    };
  }

  const claimedSessionId = asTrimmedString(options.claimedSessionId);
  if (claimedSessionId && claimedSessionId !== sessionId) {
    return {
      ok: false,
      status: 403,
      error: "Session-id matcher ikke den aktive deltager-session.",
    };
  }

  return {
    ok: true,
    data: {
      authUserId: user.id,
      participantId,
      sessionId,
      studentName,
      startOffset: participantRow?.start_offset ?? null,
      teamId: asTrimmedString(participantRow?.zone_krig_team_id) || null,
      adminSupabase,
    },
  };
}
