import {
  buildCircularRouteOrder,
  POST_ORDER_MODES,
  resolveSessionPostOrderMode,
} from "@/lib/routes/postOrderPolicy";

export type LiveRouteOverviewInput = {
  postIndexes: readonly number[];
  startOffset: unknown;
  completedPostIndexes: readonly unknown[];
  activePostIndex?: unknown;
  postOrderMode: unknown;
  raceType: unknown;
  routeVersion: unknown;
  participantFinished?: boolean;
};

export type LiveRouteOverview = {
  startPostIndex: number | null;
  startPostNumber: number | null;
  completedCount: number;
  totalPostCount: number;
  currentRoutePosition: number | null;
  nextPostIndex: number | null;
  nextPostNumber: number | null;
  isCompleted: boolean;
  routeOrder: number[];
  statusLabel: string;
  isConsistent: boolean;
};

function toSafeInteger(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function buildLiveRouteOverview({
  postIndexes,
  startOffset,
  completedPostIndexes,
  activePostIndex,
  postOrderMode,
  raceType,
  routeVersion,
  participantFinished = false,
}: LiveRouteOverviewInput): LiveRouteOverview {
  const validPostIndexes = postIndexes.filter(Number.isSafeInteger);
  const stablePostIndexes = [...new Set(validPostIndexes)];
  const totalPostCount = stablePostIndexes.length;
  const resolvedMode = resolveSessionPostOrderMode(
    postOrderMode,
    raceType,
    routeVersion
  );
  const parsedStartOffset = toSafeInteger(startOffset);
  const effectiveStartOffset =
    resolvedMode === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
      ? parsedStartOffset ?? 0
      : 0;
  const routeOrder = buildCircularRouteOrder(
    totalPostCount,
    effectiveStartOffset
  ).map((routePosition) => stablePostIndexes[routePosition]);
  const routePostIndexes = new Set(routeOrder);
  const completedPostIndexesSet = new Set(
    completedPostIndexes
      .map(toSafeInteger)
      .filter(
        (postIndex): postIndex is number =>
          postIndex !== null && routePostIndexes.has(postIndex)
      )
  );
  const completedCount = completedPostIndexesSet.size;
  const parsedActivePostIndex = toSafeInteger(activePostIndex);
  const activePostIsUsable =
    parsedActivePostIndex !== null &&
    routePostIndexes.has(parsedActivePostIndex) &&
    !completedPostIndexesSet.has(parsedActivePostIndex);
  const isCompleted =
    participantFinished ||
    (totalPostCount > 0 && completedCount >= totalPostCount);
  const nextPostIndex = isCompleted
    ? null
    : activePostIsUsable
      ? parsedActivePostIndex
      : routeOrder.find((postIndex) => !completedPostIndexesSet.has(postIndex)) ?? null;
  const currentRoutePosition =
    nextPostIndex === null ? null : routeOrder.indexOf(nextPostIndex);
  const startPostIndex = routeOrder[0] ?? null;
  const offsetIsConsistent =
    resolvedMode !== POST_ORDER_MODES.DISTRIBUTED_CIRCULAR ||
    (parsedStartOffset !== null && parsedStartOffset >= 0);
  const activePostIsConsistent =
    activePostIndex === null ||
    activePostIndex === undefined ||
    activePostIsUsable ||
    (parsedActivePostIndex !== null &&
      completedPostIndexesSet.has(parsedActivePostIndex));
  const isConsistent =
    validPostIndexes.length === postIndexes.length &&
    stablePostIndexes.length === validPostIndexes.length &&
    routeOrder.length === totalPostCount &&
    offsetIsConsistent &&
    activePostIsConsistent &&
    (isCompleted || totalPostCount === 0 || nextPostIndex !== null);

  let statusLabel = "Ikke startet";
  if (isCompleted) {
    statusLabel = "Færdig";
  } else if (totalPostCount === 0) {
    statusLabel = "Ingen poster";
  } else if (activePostIsUsable && nextPostIndex !== null) {
    statusLabel = `På vej til post ${nextPostIndex + 1}`;
  } else if (completedCount > 0) {
    statusLabel = `${completedCount} af ${totalPostCount} poster gennemført`;
  }

  return {
    startPostIndex,
    startPostNumber: startPostIndex === null ? null : startPostIndex + 1,
    completedCount,
    totalPostCount,
    currentRoutePosition,
    nextPostIndex,
    nextPostNumber: nextPostIndex === null ? null : nextPostIndex + 1,
    isCompleted,
    routeOrder,
    statusLabel,
    isConsistent,
  };
}
