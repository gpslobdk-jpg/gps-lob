export const SAVED_MATERIALS_EVENT = "skolegps:printbibliotek:saved";
const SAVED_MATERIALS_KEY = "skolegps:printbibliotek:saved:v1";
const SAVED_MATERIALS_VERSION = 1;

type SavedMaterialsPayload = {
  ids: string[];
  version: number;
};

function isSavedMaterialsPayload(value: unknown): value is SavedMaterialsPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SavedMaterialsPayload>;
  return payload.version === SAVED_MATERIALS_VERSION
    && Array.isArray(payload.ids)
    && payload.ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 160);
}

function uniqueIds(ids: readonly string[]) {
  return [...new Set(ids)].slice(0, 200);
}

export function readSavedMaterialIds(storage: Storage): string[] {
  const rawValue = storage.getItem(SAVED_MATERIALS_KEY);
  if (!rawValue) return [];

  try {
    const value: unknown = JSON.parse(rawValue);
    return isSavedMaterialsPayload(value) ? uniqueIds(value.ids) : [];
  } catch {
    return [];
  }
}

export function writeSavedMaterialIds(storage: Storage, ids: readonly string[]) {
  const payload: SavedMaterialsPayload = {
    version: SAVED_MATERIALS_VERSION,
    ids: uniqueIds(ids),
  };
  storage.setItem(SAVED_MATERIALS_KEY, JSON.stringify(payload));
  return payload.ids;
}

export function dispatchSavedMaterials(ids: readonly string[]) {
  window.dispatchEvent(new CustomEvent<string[]>(SAVED_MATERIALS_EVENT, {
    detail: uniqueIds(ids),
  }));
}
