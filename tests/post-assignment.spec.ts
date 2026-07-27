import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { buildStoredParticipantFromJoin } from "@/components/play/participantHandoff";
import {
  buildEvenStartOffsets,
  getDefaultPostOrderModeForNewRun,
  pickLateJoinStartOffset,
  POST_ORDER_MODES,
  resolvePostOrderMode,
  resolveSessionPostOrderMode,
} from "@/lib/routes/postOrderPolicy";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "202607270001_distributed_post_assignment.sql"
);

test.describe("distributed post assignment", () => {
  test("uses the deterministic floor formula and keeps loads balanced", () => {
    const offsets = buildEvenStartOffsets(
      4,
      6,
      POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
    );
    expect(offsets).toEqual([0, 0, 1, 2, 2, 3]);

    const loads = [0, 1, 2, 3].map(
      (postIndex) => offsets.filter((offset) => offset === postIndex).length
    );
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
  });

  test("handles more posts than participants and fixed order", () => {
    expect(
      buildEvenStartOffsets(12, 6, POST_ORDER_MODES.DISTRIBUTED_CIRCULAR)
    ).toEqual([0, 2, 4, 6, 8, 10]);
    expect(
      buildEvenStartOffsets(6, 4, POST_ORDER_MODES.DISTRIBUTED_CIRCULAR)
    ).toEqual([0, 1, 3, 4]);
    expect(
      buildEvenStartOffsets(1, 4, POST_ORDER_MODES.DISTRIBUTED_CIRCULAR)
    ).toEqual([0, 0, 0, 0]);
    expect(buildEvenStartOffsets(4, 6, POST_ORDER_MODES.FIXED)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
  });

  test("late joins choose lowest load, then circular distance, then index", () => {
    expect(pickLateJoinStartOffset(6, [0])).toBe(3);
    expect(pickLateJoinStartOffset(4, [0, 2])).toBe(1);

    const firstConcurrentResult = pickLateJoinStartOffset(6, [0]);
    const secondConcurrentResult = pickLateJoinStartOffset(6, [
      0,
      firstConcurrentResult,
    ]);
    expect([firstConcurrentResult, secondConcurrentResult]).toEqual([3, 1]);
  });

  test("new eligible runs default to distributed while legacy and special data fail closed", () => {
    expect(getDefaultPostOrderModeForNewRun("dansk")).toBe(
      POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
    );
    expect(resolvePostOrderMode(null, "dansk")).toBe(POST_ORDER_MODES.FIXED);
    expect(resolveSessionPostOrderMode("distributed_circular", "dansk", null)).toBe(
      POST_ORDER_MODES.FIXED
    );
    expect(resolvePostOrderMode("distributed_circular", "podcast")).toBe(
      POST_ORDER_MODES.FIXED
    );
  });

  test("waiting handoff does not invent an assignment before atomic start", () => {
    const stored = buildStoredParticipantFromJoin({
      registration: {
        participantId: "participant-1",
        sessionId: "session-1",
        studentName: "Hold Grøn",
        startOffset: null,
      },
      existingParticipant: null,
      preserveExistingParticipant: false,
      sessionStatus: "waiting",
    });

    expect(stored.startOffset).toBeUndefined();
  });

  test("migration serializes start and late joins and restricts the late-join RPC", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql.match(/for update of ls;/g)?.length).toBe(2);
    expect(sql).toContain("row_number() over (order by p.created_at, p.id) - 1");
    expect(sql).toContain("ordered.participant_index * v_post_count");
    expect(sql).toContain("set status = 'running'");
    expect(sql).toContain("if v_participant.start_offset is not null then");
    expect(sql).toContain(
      "revoke all on function public.assign_live_participant_start_offset(uuid, uuid) from authenticated"
    );
    expect(sql).toContain(
      "grant execute on function public.assign_live_participant_start_offset(uuid, uuid) to service_role"
    );
    expect(sql.indexOf("set status = 'running'")).toBeGreaterThan(
      sql.indexOf("update public.participants as participant")
    );
  });
});
