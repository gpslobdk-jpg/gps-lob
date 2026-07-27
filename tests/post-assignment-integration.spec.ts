import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test.describe("post assignment integration contract", () => {
  test("all eligible builders load and persist the shared setting", () => {
    const builders = ["manuel", "dansk", "engelsk", "matematik", "foto"];

    for (const builder of builders) {
      const contents = source(`app/dashboard/opret/${builder}/page.tsx`);
      expect(contents).toContain('from "@/components/routes/PostOrderModeField"');
      expect(contents).toContain("post_order_mode");
      expect(contents).toContain("resolvePostOrderMode(");
    }
  });

  test("the teacher control exposes only fixed and distributed choices", () => {
    const contents = source("components/routes/PostOrderModeField.tsx");
    expect(contents).toContain("Fordel holdene på forskellige startposter");
    expect(contents).toContain("Samme rækkefølge for alle");
    expect(contents).toContain('badge: "Anbefalet"');
    expect(contents).not.toContain("RANDOM_PER_ASSIGNMENT");
  });

  test("new sessions snapshot mode and version while reused sessions stay untouched", () => {
    const contents = source("app/api/archive/live-session/route.ts");
    const reuseIndex = contents.indexOf("if (existingSession?.id && existingPin)");
    const insertIndex = contents.indexOf('.insert({');

    expect(reuseIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(reuseIndex);
    expect(contents).toContain(
      "post_order_mode: resolvePostOrderMode(run.post_order_mode, run.race_type)"
    );
    expect(contents).toContain("route_version: CURRENT_ROUTE_VERSION");
  });

  test("normal start and join use the atomic RPCs", () => {
    const teacherHook = source("hooks/useTeacherLiveData.ts");
    const joinRoute = source("app/api/join/route.ts");

    expect(teacherHook).toContain('rpc("start_live_session_with_post_assignments"');
    expect(teacherHook).toContain("usesAtomicPostAssignmentStart");
    expect(joinRoute).toContain('rpc("assign_live_participant_start_offset"');
    expect(joinRoute).not.toContain("pickLeastUsedStartOffset");
    expect(joinRoute).not.toContain("fetchSessionParticipantOffsets");
  });
});
