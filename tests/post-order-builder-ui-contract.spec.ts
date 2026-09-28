import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  getDefaultPostOrderModeForNewRun,
  POST_ORDER_MODES,
  resolvePostOrderMode,
} from "@/lib/routes/postOrderPolicy";
import { RACE_TYPES } from "@/utils/gpsRuns";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const STANDARD_BUILDERS = [
  { slug: "manuel", raceType: RACE_TYPES.MANUEL },
  { slug: "dansk", raceType: RACE_TYPES.DANSK },
  { slug: "engelsk", raceType: RACE_TYPES.ENGELSK },
  { slug: "matematik", raceType: RACE_TYPES.MATEMATIK },
  { slug: "foto", raceType: RACE_TYPES.FOTO },
] as const;

const SPECIAL_BUILDERS = [
  { slug: "escape", raceType: RACE_TYPES.ESCAPE },
  { slug: "find-bedrageren", raceType: RACE_TYPES.FIND_BEDRAGEREN },
  { slug: "musikquiz", raceType: RACE_TYPES.MUSIKQUIZ },
  { slug: "podcast", raceType: RACE_TYPES.PODCAST },
  { slug: "rollespil", raceType: RACE_TYPES.ROLLESPIL },
  { slug: "scanner", raceType: RACE_TYPES.SCANNER },
  { slug: "selfie", raceType: RACE_TYPES.SELFIE },
  { slug: "stratego", raceType: RACE_TYPES.STRATEGO },
  { slug: "zone-krig", raceType: RACE_TYPES.ZONE_KRIG },
] as const;

test.describe("post-order builder UI contract", () => {
  test("the shared visible control explains the two supported, non-geographic choices", () => {
    const contents = source("components/routes/PostOrderModeField.tsx");

    expect(contents).toContain("Startfordeling og rute");
    expect(contents).toContain("Forskellige startposter, samme rute");
    expect(contents).toContain("Samme startpost og rækkefølge");
    expect(contents).toContain("afstand, postnummer eller nærmeste post");
    expect(contents).toContain(`value: POST_ORDER_MODES.DISTRIBUTED_CIRCULAR`);
    expect(contents).toContain(`value: POST_ORDER_MODES.FIXED`);
    expect(contents).toContain('type="radio"');
    expect(contents).toContain('name="post-order-mode"');
    expect(contents).toContain("checked={selected}");
    expect(contents).toContain("onChange={() => onChange(option.value)}");
  });

  test("each eligible builder shows the shared control beside save and defaults to distributed starts", () => {
    for (const { slug, raceType } of STANDARD_BUILDERS) {
      const contents = source(`app/dashboard/opret/${slug}/page.tsx`);
      const fieldIndex = contents.indexOf("<PostOrderModeField");
      const saveControlWindow = contents.slice(fieldIndex, fieldIndex + 2_500);

      expect(getDefaultPostOrderModeForNewRun(raceType), slug).toBe(
        POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
      );
      expect(contents, slug).toContain('from "@/components/routes/PostOrderModeField"');
      expect(contents, slug).toContain("getDefaultPostOrderModeForNewRun(");
      expect(fieldIndex, `${slug} shows the selector`).toBeGreaterThan(-1);
      expect((contents.match(/<PostOrderModeField/g) ?? []), `${slug} selector count`).toHaveLength(1);
      expect(saveControlWindow, `${slug} keeps selector in the normal save flow`).toContain(
        "onClick={handleSaveRun}"
      );
      expect(saveControlWindow, `${slug} persists a changed choice`).toContain(
        "setIsPostOrderModeDirty(true);"
      );
    }
  });

  test("a fixed choice is normalized for save and restored when each standard builder reopens", () => {
    for (const { slug, raceType } of STANDARD_BUILDERS) {
      const contents = source(`app/dashboard/opret/${slug}/page.tsx`);
      const selectedFixed = resolvePostOrderMode(POST_ORDER_MODES.FIXED, raceType);
      const savedPayload = { post_order_mode: selectedFixed };
      const reopenedValue = resolvePostOrderMode(savedPayload.post_order_mode, raceType);

      expect(selectedFixed, `${slug} fixed save payload`).toBe(POST_ORDER_MODES.FIXED);
      expect(reopenedValue, `${slug} fixed reopen value`).toBe(POST_ORDER_MODES.FIXED);
      expect(contents, `${slug} save payload resolver`).toContain(
        "post_order_mode: resolvePostOrderMode"
      );
      expect(contents, `${slug} edit reload resolver`).toMatch(
        /setPostOrderMode\(resolvePostOrderMode\(run\.post_order_mode,/
      );
      expect(contents, `${slug} marks a selected choice as dirty`).toContain(
        "setPostOrderMode(value);"
      );
    }
  });

  test("special game builders cannot accidentally expose a distributed route choice", () => {
    const manualBuilder = source("app/dashboard/opret/manuel/page.tsx");
    expect(manualBuilder).toContain("isDistributedCircularEligibleRaceType(");

    for (const { slug, raceType } of SPECIAL_BUILDERS) {
      const contents = source(`app/dashboard/opret/${slug}/page.tsx`);

      expect(resolvePostOrderMode(POST_ORDER_MODES.DISTRIBUTED_CIRCULAR, raceType), slug).toBe(
        POST_ORDER_MODES.FIXED
      );
      expect(contents, `${slug} does not render the standard route selector`).not.toContain(
        "PostOrderModeField"
      );
    }
  });
});
