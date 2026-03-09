export const RACE_TYPES = {
  MANUEL: "manuel",
  FOTO: "foto",
  SELFIE: "selfie",
  ESCAPE: "escape",
  ROLLESPIL: "rollespil",
} as const;

export type RaceType = (typeof RACE_TYPES)[keyof typeof RACE_TYPES];

export const DEFAULT_MAP_CENTER = {
  lat: 55.6761,
  lng: 12.5683,
} as const;

type StoredDescriptionRecord = {
  masterCode?: unknown;
};

export type StoredRunRecord = {
  id: string;
  user_id: string | null;
  title: string | null;
  subject: string | null;
  description: string | null;
  topic: string | null;
  questions: unknown;
  race_type?: string | null;
  raceType?: string | null;
};

export function normalizeRaceType(value: unknown): RaceType | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toLocaleLowerCase("da-DK")) {
    case "quiz":
    case "manuel":
    case "manual":
      return RACE_TYPES.MANUEL;
    case "foto":
    case "photo":
      return RACE_TYPES.FOTO;
    case "selfie":
      return RACE_TYPES.SELFIE;
    case "escape":
    case "escape_room":
    case "escaperoom":
      return RACE_TYPES.ESCAPE;
    case "rollespil":
    case "roleplay":
    case "role_play":
    case "tidsmaskinen":
      return RACE_TYPES.ROLLESPIL;
    default:
      return null;
  }
}

export function getBuilderHrefForRaceType(runId: string, raceType: unknown) {
  const normalizedRaceType = normalizeRaceType(raceType);
  if (!normalizedRaceType) return null;

  return `/dashboard/opret/${normalizedRaceType}?id=${encodeURIComponent(runId)}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function asNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function toQuestionId(value: unknown, fallback: number) {
  const parsed = asNumberOrNull(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : fallback;
}

export function readDescriptionObject(value: unknown) {
  if (isRecord(value)) return value as StoredDescriptionRecord;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? (parsed as StoredDescriptionRecord) : null;
  } catch {
    return null;
  }
}

export function readMasterCodeFromDescription(value: unknown) {
  const description = readDescriptionObject(value);
  return asTrimmedString(description?.masterCode);
}
