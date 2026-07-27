import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";

export const POST_ORDER_MODES = {
  FIXED: "fixed",
  DISTRIBUTED_CIRCULAR: "distributed_circular",
  RANDOM_PER_ASSIGNMENT: "random_per_assignment",
} as const;

export type PostOrderMode = (typeof POST_ORDER_MODES)[keyof typeof POST_ORDER_MODES];
export type ActivePostOrderMode =
  | typeof POST_ORDER_MODES.FIXED
  | typeof POST_ORDER_MODES.DISTRIBUTED_CIRCULAR;

export const CURRENT_ROUTE_VERSION = 1;

export const ACTIVE_POST_ORDER_MODES = [
  POST_ORDER_MODES.FIXED,
  POST_ORDER_MODES.DISTRIBUTED_CIRCULAR,
] as const satisfies readonly ActivePostOrderMode[];

const DISTRIBUTED_CIRCULAR_RACE_TYPES = new Set<string>([
  RACE_TYPES.MANUEL,
  RACE_TYPES.DANSK,
  RACE_TYPES.ENGELSK,
  RACE_TYPES.MATEMATIK,
  RACE_TYPES.FOTO,
]);

const GENERIC_STANDARD_RACE_TYPE_ALIASES = new Set<string>([
  "standard",
  "standardloeb",
  "standardløb",
  "standard race",
  "standard run",
  "generel",
  "general",
  "blandet",
  "mixed",
]);

const ALWAYS_FIXED_RACE_TYPE_ALIASES = new Set<string>([
  RACE_TYPES.ESCAPE,
  RACE_TYPES.ROLLESPIL,
  RACE_TYPES.ZONE_KRIG,
  RACE_TYPES.STRATEGO,
  RACE_TYPES.FIND_BEDRAGEREN,
  RACE_TYPES.PODCAST,
  RACE_TYPES.MUSIKQUIZ,
  RACE_TYPES.SCANNER,
  RACE_TYPES.SELFIE,
  "stjerneloeb",
  "stjerneløb",
  "star race",
]);

function normalizePolicyKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("da-DK") : null;
}

export function isPostOrderMode(value: unknown): value is PostOrderMode {
  return (
    value === POST_ORDER_MODES.FIXED ||
    value === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR ||
    value === POST_ORDER_MODES.RANDOM_PER_ASSIGNMENT
  );
}

export function isActivePostOrderMode(value: unknown): value is ActivePostOrderMode {
  return value === POST_ORDER_MODES.FIXED || value === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR;
}

/**
 * Converts persisted or external values to a mode that V1 may execute.
 *
 * Legacy/null/unknown values and the reserved random mode deliberately resolve
 * to fixed. random_per_assignment is part of the persisted type vocabulary,
 * but is not active until a server-persisted random route exists.
 */
export function normalizePostOrderMode(value: unknown): ActivePostOrderMode {
  return value === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
    ? POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
    : POST_ORDER_MODES.FIXED;
}

/**
 * Only ordinary, sequence-independent GPS races may use a distributed start.
 * Unknown race types fail closed so a new special game cannot accidentally
 * inherit standard-route behavior.
 */
export function isDistributedCircularEligibleRaceType(raceType: unknown) {
  const policyKey = normalizePolicyKey(raceType);
  if (!policyKey || ALWAYS_FIXED_RACE_TYPE_ALIASES.has(policyKey)) {
    return false;
  }

  if (GENERIC_STANDARD_RACE_TYPE_ALIASES.has(policyKey)) {
    return true;
  }

  const normalizedRaceType = normalizeRaceType(raceType);
  return normalizedRaceType !== null && DISTRIBUTED_CIRCULAR_RACE_TYPES.has(normalizedRaceType);
}

export function resolvePostOrderMode(
  requestedMode: unknown,
  raceType: unknown
): ActivePostOrderMode {
  const normalizedMode = normalizePostOrderMode(requestedMode);
  if (normalizedMode !== POST_ORDER_MODES.DISTRIBUTED_CIRCULAR) {
    return POST_ORDER_MODES.FIXED;
  }

  return isDistributedCircularEligibleRaceType(raceType)
    ? POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
    : POST_ORDER_MODES.FIXED;
}

export function getDefaultPostOrderModeForNewRun(raceType: unknown): ActivePostOrderMode {
  return isDistributedCircularEligibleRaceType(raceType)
    ? POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
    : POST_ORDER_MODES.FIXED;
}

export function isSupportedRouteVersion(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(parsed) && parsed === CURRENT_ROUTE_VERSION;
}

/**
 * Applies the persisted session snapshot. Unknown route versions fail closed
 * so a future assignment contract cannot accidentally execute as V1.
 */
export function resolveSessionPostOrderMode(
  requestedMode: unknown,
  raceType: unknown,
  routeVersion: unknown
): ActivePostOrderMode {
  if (!isSupportedRouteVersion(routeVersion)) {
    return POST_ORDER_MODES.FIXED;
  }

  return resolvePostOrderMode(requestedMode, raceType);
}

export function normalizeCircularStartOffset(startOffset: number, postCount: number) {
  if (!Number.isSafeInteger(postCount) || postCount <= 1) {
    return 0;
  }

  if (!Number.isSafeInteger(startOffset)) {
    return 0;
  }

  return ((startOffset % postCount) + postCount) % postCount;
}

/**
 * Builds the canonical circular order for a persisted start offset.
 * Invalid/empty post counts return an empty route; invalid offsets fall back
 * deterministically to zero.
 */
export function buildCircularRouteOrder(postCount: number, startOffset: number): number[] {
  if (!Number.isSafeInteger(postCount) || postCount <= 0) {
    return [];
  }

  const normalizedOffset = normalizeCircularStartOffset(startOffset, postCount);
  return Array.from({ length: postCount }, (_, index) => (index + normalizedOffset) % postCount);
}

export function buildEvenStartOffsets(
  postCount: number,
  participantCount: number,
  mode: unknown
): number[] {
  if (!Number.isSafeInteger(participantCount) || participantCount <= 0) {
    return [];
  }

  if (
    mode !== POST_ORDER_MODES.DISTRIBUTED_CIRCULAR ||
    !Number.isSafeInteger(postCount) ||
    postCount <= 0
  ) {
    return Array.from({ length: participantCount }, () => 0);
  }

  return Array.from({ length: participantCount }, (_, index) =>
    Math.floor((index * postCount) / participantCount)
  );
}

export function pickLateJoinStartOffset(postCount: number, existingOffsets: number[]): number {
  if (!Number.isSafeInteger(postCount) || postCount <= 1) {
    return 0;
  }

  const normalizedOffsets = existingOffsets
    .filter(Number.isSafeInteger)
    .map((offset) => normalizeCircularStartOffset(offset, postCount));
  const loadByOffset = Array.from({ length: postCount }, () => 0);
  normalizedOffsets.forEach((offset) => {
    loadByOffset[offset] += 1;
  });

  const minimumLoad = Math.min(...loadByOffset);
  const usedOffsets = [...new Set(normalizedOffsets)];
  const candidates = loadByOffset
    .map((load, offset) => ({ load, offset }))
    .filter(({ load }) => load === minimumLoad)
    .map(({ offset }) => {
      const distance =
        usedOffsets.length === 0
          ? postCount
          : Math.min(
              ...usedOffsets.map((usedOffset) => {
                const directDistance = Math.abs(offset - usedOffset);
                return Math.min(directDistance, postCount - directDistance);
              })
            );

      return { distance, offset };
    })
    .sort((left, right) => right.distance - left.distance || left.offset - right.offset);

  return candidates[0]?.offset ?? 0;
}
