export const FOCUS_SAVE_WARNING_KEY = "skolegps-focus-save-warning";
export const FOCUS_SAVE_WARNING_EVENT = "skolegps-focus-save-warning";
export const FOCUS_SAVE_WARNING = "Løbet er gemt, men Fokusmode kunne ikke gemmes. Kontrollér Fokusmode i livevisningen, før eleverne starter.";

export type TeacherFocusParticipant = {
  participantId: string;
  displayName: string;
  excluded: boolean;
  eventCount: number;
  latestEventAt: string | null;
  latestDurationMs: number | null;
};

export type TeacherFocusState = {
  available: boolean;
  enabled: boolean;
  participants: TeacherFocusParticipant[];
};

// This helper never throws: focus requests are separate from saving/starting a run.
export async function requestTeacherFocus(path: "run" | "session", value: Record<string, unknown>, method: "GET" | "PATCH" = "GET"): Promise<unknown | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 4000);
    const query = method === "GET" ? `?${new URLSearchParams(Object.entries(value).map(([key, entry]) => [key, String(entry)]))}` : "";
    const response = await fetch(`/api/focus-mode/${path}${query}`, {
      method,
      signal: controller.signal,
      cache: "no-store",
      ...(method === "PATCH" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) } : {}),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function parseTeacherFocusState(value: unknown): TeacherFocusState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Record<string, unknown>;
  if (state.available !== true || typeof state.enabled !== "boolean" || !Array.isArray(state.participants)) return null;
  return {
    available: true,
    enabled: state.enabled,
    participants: state.participants.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Record<string, unknown>;
      if (typeof entry.participantId !== "string") return [];
      return [{
        participantId: entry.participantId,
        displayName: typeof entry.displayName === "string" ? entry.displayName : "Deltager",
        excluded: entry.excluded === true,
        eventCount: typeof entry.eventCount === "number" && Number.isFinite(entry.eventCount) ? Math.max(0, Math.floor(entry.eventCount)) : 0,
        latestEventAt: typeof entry.latestEventAt === "string" ? entry.latestEventAt : null,
        latestDurationMs: typeof entry.latestDurationMs === "number" && Number.isFinite(entry.latestDurationMs) ? Math.max(0, entry.latestDurationMs) : null,
      }];
    }),
  };
}

export function notifyFocusSaveFailure() {
  try { window.sessionStorage.setItem(FOCUS_SAVE_WARNING_KEY, "1"); } catch { /* Optional notice storage. */ }
  try { window.dispatchEvent(new Event(FOCUS_SAVE_WARNING_EVENT)); } catch { /* A notice cannot fail a run save. */ }
}

export async function saveRunFocusMode(runId: string, enabled: boolean): Promise<boolean> {
  const result = await requestTeacherFocus("run", { runId, enabled }, "PATCH");
  const saved = Boolean(result && typeof result === "object" && "available" in result && result.available === true && "enabled" in result && result.enabled === enabled);
  if (!saved) notifyFocusSaveFailure();
  return saved;
}
