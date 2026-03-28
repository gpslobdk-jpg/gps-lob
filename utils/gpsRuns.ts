export const RACE_TYPES = {
  MANUEL: "manuel",
  DANSK: "dansk",
  ENGELSK: "engelsk",
  MATEMATIK: "matematik",
  FOTO: "foto",
  SCANNER: "scanner",
  SELFIE: "selfie",
  ESCAPE: "escape",
  ROLLESPIL: "rollespil",
  PODCAST: "podcast",
  ZONE_KRIG: "zone_krig",
} as const;

export type RaceType = (typeof RACE_TYPES)[keyof typeof RACE_TYPES];

export const RACE_TYPE_LABELS: Record<RaceType, string> = {
  [RACE_TYPES.MANUEL]: "Generel Quiz",
  [RACE_TYPES.DANSK]: "Dansk",
  [RACE_TYPES.ENGELSK]: "Engelsk",
  [RACE_TYPES.MATEMATIK]: "Matematik",
  [RACE_TYPES.FOTO]: "Foto",
  [RACE_TYPES.SCANNER]: "Bog-Scanner",
  [RACE_TYPES.SELFIE]: "Selfie",
  [RACE_TYPES.ESCAPE]: "Escape",
  [RACE_TYPES.ROLLESPIL]: "Rollespil",
  [RACE_TYPES.PODCAST]: "Podcast-Detektiven",
  [RACE_TYPES.ZONE_KRIG]: "Zone-Krigen",
};

export const DEFAULT_MAP_CENTER = {
  lat: 55.6761,
  lng: 12.5683,
} as const;

type StoredDescriptionRecord = {
  text?: unknown;
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
  radius?: number | null;
  race_type?: string | null;
  raceType?: string | null;
};

export function normalizeRaceType(value: unknown): RaceType | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toLocaleLowerCase("da-DK")) {
    case "quiz":
    case "generel quiz":
    case "manuel":
    case "manual":
      return RACE_TYPES.MANUEL;
    case "dansk":
    case "danish":
      return RACE_TYPES.DANSK;
    case "engelsk":
    case "english":
      return RACE_TYPES.ENGELSK;
    case "matematik":
    case "math":
      return RACE_TYPES.MATEMATIK;
    case "foto":
    case "photo":
      return RACE_TYPES.FOTO;
    case "scanner":
    case "scan":
    case "bog-scanner":
    case "bog scanner":
    case "bog-scanneren":
    case "bog scanneren":
    case "bogscanner":
    case "bookscanner":
    case "qr":
    case "qrscanner":
      return RACE_TYPES.SCANNER;
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
    case "podcast":
      return RACE_TYPES.PODCAST;
    case "zone_krig":
    case "zone-krig":
    case "zone-krigen":
    case "zone krigen":
    case "zonekrig":
      return RACE_TYPES.ZONE_KRIG;
    default:
      return null;
  }
}

export function getBuilderHrefForRaceType(runId: string, raceType: unknown) {
  const normalizedRaceType = normalizeRaceType(raceType);
  if (!normalizedRaceType) return null;

  const builderPathByRaceType: Record<RaceType, string> = {
    [RACE_TYPES.MANUEL]: "/dashboard/opret/manuel",
    [RACE_TYPES.DANSK]: "/dashboard/opret/dansk",
    [RACE_TYPES.ENGELSK]: "/dashboard/opret/engelsk",
    [RACE_TYPES.MATEMATIK]: "/dashboard/opret/matematik",
    [RACE_TYPES.FOTO]: "/dashboard/opret/foto",
    [RACE_TYPES.SCANNER]: "/dashboard/opret/scanner",
    [RACE_TYPES.SELFIE]: "/dashboard/opret/selfie",
    [RACE_TYPES.ESCAPE]: "/dashboard/opret/escape",
    [RACE_TYPES.ROLLESPIL]: "/dashboard/opret/rollespil",
    [RACE_TYPES.PODCAST]: "/dashboard/opret/podcast",
    [RACE_TYPES.ZONE_KRIG]: "/dashboard/opret/zone-krig",
  };

  return `${builderPathByRaceType[normalizedRaceType]}?id=${encodeURIComponent(runId)}`;
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

export function readDescriptionText(value: unknown) {
  const description = readDescriptionObject(value);
  if (description) {
    const text = asTrimmedString(description.text);
    if (text) return text;
  }

  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  return trimmed.startsWith("{") ? "" : trimmed;
}

export function readMasterCodeFromDescription(value: unknown) {
  const description = readDescriptionObject(value);
  return asTrimmedString(description?.masterCode);
}

export function serializeEscapeDescription(descriptionText: string, masterCode: string) {
  return JSON.stringify({
    text: descriptionText.trim(),
    masterCode: asTrimmedString(masterCode),
  });
}
