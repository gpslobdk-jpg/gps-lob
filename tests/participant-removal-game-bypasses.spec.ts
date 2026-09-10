import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  filterRemovedBonusLeaderboardRows,
  resolveBonusParticipantAccess,
  resolveBonusSessionParticipantAccess,
} from "@/app/api/bonus/_shared";
import {
  fetchActiveFindBedragerenParticipantIds,
  readFindBedragerenParticipantAccess,
} from "@/app/api/find-bedrageren/_participantAccess";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVE_ID = "22222222-2222-4222-8222-222222222222";
const REMOVED_ID = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;

function fakeAdminDatabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      const rows = () => (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        is(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        async maybeSingle() {
          return { data: rows()[0] ?? null, error: null };
        },
        then(
          onfulfilled?: ((value: { data: Row[]; error: null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null
        ) {
          return Promise.resolve({ data: rows(), error: null }).then(onfulfilled, onrejected);
        },
      };
      return query;
    },
  } as never;
}

test.describe("Phase 3 game-specific participant removal guards", () => {
  test("bonus resolves a current participant by durable id and blocks the removed id", async () => {
    const db = fakeAdminDatabase({
      participants: [
        { id: ACTIVE_ID, session_id: SESSION_ID, student_name: "Blå hold", removed_at: null },
        { id: REMOVED_ID, session_id: SESSION_ID, student_name: "Rød hold", removed_at: "2026-09-10T10:00:00Z" },
      ],
    });

    await expect(
      resolveBonusParticipantAccess(SESSION_ID, ACTIVE_ID, "Forkert navn", db)
    ).resolves.toEqual({ kind: "active", participantId: ACTIVE_ID, studentName: "Blå hold" });
    await expect(
      resolveBonusParticipantAccess(SESSION_ID, REMOVED_ID, "Rød hold", db)
    ).resolves.toEqual({ kind: "removed" });
  });

  test("legacy bonus never resumes a name that maps to a removed participant", async () => {
    const db = fakeAdminDatabase({
      participants: [
        { id: REMOVED_ID, session_id: SESSION_ID, student_name: "Blå hold", removed_at: "2026-09-10T10:00:00Z" },
      ],
    });

    await expect(
      resolveBonusParticipantAccess(SESSION_ID, null, "Blå hold", db)
    ).resolves.toEqual({ kind: "removed" });
    await expect(
      resolveBonusSessionParticipantAccess(
        { live_session_id: SESSION_ID, participant_id: null, student_name: "Blå hold" },
        db
      )
    ).resolves.toEqual({ kind: "removed" });
  });

  test("anonymous legacy bonus remains possible only in a participant-free session", async () => {
    const emptyDb = fakeAdminDatabase({ participants: [] });
    await expect(
      resolveBonusParticipantAccess(SESSION_ID, null, "Gæst", emptyDb)
    ).resolves.toEqual({ kind: "anonymous", studentName: "Gæst" });

    const liveSessionDb = fakeAdminDatabase({
      participants: [
        { id: ACTIVE_ID, session_id: SESSION_ID, student_name: "Blå hold", removed_at: null },
      ],
    });
    await expect(
      resolveBonusParticipantAccess(SESSION_ID, null, "Et nyt navn", liveSessionDb)
    ).resolves.toEqual({ kind: "missing" });

    const ambiguousDb = fakeAdminDatabase({
      participants: [
        { id: ACTIVE_ID, session_id: SESSION_ID, student_name: "Samme navn", removed_at: null },
        { id: "44444444-4444-4444-8444-444444444444", session_id: SESSION_ID, student_name: "Samme navn", removed_at: null },
      ],
    });
    await expect(
      resolveBonusParticipantAccess(SESSION_ID, null, "Samme navn", ambiguousDb)
    ).resolves.toEqual({ kind: "ambiguous" });
  });

  test("bonus leaderboard removes linked rows and unsafe legacy name collisions", () => {
    const rows = [
      { id: "bonus-active", student_name: "Blå hold", score: 20, total_questions: 5, finished_at: null, participant_id: ACTIVE_ID },
      { id: "bonus-removed", student_name: "Rød hold", score: 30, total_questions: 5, finished_at: null, participant_id: REMOVED_ID },
      { id: "bonus-legacy-removed", student_name: "Rød hold", score: 40, total_questions: 5, finished_at: null, participant_id: null },
      { id: "bonus-anonymous", student_name: "Gæst", score: 10, total_questions: 5, finished_at: null, participant_id: null },
    ];
    const participants = [
      { id: ACTIVE_ID, session_id: SESSION_ID, student_name: "Blå hold", removed_at: null },
      { id: REMOVED_ID, session_id: SESSION_ID, student_name: "Rød hold", removed_at: "2026-09-10T10:00:00Z" },
    ];

    expect(filterRemovedBonusLeaderboardRows(rows, participants).map((row) => row.id)).toEqual([
      "bonus-active",
      "bonus-anonymous",
    ]);
  });

  test("Find Bedrageren reads removal state and returns only active ids", async () => {
    const db = fakeAdminDatabase({
      participants: [
        { id: ACTIVE_ID, session_id: SESSION_ID, student_name: "Blå hold", removed_at: null },
        { id: REMOVED_ID, session_id: SESSION_ID, student_name: "Rød hold", removed_at: "2026-09-10T10:00:00Z" },
      ],
    });

    await expect(readFindBedragerenParticipantAccess(SESSION_ID, ACTIVE_ID, db)).resolves.toBe("active");
    await expect(readFindBedragerenParticipantAccess(SESSION_ID, REMOVED_ID, db)).resolves.toBe("removed");
    await expect(
      readFindBedragerenParticipantAccess(SESSION_ID, "55555555-5555-4555-8555-555555555555", db)
    ).resolves.toBe("missing");
    await expect(fetchActiveFindBedragerenParticipantIds(SESSION_ID, db)).resolves.toEqual(new Set([ACTIVE_ID]));
  });

  test("game routes and CTA use the durable removal guard", () => {
    const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

    expect(source("app/api/bonus/session/route.ts")).toContain("resolveBonusParticipantAccess(");
    expect(source("app/api/bonus/answer/route.ts")).toContain("resolveBonusSessionParticipantAccess(session");
    expect(source("app/api/bonus/finish/route.ts")).toContain("resolveBonusSessionParticipantAccess(session");
    expect(source("app/api/find-bedrageren/session/route.ts")).toContain(
      "fetchActiveFindBedragerenParticipantIds"
    );
    expect(source("app/api/find-bedrageren/vote/route.ts")).toContain(
      "readFindBedragerenParticipantAccess"
    );
    expect(source("components/play/PlayInterface.tsx")).toContain("&participantId=${encodeURIComponent(participantId)}");
  });
});
