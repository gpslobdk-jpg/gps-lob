import {
  FOCUS_MODE_GRACE_MS,
  FOCUS_MODE_MAX_DURATION_MS,
  FOCUS_MODE_POLICY_MAX_AGE_MS,
} from "./focusMode";

export type FocusPolicy = {
  available: boolean;
  enabled: boolean;
  exempt: boolean;
  tracking: boolean;
  policyRevision: string | null;
};

export type FocusReturn = {
  hiddenAt: string;
  returnedAt: string;
  durationMs: number;
  policyRevision: string;
};

export const INACTIVE_FOCUS_POLICY: FocusPolicy = {
  available: false,
  enabled: false,
  exempt: false,
  tracking: false,
  policyRevision: null,
};

/** Unknown/old/malformed data disables this optional layer. */
export function readFocusPolicy(value: unknown): FocusPolicy {
  if (!value || typeof value !== "object") return INACTIVE_FOCUS_POLICY;
  const data = value as Record<string, unknown>;
  if (
    data.available !== true ||
    typeof data.enabled !== "boolean" ||
    typeof data.exempt !== "boolean" ||
    typeof data.tracking !== "boolean" ||
    typeof data.policyRevision !== "string" ||
    !data.policyRevision
  ) return INACTIVE_FOCUS_POLICY;
  return {
    available: true,
    enabled: data.enabled,
    exempt: data.exempt,
    tracking: data.enabled && !data.exempt && data.tracking,
    policyRevision: data.policyRevision,
  };
}

/**
 * One in-memory interval per visible page. No timers in background tabs, no
 * unload writes, and no persistence across refresh/navigation. An ambiguous
 * pagehide is deliberately discarded, including a BFCache navigation.
 */
export function createFocusLifecycle() {
  let policy = INACTIVE_FOCUS_POLICY;
  let hidden: { wallMs: number; revision: string } | null = null;
  let pageSuspended = false;
  let ignoreNextHiddenUntil = 0;
  let policyObservedAt = 0;

  return {
    setPolicy(nextPolicy: FocusPolicy, nowMs = Date.now()) {
      if (
        !nextPolicy.tracking ||
        nextPolicy.policyRevision !== policy.policyRevision
      ) hidden = null;
      policy = nextPolicy;
      policyObservedAt = nowMs;
    },
    hidden(nowMs: number) {
      if (
        hidden || pageSuspended || !policy.tracking ||
        !policy.policyRevision || !Number.isFinite(nowMs) ||
        nowMs - policyObservedAt > FOCUS_MODE_POLICY_MAX_AGE_MS
      ) return;
      if (nowMs <= ignoreNextHiddenUntil) {
        pageSuspended = true;
        ignoreNextHiddenUntil = 0;
        return;
      }
      hidden = { wallMs: nowMs, revision: policy.policyRevision };
    },
    visible(nowMs: number): FocusReturn | null {
      const interval = hidden;
      hidden = null;
      pageSuspended = false;
      ignoreNextHiddenUntil = 0;
      if (!interval || !policy.tracking || interval.revision !== policy.policyRevision) {
        return null;
      }
      const durationMs = Math.floor(nowMs - interval.wallMs);
      // A backwards or implausibly changed wall clock is not a focus event.
      if (!Number.isFinite(durationMs) || durationMs < FOCUS_MODE_GRACE_MS || durationMs > FOCUS_MODE_MAX_DURATION_MS) {
        return null;
      }
      return {
        hiddenAt: new Date(interval.wallMs).toISOString(),
        returnedAt: new Date(nowMs).toISOString(),
        durationMs,
        policyRevision: interval.revision,
      };
    },
    pageHide() {
      hidden = null;
      pageSuspended = true;
    },
    pageShow() {
      hidden = null;
      pageSuspended = false;
      ignoreNextHiddenUntil = 0;
    },
    ownFilePicker(nowMs: number) {
      hidden = null;
      // Only the immediate native-picker transition is exempt; a later app
      // switch still counts if the browser never hid for its file picker.
      ignoreNextHiddenUntil = nowMs + 2_000;
    },
    cancel() {
      hidden = null;
    },
  };
}
