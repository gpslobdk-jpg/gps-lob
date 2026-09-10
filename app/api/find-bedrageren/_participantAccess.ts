import { createAdminClient } from "@/utils/supabase/admin";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type ParticipantRemovalRow = {
  id: string | null;
  removed_at: string | null;
};

export type FindBedragerenParticipantAccess = "active" | "removed" | "missing";

/**
 * Find Bedrageren has its own durable cookie identity, not the normal
 * participant-auth cookie. Always check the participant row before exposing a
 * role, a vote, or a lobby snapshot so a soft-removed player cannot continue.
 */
export async function readFindBedragerenParticipantAccess(
  sessionId: string,
  participantId: string,
  adminSupabase: AdminSupabaseClient
): Promise<FindBedragerenParticipantAccess> {
  const { data, error } = await adminSupabase
    .from("participants")
    .select("id,removed_at")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .maybeSingle<ParticipantRemovalRow>();

  if (error) throw new Error(error.message);
  if (!data?.id) return "missing";
  return data.removed_at ? "removed" : "active";
}

/** Active player lists and results must omit soft-removed participants. */
export async function fetchActiveFindBedragerenParticipantIds(
  sessionId: string,
  adminSupabase: AdminSupabaseClient
) {
  const { data, error } = await adminSupabase
    .from("participants")
    .select("id")
    .eq("session_id", sessionId)
    .is("removed_at", null);

  if (error) throw new Error(error.message);
  return new Set(
    (data ?? [])
      .map((participant) => (typeof participant.id === "string" ? participant.id : ""))
      .filter(Boolean)
  );
}
