/** Shared, user-facing contract for a participant removed from one live session. */
export const PARTICIPANT_REMOVED_MESSAGE =
  "Dit hold er fjernet fra løbet. Kontakt din lærer.";

export const PARTICIPANT_REMOVED_CODE = "PARTICIPANT_REMOVED";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isParticipantRemovalUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}
