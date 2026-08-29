const CHARACTER_COMPLETION_METADATA_KEYS = new Set([
  "session_id",
  "participant_id",
  "student_name",
  "post_index",
  "question_index",
  "selected_index",
  "answer_index",
  "is_correct",
  "awarded_points",
  "answered_at",
  "created_at",
]);

/**
 * Converts an untrusted answer-shaped payload into the only metadata a
 * character-post completion may persist. Content and position fields are
 * dropped even if a future client accidentally sends them.
 */
export function buildCharacterCompletionMetadataPayload(
  payload: Record<string, unknown>,
) {
  const metadataOnly = Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      CHARACTER_COMPLETION_METADATA_KEYS.has(key),
    ),
  );

  return {
    ...metadataOnly,
    selected_index: 0,
    answer_index: 0,
    is_correct: true,
    awarded_points: 0,
  };
}
