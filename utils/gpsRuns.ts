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
  STRATEGO: "stratego",
  MUSIKQUIZ: "musikquiz",
  FIND_BEDRAGEREN: "find_bedrageren",
} as const;

export type RaceType = (typeof RACE_TYPES)[keyof typeof RACE_TYPES];

export const RACE_TYPE_VALUES = [
  RACE_TYPES.MANUEL,
  RACE_TYPES.DANSK,
  RACE_TYPES.ENGELSK,
  RACE_TYPES.MATEMATIK,
  RACE_TYPES.FOTO,
  RACE_TYPES.SCANNER,
  RACE_TYPES.SELFIE,
  RACE_TYPES.ESCAPE,
  RACE_TYPES.ROLLESPIL,
  RACE_TYPES.PODCAST,
  RACE_TYPES.ZONE_KRIG,
  RACE_TYPES.STRATEGO,
  RACE_TYPES.MUSIKQUIZ,
  RACE_TYPES.FIND_BEDRAGEREN,
] as const;

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
  [RACE_TYPES.STRATEGO]: "Live Stratego",
  [RACE_TYPES.MUSIKQUIZ]: "Musikquiz",
  [RACE_TYPES.FIND_BEDRAGEREN]: "Find Bedrageren",
};

export const DEFAULT_MAP_CENTER = {
  lat: 55.6761,
  lng: 12.5683,
} as const;

export type BaseLocation = {
  lat: number;
  lng: number;
};

export type StrategoBasePreset = {
  redBase: BaseLocation | null;
  blueBase: BaseLocation | null;
};

type StoredDescriptionRecord = {
  text?: unknown;
  masterCode?: unknown;
};

export type RunRaceTypeRecord = {
  race_type?: RaceType | null;
  raceType?: RaceType | null;
};

export type RunGameConfigRecord = {
  game_config?: unknown;
  gameConfig?: unknown;
};

export type RunQuestionRecord = {
  id?: number | null;
  type?: "multiple_choice" | "ai_image";
  text?: string | null;
  aiPrompt?: string | null;
  ai_prompt?: string | null;
  answers?: string[] | null;
  correctIndex?: number | null;
  correct_index?: number | null;
  lat?: number | null;
  lng?: number | null;
  mediaUrl?: string | null;
  media_url?: string | null;
  isSelfie?: boolean | null;
  is_selfie?: boolean | null;
};

export type StoredRunRecord = {
  id: string;
  user_id: string | null;
  title: string | null;
  subject: string | null;
  description: string | null;
  topic: string | null;
  questions: unknown;
  created_at?: string | null;
  grade_levels?: string[] | null;
  radius?: number | null;
} & RunRaceTypeRecord &
  RunGameConfigRecord;

export type RunRecordWithNormalizedRaceType<T extends { race_type?: unknown; raceType?: unknown }> = Omit<
  T,
  "race_type" | "raceType"
> & {
  race_type: RaceType | null;
  raceType: RaceType | null;
};

export function isRaceType(value: unknown): value is RaceType {
  return typeof value === "string" && (RACE_TYPE_VALUES as readonly string[]).includes(value);
}

export function normalizeRaceType(value: unknown): RaceType | null {
  if (isRaceType(value)) {
    return value;
  }

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
    case "stratego":
    case "live_stratego":
    case "live-stratego":
    case "live stratego":
      return RACE_TYPES.STRATEGO;
    case "zone_krig":
    case "zone-krig":
    case "zone-krigen":
    case "zone krigen":
    case "zonekrig":
      return RACE_TYPES.ZONE_KRIG;
    case "musikquiz":
    case "musik quiz":
    case "musik-quiz":
      return RACE_TYPES.MUSIKQUIZ;
    case "find_bedrageren":
    case "find-bedrageren":
    case "find bedrageren":
    case "bedrageren":
    case "impostor":
    case "find impostor":
      return RACE_TYPES.FIND_BEDRAGEREN;
    default:
      return null;
  }
}

export function getNormalizedRunRaceType(run: { race_type?: unknown; raceType?: unknown } | null | undefined) {
  return normalizeRaceType(run?.race_type ?? run?.raceType);
}

export function withNormalizedRunRaceType<T extends { race_type?: unknown; raceType?: unknown }>(
  run: T
): RunRecordWithNormalizedRaceType<T> {
  const normalizedRaceType = getNormalizedRunRaceType(run);

  return {
    ...run,
    race_type: normalizedRaceType,
    raceType: normalizedRaceType,
  } as RunRecordWithNormalizedRaceType<T>;
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
    [RACE_TYPES.SCANNER]: "/dashboard/opret/manuel",
    [RACE_TYPES.SELFIE]: "/dashboard/opret/selfie",
    [RACE_TYPES.ESCAPE]: "/dashboard/opret/escape",
    [RACE_TYPES.ROLLESPIL]: "/dashboard/opret/rollespil",
    [RACE_TYPES.PODCAST]: "/dashboard/opret/podcast",
    [RACE_TYPES.ZONE_KRIG]: "/dashboard/opret/zone-krig",
    [RACE_TYPES.STRATEGO]: "/dashboard/opret/stratego",
    [RACE_TYPES.MUSIKQUIZ]: "/dashboard/opret/musikquiz",
    [RACE_TYPES.FIND_BEDRAGEREN]: "/dashboard/opret/find-bedrageren",
  };

  return `${builderPathByRaceType[normalizedRaceType]}?id=${encodeURIComponent(runId)}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRunGameConfig(record: RunGameConfigRecord | null | undefined) {
  const rawValue = record?.game_config ?? record?.gameConfig;

  if (isRecord(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

function toBaseLocation(latValue: unknown, lngValue: unknown) {
  const lat = asNumberOrNull(latValue);
  const lng = asNumberOrNull(lngValue);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng } satisfies BaseLocation;
}

export function getStrategoBasePreset(record: RunGameConfigRecord | null | undefined): StrategoBasePreset {
  const gameConfig = readRunGameConfig(record);
  const strategoConfig = isRecord(gameConfig?.stratego) ? (gameConfig.stratego as Record<string, unknown>) : gameConfig;

  return {
    redBase: strategoConfig
      ? toBaseLocation(strategoConfig.red_base_lat, strategoConfig.red_base_lng)
      : null,
    blueBase: strategoConfig
      ? toBaseLocation(strategoConfig.blue_base_lat, strategoConfig.blue_base_lng)
      : null,
  };
}

export function buildStrategoGameConfig(preset: StrategoBasePreset) {
  const strategoConfig: Record<string, number> = {};

  if (preset.redBase) {
    strategoConfig.red_base_lat = preset.redBase.lat;
    strategoConfig.red_base_lng = preset.redBase.lng;
  }

  if (preset.blueBase) {
    strategoConfig.blue_base_lat = preset.blueBase.lat;
    strategoConfig.blue_base_lng = preset.blueBase.lng;
  }

  if (Object.keys(strategoConfig).length === 0) {
    return {};
  }

  return {
    stratego: strategoConfig,
  };
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
