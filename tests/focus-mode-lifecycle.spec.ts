import { expect, test } from "@playwright/test";

import { FOCUS_MODE_GRACE_MS, FOCUS_MODE_POLICY_MAX_AGE_MS } from "@/lib/focusMode";
import {
  createFocusLifecycle,
  INACTIVE_FOCUS_POLICY,
  readFocusPolicy,
  type FocusPolicy,
} from "@/lib/focusModeLifecycle";

const NOW = Date.parse("2026-09-05T12:00:00.000Z");
const ACTIVE: FocusPolicy = {
  available: true, enabled: true, exempt: false, tracking: true,
  policyRevision: "first:0",
};

test("old, missing, failed and malformed focus data is inactive", () => {
  for (const input of [null, undefined, {}, [], { available: true }, { ...ACTIVE, policyRevision: null }]) {
    expect(readFocusPolicy(input)).toEqual(INACTIVE_FOCUS_POLICY);
  }
  expect(readFocusPolicy({ ...ACTIVE, enabled: false }).tracking).toBe(false);
  expect(readFocusPolicy({ ...ACTIVE, exempt: true }).tracking).toBe(false);
  const lifecycle = createFocusLifecycle();
  lifecycle.hidden(NOW);
  expect(lifecycle.visible(NOW + 4_000)).toBeNull();
});

test("short visibility loss is discarded and one long return has exact duration", () => {
  const lifecycle = createFocusLifecycle();
  lifecycle.setPolicy(ACTIVE, NOW);
  lifecycle.hidden(NOW);
  expect(lifecycle.visible(NOW + FOCUS_MODE_GRACE_MS - 1)).toBeNull();
  lifecycle.hidden(NOW + 4_000);
  lifecycle.hidden(NOW + 5_000);
  expect(lifecycle.visible(NOW + 9_000)).toEqual({
    hiddenAt: new Date(NOW + 4_000).toISOString(),
    returnedAt: new Date(NOW + 9_000).toISOString(),
    durationMs: 5_000,
    policyRevision: "first:0",
  });
  expect(lifecycle.visible(NOW + 10_000)).toBeNull();
});

test("pagehide, BFCache navigation, refresh and disposal discard their pending interval", () => {
  for (const cancel of ["pageHide", "pageShow", "cancel"] as const) {
    const lifecycle = createFocusLifecycle();
    lifecycle.setPolicy(ACTIVE, NOW);
    lifecycle.hidden(NOW);
    lifecycle[cancel]();
    expect(lifecycle.visible(NOW + 8_000)).toBeNull();
    lifecycle.hidden(NOW + 9_000);
    expect(lifecycle.visible(NOW + 13_000)?.durationMs).toBe(4_000);
  }
});

test("off/on and individual exception changes cancel stale pending intervals", () => {
  for (const changed of [
    { ...ACTIVE, tracking: false },
    { ...ACTIVE, tracking: false, exempt: true },
    { ...ACTIVE, policyRevision: "second:0" },
    { ...ACTIVE, policyRevision: "first:1" },
  ]) {
    const lifecycle = createFocusLifecycle();
    lifecycle.setPolicy(ACTIVE, NOW);
    lifecycle.hidden(NOW);
    lifecycle.setPolicy(changed, NOW + 1_000);
    lifecycle.setPolicy(ACTIVE, NOW + 2_000);
    expect(lifecycle.visible(NOW + 8_000)).toBeNull();
  }
});

test("stale policy does not start a hidden interval", () => {
  const lifecycle = createFocusLifecycle();
  lifecycle.setPolicy(ACTIVE, NOW);
  lifecycle.hidden(NOW + FOCUS_MODE_POLICY_MAX_AGE_MS + 1);
  expect(lifecycle.visible(NOW + FOCUS_MODE_POLICY_MAX_AGE_MS + 5_000)).toBeNull();
});

test("a native camera/file picker return is ignored once, without exempting later app switches", () => {
  const lifecycle = createFocusLifecycle();
  lifecycle.setPolicy(ACTIVE, NOW);
  lifecycle.ownFilePicker(NOW);
  lifecycle.hidden(NOW + 10);
  lifecycle.hidden(NOW + 10_000);
  expect(lifecycle.visible(NOW + 11_000)).toBeNull();
  lifecycle.hidden(NOW + 12_000);
  expect(lifecycle.visible(NOW + 16_000)?.durationMs).toBe(4_000);

  lifecycle.ownFilePicker(NOW + 16_000);
  lifecycle.hidden(NOW + 19_000);
  expect(lifecycle.visible(NOW + 23_000)?.durationMs).toBe(4_000);
});

test("backwards clock and implausibly long intervals are discarded", () => {
  for (const returnedAt of [NOW - 1, NOW + 31 * 60_000, Number.NaN]) {
    const lifecycle = createFocusLifecycle();
    lifecycle.setPolicy(ACTIVE, NOW);
    lifecycle.hidden(NOW);
    expect(lifecycle.visible(returnedAt)).toBeNull();
  }
});
