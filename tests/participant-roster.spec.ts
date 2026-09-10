import { expect, test } from "@playwright/test";

import {
  applyParticipantRosterEvent,
  createParticipantRoster,
  mergeParticipantRosterSnapshot,
} from "@/lib/live/participantRoster";

const SESSION_ID = "roster-session-00000000-0000-0000-000000000001";

function participant(
  id: string,
  name: string,
  updatedAt = "2026-09-10T10:00:00.000Z"
) {
  return {
    id,
    session_id: SESSION_ID,
    name,
    student_name: name,
    lat: null,
    lng: null,
    updated_at: updatedAt,
    last_updated: updatedAt,
    run_started_at: null,
    finished_at: null,
    startOffset: 0,
  };
}

function ids(state: ReturnType<typeof createParticipantRoster>) {
  return state.entries.map((entry) => entry.id).sort();
}

function entry(
  state: ReturnType<typeof createParticipantRoster>,
  participantId: string
) {
  const result = state.entries.find((candidate) => candidate.id === participantId);
  expect(result, `Roster mangler deltageren ${participantId}`).toBeDefined();
  return result!;
}

test.describe("teacher participant roster", () => {
  test("participants INSERT vises uden en session_students-spejl-række", () => {
    const afterInsert = applyParticipantRosterEvent(createParticipantRoster([]), {
      type: "INSERT",
      row: participant("participant-red", "Hold Rød"),
    });

    expect(ids(afterInsert)).toEqual(["participant-red"]);
    expect(entry(afterInsert, "participant-red")).toMatchObject({
      id: "participant-red",
      student_name: "Hold Rød",
    });
  });

  test("to hold med samme navn bevares som to stabile participant-id'er", () => {
    const roster = createParticipantRoster([
      participant("participant-blue-a", "Hold Blå"),
      participant("participant-blue-b", "Hold Blå"),
    ]);

    expect(ids(roster)).toEqual(["participant-blue-a", "participant-blue-b"]);
    expect(roster.entries.map((candidate) => candidate.student_name)).toEqual([
      "Hold Blå",
      "Hold Blå",
    ]);

    const renamed = applyParticipantRosterEvent(roster, {
      type: "UPDATE",
      row: participant("participant-blue-a", "Hold Blå 1", "2026-09-10T10:01:00.000Z"),
    });
    expect(entry(renamed, "participant-blue-a").student_name).toBe("Hold Blå 1");
    expect(entry(renamed, "participant-blue-b").student_name).toBe("Hold Blå");

    const afterExactDelete = applyParticipantRosterEvent(renamed, {
      type: "DELETE",
      row: { id: "participant-blue-a" },
    });
    expect(ids(afterExactDelete)).toEqual(["participant-blue-b"]);
  });

  test("et navn, der kommer i en efterfølgende UPDATE, bliver synligt på samme id", () => {
    const afterUnnamedInsert = applyParticipantRosterEvent(createParticipantRoster([]), {
      type: "INSERT",
      row: participant("participant-late-name", ""),
    });
    expect(afterUnnamedInsert.entries).toHaveLength(0);

    const afterNameUpdate = applyParticipantRosterEvent(afterUnnamedInsert, {
      type: "UPDATE",
      row: participant("participant-late-name", "Hold Grøn", "2026-09-10T10:01:00.000Z"),
    });
    expect(ids(afterNameUpdate)).toEqual(["participant-late-name"]);
    expect(entry(afterNameUpdate, "participant-late-name").student_name).toBe("Hold Grøn");
  });

  test("gentagne INSERT/UPDATE-events upserter samme id i stedet for at øge holdtallet", () => {
    const first = applyParticipantRosterEvent(createParticipantRoster([]), {
      type: "INSERT",
      row: participant("participant-repeat", "Hold Gul"),
    });
    const repeated = applyParticipantRosterEvent(first, {
      type: "INSERT",
      row: participant("participant-repeat", "Hold Gul", "2026-09-10T10:01:00.000Z"),
    });

    expect(ids(repeated)).toEqual(["participant-repeat"]);
    expect(entry(repeated, "participant-repeat").updated_at).toBe("2026-09-10T10:01:00.000Z");
  });

  test("en langsom snapshot-respons kan ikke slette en INSERT efter requesten startede", () => {
    const beforeRequest = createParticipantRoster([
      participant("participant-existing", "Hold Eksisterende"),
    ]);
    const snapshotRevision = beforeRequest.revision;
    const afterRealtimeInsert = applyParticipantRosterEvent(beforeRequest, {
      type: "INSERT",
      row: participant("participant-late", "Hold Sent", "2026-09-10T10:01:00.000Z"),
    });

    const afterSlowSnapshot = mergeParticipantRosterSnapshot(
      afterRealtimeInsert,
      [participant("participant-existing", "Hold Eksisterende")],
      snapshotRevision
    );

    expect(ids(afterSlowSnapshot)).toEqual(["participant-existing", "participant-late"]);
  });

  test("en aktuel autoritativ snapshot må fjerne et hold, der ikke længere findes", () => {
    const roster = createParticipantRoster([
      participant("participant-kept", "Hold Beholdt"),
      participant("participant-removed", "Hold Fjernet"),
    ]);

    const afterSnapshot = mergeParticipantRosterSnapshot(
      roster,
      [participant("participant-kept", "Hold Beholdt")],
      roster.revision
    );

    expect(ids(afterSnapshot)).toEqual(["participant-kept"]);
  });

  test("en forsinket event med ældre tidsstempel ruller ikke et nyere navn tilbage", () => {
    const initial = applyParticipantRosterEvent(createParticipantRoster([]), {
      type: "INSERT",
      row: participant("participant-ordered", "Hold Før", "2026-09-10T10:00:00.000Z"),
    });
    const newer = applyParticipantRosterEvent(initial, {
      type: "UPDATE",
      row: participant("participant-ordered", "Hold Efter", "2026-09-10T10:02:00.000Z"),
    });
    const delayedOlderEvent = applyParticipantRosterEvent(newer, {
      type: "UPDATE",
      row: participant("participant-ordered", "Hold Før", "2026-09-10T10:01:00.000Z"),
    });

    expect(entry(delayedOlderEvent, "participant-ordered")).toMatchObject({
      student_name: "Hold Efter",
      updated_at: "2026-09-10T10:02:00.000Z",
    });
  });
});
