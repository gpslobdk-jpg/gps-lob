import "server-only";

import { PARTICIPANT_UPLOADS_BUCKET } from "@/lib/studentData/privacyPolicy";
import { createAdminClient } from "@/utils/supabase/admin";

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type PhotoObjectRow = {
  object_path?: string | null;
};

const STORAGE_REMOVE_CHUNK_SIZE = 100;

export async function registerParticipantPhotoObject({
  answerId,
  sessionId,
  participantId,
  objectPath,
  adminSupabase,
}: {
  answerId: string;
  sessionId: string;
  participantId: string;
  objectPath: string;
  adminSupabase: AdminSupabaseClient;
}) {
  const { error } = await adminSupabase
    .from("participant_photo_objects")
    .insert({
      answer_id: answerId,
      session_id: sessionId,
      participant_id: participantId,
      object_path: objectPath,
    });

  if (error) {
    throw new Error("Kunne ikke registrere det private fotoobjekt sikkert.");
  }
}

export async function deleteParticipantPhotosForSessions({
  sessionIds,
  adminSupabase,
}: {
  sessionIds: string[];
  adminSupabase: AdminSupabaseClient;
}) {
  if (sessionIds.length === 0) return 0;

  const { data, error } = await adminSupabase
    .from("participant_photo_objects")
    .select("object_path")
    .in("session_id", sessionIds);

  if (error) {
    throw new Error("Kunne ikke hente private fotoobjekter til sletning.");
  }

  const objectPaths = Array.from(
    new Set(
      ((data ?? []) as PhotoObjectRow[])
        .map((row) => row.object_path?.trim() ?? "")
        .filter(Boolean)
    )
  );

  for (let index = 0; index < objectPaths.length; index += STORAGE_REMOVE_CHUNK_SIZE) {
    const { error: storageError } = await adminSupabase.storage
      .from(PARTICIPANT_UPLOADS_BUCKET)
      .remove(objectPaths.slice(index, index + STORAGE_REMOVE_CHUNK_SIZE));

    if (storageError) {
      throw new Error("Et eller flere private fotoobjekter kunne ikke slettes.");
    }
  }

  return objectPaths.length;
}
