type BuilderDraftEnvelope<T> = {
  version: 1;
  editRunId: string | null;
  savedAt: string;
  data: T;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEditRunId(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export function restoreDraftString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function restoreDraftBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function restoreDraftMapCenter(
  value: unknown,
  fallback: {
    lat: number;
    lng: number;
  }
) {
  if (!isRecord(value)) return fallback;

  const lat = typeof value.lat === "number" && Number.isFinite(value.lat) ? value.lat : fallback.lat;
  const lng = typeof value.lng === "number" && Number.isFinite(value.lng) ? value.lng : fallback.lng;

  return { lat, lng };
}

export function clearRunDraft(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignorer browserfejl ved localStorage.
  }
}

export function writeRunDraft<T>(key: string, editRunId: string | null | undefined, data: T) {
  if (typeof window === "undefined") return;

  const payload: BuilderDraftEnvelope<T> = {
    version: 1,
    editRunId: normalizeEditRunId(editRunId),
    savedAt: new Date().toISOString(),
    data,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignorer browserfejl ved localStorage.
  }
}

export function readRunDraft<T>(key: string, editRunId: string | null | undefined) {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(key);
    if (!rawDraft) return null;

    const parsed = JSON.parse(rawDraft) as Partial<BuilderDraftEnvelope<T>>;
    if (parsed.version !== 1 || !("data" in parsed)) {
      clearRunDraft(key);
      return null;
    }

    if (normalizeEditRunId(parsed.editRunId) !== normalizeEditRunId(editRunId)) {
      return null;
    }

    return parsed.data ?? null;
  } catch {
    clearRunDraft(key);
    return null;
  }
}

export function restoreRunDraft<T>(
  key: string,
  editRunId: string | null | undefined,
  confirmMessage: string
) {
  const draft = readRunDraft<T>(key, editRunId);
  if (!draft) return null;

  if (!window.confirm(confirmMessage)) {
    clearRunDraft(key);
    return null;
  }

  return draft;
}
