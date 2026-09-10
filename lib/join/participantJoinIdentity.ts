export type ParticipantJoinIdentity = {
  id: string;
  sessionId: string;
  authUserId: string | null;
};

export type ParticipantJoinIdentityResolution =
  | { kind: "reuse"; participantId: string }
  | { kind: "provision"; rotateParticipantAuth: boolean }
  | { kind: "reject"; error: string };

type ResolveParticipantJoinIdentityParams = {
  sessionId: string;
  requestedParticipantId: string | null;
  currentAuthUserId: string | null;
  currentlyOwnedParticipant: ParticipantJoinIdentity | null;
  requestedParticipant: ParticipantJoinIdentity | null;
};

/**
 * Decides identity reuse without treating a display name or a browser-stored
 * participant id as permission to take over a row.
 */
export function resolveParticipantJoinIdentity({
  sessionId,
  requestedParticipantId,
  currentAuthUserId,
  currentlyOwnedParticipant,
  requestedParticipant,
}: ResolveParticipantJoinIdentityParams): ParticipantJoinIdentityResolution {
  if (requestedParticipantId && requestedParticipant) {
    if (
      !currentAuthUserId ||
      requestedParticipant.sessionId !== sessionId ||
      requestedParticipant.authUserId !== currentAuthUserId
    ) {
      return {
        kind: "reject",
        error:
          "Vi kunne ikke bekræfte dette hold på denne browser. Åbn løbet fra den samme browser igen.",
      };
    }

    return { kind: "reuse", participantId: requestedParticipant.id };
  }

  if (currentlyOwnedParticipant?.sessionId === sessionId) {
    return { kind: "reuse", participantId: currentlyOwnedParticipant.id };
  }

  return {
    kind: "provision",
    rotateParticipantAuth: Boolean(currentAuthUserId && currentlyOwnedParticipant),
  };
}
