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

export type RaceTypeCreationEntry = "direct" | "handoff" | "indirect" | "edit-only";

type RaceTypeArchiveEdit = { supported: true } | { supported: false; reason: string };

export type RaceTypeCapability = {
  /**
   * This label is also used by the archive filter. Keeping it here prevents
   * the builder router and archive from growing separate type lists.
   */
  label: string;
  creationEntry: RaceTypeCreationEntry;
  newRunHref: string | null;
  /**
   * Existing deep links and copy-return links use this path. It deliberately
   * stays separate from whether the archive may promise a safe edit action.
   */
  legacyEditPath: string;
  archiveEdit: RaceTypeArchiveEdit;
};

const PODCAST_ARCHIVE_EDIT_UNAVAILABLE =
  "Redigering af eksisterende podcastløb er ikke understøttet endnu. Løbet og afviklingen er bevaret.";
const FIND_BEDRAGEREN_ARCHIVE_EDIT_UNAVAILABLE =
  "Redigering af eksisterende Find Bedrageren-spil er ikke understøttet endnu. Spillet kan stadig startes.";

/**
 * One registry for persisted race types, creation entry points, legacy edit
 * routes, and the narrower actions that are safe to offer in the archive.
 */
export const RACE_TYPE_CAPABILITIES = {
  [RACE_TYPES.MANUEL]: {
    label: "Generel Quiz",
    creationEntry: "direct",
    newRunHref: "/dashboard/opret/manuel",
    legacyEditPath: "/dashboard/opret/manuel",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.DANSK]: {
    label: "Dansk",
    creationEntry: "direct",
    newRunHref: "/dashboard/opret/dansk",
    legacyEditPath: "/dashboard/opret/dansk",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.ENGELSK]: {
    label: "Engelsk",
    creationEntry: "direct",
    newRunHref: "/dashboard/opret/engelsk",
    legacyEditPath: "/dashboard/opret/engelsk",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.MATEMATIK]: {
    label: "Matematik",
    creationEntry: "direct",
    newRunHref: "/dashboard/opret/matematik",
    legacyEditPath: "/dashboard/opret/matematik",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.FOTO]: {
    label: "Foto",
    creationEntry: "direct",
    newRunHref: "/dashboard/opret/foto",
    legacyEditPath: "/dashboard/opret/foto",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.SCANNER]: {
    label: "Bog-Scanner",
    creationEntry: "handoff",
    newRunHref: "/dashboard/opret/scanner",
    legacyEditPath: "/dashboard/opret/manuel",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.SELFIE]: {
    label: "Selfie",
    creationEntry: "edit-only",
    newRunHref: null,
    legacyEditPath: "/dashboard/opret/selfie",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.ESCAPE]: {
    label: "Escape",
    creationEntry: "edit-only",
    newRunHref: null,
    legacyEditPath: "/dashboard/opret/escape",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.ROLLESPIL]: {
    label: "Rollespil",
    creationEntry: "edit-only",
    newRunHref: null,
    legacyEditPath: "/dashboard/opret/rollespil",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.PODCAST]: {
    label: "Podcast-Detektiven",
    creationEntry: "handoff",
    newRunHref: "/dashboard/opret/podcast",
    legacyEditPath: "/dashboard/opret/podcast",
    archiveEdit: { supported: false, reason: PODCAST_ARCHIVE_EDIT_UNAVAILABLE },
  },
  [RACE_TYPES.ZONE_KRIG]: {
    label: "Zone-Krigen",
    creationEntry: "direct",
    newRunHref: "/dashboard/opret/zone-krig",
    legacyEditPath: "/dashboard/opret/zone-krig",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.STRATEGO]: {
    label: "Live Stratego",
    creationEntry: "edit-only",
    newRunHref: null,
    legacyEditPath: "/dashboard/opret/stratego",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.MUSIKQUIZ]: {
    label: "Musikquiz",
    creationEntry: "direct",
    newRunHref: "/dashboard/opret/musikquiz",
    legacyEditPath: "/dashboard/opret/musikquiz",
    archiveEdit: { supported: true },
  },
  [RACE_TYPES.FIND_BEDRAGEREN]: {
    label: "Find Bedrageren",
    creationEntry: "indirect",
    newRunHref: "/dashboard/opret/find-bedrageren",
    legacyEditPath: "/dashboard/opret/find-bedrageren",
    archiveEdit: { supported: false, reason: FIND_BEDRAGEREN_ARCHIVE_EDIT_UNAVAILABLE },
  },
} satisfies Record<RaceType, RaceTypeCapability>;

export const RACE_TYPE_LABELS: Record<RaceType, string> = RACE_TYPE_VALUES.reduce(
  (labels, raceType) => {
    labels[raceType] = RACE_TYPE_CAPABILITIES[raceType].label;
    return labels;
  },
  {} as Record<RaceType, string>
);

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

export type RunPostOrderRecord = {
  post_order_mode?: unknown;
  postOrderMode?: unknown;
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
  RunGameConfigRecord &
  RunPostOrderRecord;

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

export function getRaceTypeCapability(value: unknown): RaceTypeCapability | null {
  const normalizedRaceType = normalizeRaceType(value);
  return normalizedRaceType ? RACE_TYPE_CAPABILITIES[normalizedRaceType] : null;
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
  const capability = getRaceTypeCapability(raceType);
  if (!capability) return null;

  return `${capability.legacyEditPath}?id=${encodeURIComponent(runId)}`;
}

export type ArchiveEditCapability =
  | { status: "supported"; href: string }
  | { status: "unsupported"; reason: string };

/**
 * Archive UI must not equate "there is a historical deep link" with "this
 * existing run can safely be edited". The generic builder helper above remains
 * available for legacy links and copy-return flows.
 */
export function getArchiveEditCapability(runId: string, raceType: unknown): ArchiveEditCapability {
  const capability = getRaceTypeCapability(raceType);

  if (!capability) {
    return {
      status: "unsupported",
      reason: "Dette løb har en ukendt løbstype og kan ikke åbnes sikkert i redigering.",
    };
  }

  if (!capability.archiveEdit.supported) {
    return {
      status: "unsupported",
      reason: capability.archiveEdit.reason,
    };
  }

  return {
    status: "supported",
    href: `${capability.legacyEditPath}?id=${encodeURIComponent(runId)}`,
  };
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
