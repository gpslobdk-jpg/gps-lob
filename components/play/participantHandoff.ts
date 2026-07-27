import type { StoredActiveParticipant } from "./types";

type JoinParticipantRegistration = {
  participantId: string;
  sessionId: string;
  studentName: string;
  startOffset?: number | null;
  teamId?: string | null;
  teamColor?: string | null;
};

type BuildStoredParticipantFromJoinParams = {
  registration: JoinParticipantRegistration;
  existingParticipant: StoredActiveParticipant | null;
  preserveExistingParticipant: boolean;
  sessionStatus: string | null;
  joinedAt?: string;
};

function asIntegerStartOffset(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(parsed) ? parsed : null;
}

export function resolveParticipantStartOffset(
  serverStartOffset: unknown,
  storedStartOffset: unknown
) {
  return asIntegerStartOffset(serverStartOffset) ?? asIntegerStartOffset(storedStartOffset) ?? 0;
}

export function buildStoredParticipantFromJoin({
  registration,
  existingParticipant,
  preserveExistingParticipant,
  sessionStatus,
  joinedAt = new Date().toISOString(),
}: BuildStoredParticipantFromJoinParams): StoredActiveParticipant {
  const assignedStartOffset =
    asIntegerStartOffset(registration.startOffset) ??
    (preserveExistingParticipant
      ? asIntegerStartOffset(existingParticipant?.startOffset)
      : null);

  return {
    participantId: registration.participantId,
    sessionId: registration.sessionId,
    studentName: registration.studentName,
    startOffset:
      assignedStartOffset ?? (sessionStatus === "waiting" ? undefined : 0),
    savedAt:
      preserveExistingParticipant && existingParticipant?.savedAt
        ? existingParticipant.savedAt
        : joinedAt,
    teamId: registration.teamId ?? null,
    teamColor: registration.teamColor ?? null,
    avatarUrl: preserveExistingParticipant ? existingParticipant?.avatarUrl ?? null : null,
    sessionStatus,
    hasCompletedAvatarGate: preserveExistingParticipant
      ? existingParticipant?.hasCompletedAvatarGate ?? true
      : false,
  };
}

export function isFreshParticipantHandoff(
  savedAt: string | null | undefined,
  hasStoredPlaySnapshot: boolean,
  nowMs = Date.now()
) {
  if (!savedAt || hasStoredPlaySnapshot) {
    return false;
  }

  const savedTime = new Date(savedAt).getTime();
  const ageMs = nowMs - savedTime;
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 30_000;
}

type ResolveRestoredPostIndexParams = {
  routeOrder: readonly number[];
  answeredPostIndexes: readonly number[];
  snapshotCurrentPostIndex: unknown;
  enforceRouteOrder: boolean;
};

/**
 * A distributed circular route is server-assigned, so a snapshot may resume
 * only at the next unresolved post in that route. Fixed/special-game sessions
 * retain their existing permissive snapshot behavior.
 */
export function resolveRestoredPostIndex({
  routeOrder,
  answeredPostIndexes,
  snapshotCurrentPostIndex,
  enforceRouteOrder,
}: ResolveRestoredPostIndexParams) {
  const firstRoutePostIndex = routeOrder[0] ?? 0;
  const answeredPosts = new Set(answeredPostIndexes);
  const nextRoutePostIndex =
    routeOrder.find((postIndex) => !answeredPosts.has(postIndex)) ?? firstRoutePostIndex;
  const isValidSnapshotPost =
    typeof snapshotCurrentPostIndex === "number" &&
    Number.isInteger(snapshotCurrentPostIndex) &&
    routeOrder.includes(snapshotCurrentPostIndex) &&
    !answeredPosts.has(snapshotCurrentPostIndex);

  if (!isValidSnapshotPost) {
    return nextRoutePostIndex;
  }

  if (enforceRouteOrder && snapshotCurrentPostIndex !== nextRoutePostIndex) {
    return nextRoutePostIndex;
  }

  return snapshotCurrentPostIndex;
}
