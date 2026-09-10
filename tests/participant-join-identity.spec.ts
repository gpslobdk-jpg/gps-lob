import { expect, test } from "@playwright/test";

import { resolveParticipantJoinIdentity } from "@/lib/join/participantJoinIdentity";

const SESSION_A = "session-a";
const SESSION_B = "session-b";
const AUTH_A = "auth-a";

const owner = {
  id: "participant-a",
  sessionId: SESSION_A,
  authUserId: AUTH_A,
};

test.describe("participant join identity policy", () => {
  test("retry with the same authenticated participant reuses its stable id", () => {
    expect(
      resolveParticipantJoinIdentity({
        sessionId: SESSION_A,
        requestedParticipantId: owner.id,
        currentAuthUserId: AUTH_A,
        currentlyOwnedParticipant: owner,
        requestedParticipant: owner,
      })
    ).toEqual({ kind: "reuse", participantId: owner.id });
  });

  test("a participant id without the owning auth session cannot take over a row", () => {
    expect(
      resolveParticipantJoinIdentity({
        sessionId: SESSION_A,
        requestedParticipantId: owner.id,
        currentAuthUserId: "auth-foreign",
        currentlyOwnedParticipant: null,
        requestedParticipant: owner,
      })
    ).toMatchObject({ kind: "reject" });
  });

  test("same-name independent browsers are provisioned separately because names are not input", () => {
    expect(
      resolveParticipantJoinIdentity({
        sessionId: SESSION_A,
        requestedParticipantId: "participant-b",
        currentAuthUserId: null,
        currentlyOwnedParticipant: null,
        requestedParticipant: null,
      })
    ).toEqual({ kind: "provision", rotateParticipantAuth: false });
  });

  test("a browser with another active session rotates only for a deliberate new attempt", () => {
    expect(
      resolveParticipantJoinIdentity({
        sessionId: SESSION_B,
        requestedParticipantId: "participant-b",
        currentAuthUserId: AUTH_A,
        currentlyOwnedParticipant: owner,
        requestedParticipant: null,
      })
    ).toEqual({ kind: "provision", rotateParticipantAuth: true });
  });

  test("a different client candidate still resumes the auth-owned participant in the same session", () => {
    expect(
      resolveParticipantJoinIdentity({
        sessionId: SESSION_A,
        requestedParticipantId: "participant-b",
        currentAuthUserId: AUTH_A,
        currentlyOwnedParticipant: owner,
        requestedParticipant: null,
      })
    ).toEqual({ kind: "reuse", participantId: owner.id });
  });
});
