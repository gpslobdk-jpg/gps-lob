type BuilderDraftEnvelope<T> = {
  version: 1;
  editRunId: string | null;
  savedAt: string;
  data: T;
};

const AUTOLOAD_DRAFT_FLAG_KEY = "autoLoadDraft";
const AUTOLOAD_DRAFT_TARGET_KEY = "autoLoadDraftTarget";

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

export function writeSessionDraft<T>(key: string, data: T) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignorer browserfejl ved sessionStorage.
  }
}

export function readSessionDraft<T>(key: string) {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.sessionStorage.getItem(key);
    if (!rawDraft) return null;
    return JSON.parse(rawDraft) as T;
  } catch {
    clearSessionDraft(key);
    return null;
  }
}

export function clearSessionDraft(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignorer browserfejl ved sessionStorage.
  }
}

function getNavigationType() {
  if (typeof window === "undefined" || typeof window.performance === "undefined") {
    return "navigate";
  }

  const navigationEntries = window.performance.getEntriesByType("navigation");
  const navigationEntry = navigationEntries[0] as PerformanceNavigationTiming | undefined;
  return navigationEntry?.type ?? "navigate";
}

export function markDraftForAutoload(targetKey: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(AUTOLOAD_DRAFT_FLAG_KEY, "true");
    window.sessionStorage.setItem(AUTOLOAD_DRAFT_TARGET_KEY, targetKey);
  } catch {
    // Ignorer browserfejl ved sessionStorage.
  }
}

export function consumeDraftAutoload(targetKey: string) {
  if (typeof window === "undefined") return false;

  try {
    const shouldAutoLoad = window.sessionStorage.getItem(AUTOLOAD_DRAFT_FLAG_KEY) === "true";
    if (!shouldAutoLoad) return false;

    const storedTarget = window.sessionStorage.getItem(AUTOLOAD_DRAFT_TARGET_KEY);
    if (storedTarget && storedTarget !== targetKey) {
      return false;
    }

    window.sessionStorage.removeItem(AUTOLOAD_DRAFT_FLAG_KEY);
    window.sessionStorage.removeItem(AUTOLOAD_DRAFT_TARGET_KEY);
    return true;
  } catch {
    return false;
  }
}

export function shouldRestoreRunDraftOnLoad(targetKey: string) {
  if (consumeDraftAutoload(targetKey)) {
    return true;
  }

  const navigationType = getNavigationType();
  return navigationType === "reload" || navigationType === "back_forward";
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
