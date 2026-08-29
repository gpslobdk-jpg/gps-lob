export const CHARACTER_POST_TYPE = "character" as const;
export const PILEN_CHARACTER = "pilen" as const;
export const PILEN_LANGUAGE = "en" as const;
export const PILEN_DEFAULT_DURATION_SECONDS = 75;
export const PILEN_MIN_DURATION_SECONDS = 60;
export const PILEN_MAX_DURATION_SECONDS = 90;

export type CharacterPostConfig = {
  character: typeof PILEN_CHARACTER;
  language: typeof PILEN_LANGUAGE;
  topic: string;
  gradeLevel: string;
  placeDescription: string;
  maxDurationSeconds: number;
};

type CharacterPostRecord = Record<string, unknown> & {
  postType?: unknown;
  post_type?: unknown;
  characterConfig?: unknown;
  character_config?: unknown;
};

const MAX_TOPIC_LENGTH = 160;
const MAX_GRADE_LEVEL_LENGTH = 80;
const MAX_PLACE_DESCRIPTION_LENGTH = 240;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clipString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clampDuration(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return PILEN_DEFAULT_DURATION_SECONDS;
  return Math.min(
    PILEN_MAX_DURATION_SECONDS,
    Math.max(PILEN_MIN_DURATION_SECONDS, Math.round(parsed)),
  );
}

export function isCharacterPost(value: unknown): value is CharacterPostRecord {
  if (!isRecord(value)) return false;
  const postType =
    typeof value.postType === "string"
      ? value.postType
      : typeof value.post_type === "string"
        ? value.post_type
        : "";
  return postType.trim().toLocaleLowerCase("en-US") === CHARACTER_POST_TYPE;
}

export function normalizeCharacterPostConfig(
  value: unknown,
  fallback?: Partial<CharacterPostConfig>,
): CharacterPostConfig {
  const candidate = isRecord(value) ? value : {};

  return {
    // The foundation deliberately rejects character/provider expansion. A later
    // phase can widen these unions after a separate safety review.
    character: PILEN_CHARACTER,
    language: PILEN_LANGUAGE,
    topic: clipString(candidate.topic ?? fallback?.topic, MAX_TOPIC_LENGTH),
    gradeLevel: clipString(
      candidate.gradeLevel ?? candidate.grade_level ?? fallback?.gradeLevel,
      MAX_GRADE_LEVEL_LENGTH,
    ),
    placeDescription: clipString(
      candidate.placeDescription ??
        candidate.place_description ??
        fallback?.placeDescription,
      MAX_PLACE_DESCRIPTION_LENGTH,
    ),
    maxDurationSeconds: clampDuration(
      candidate.maxDurationSeconds ??
        candidate.max_duration_seconds ??
        fallback?.maxDurationSeconds,
    ),
  };
}

export function readCharacterPostConfig(value: unknown) {
  if (!isCharacterPost(value)) return null;
  return normalizeCharacterPostConfig(
    value.characterConfig ?? value.character_config,
  );
}

export function isCompleteCharacterPostConfig(config: CharacterPostConfig) {
  return Boolean(config.topic && config.placeDescription && config.gradeLevel);
}

/**
 * Strict public projection for the student client. Unknown keys are not spread,
 * so future prompt/provider fields cannot leak into play responses by accident.
 */
export function sanitizeCharacterPostForPlay(value: unknown) {
  if (!isCharacterPost(value)) return null;

  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    type: "multiple_choice" as const,
    postType: CHARACTER_POST_TYPE,
    text: "Pilen fortæller",
    answers: ["", "", "", ""],
    correctIndex: null,
    points: 0,
    lat,
    lng,
    characterConfig: normalizeCharacterPostConfig(
      value.characterConfig ?? value.character_config,
    ),
  };
}
