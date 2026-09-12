import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  getArchiveEditCapability,
  getBuilderHrefForRaceType,
  RACE_TYPE_CAPABILITIES,
  RACE_TYPE_VALUES,
  RACE_TYPES,
  type RaceType,
} from "../utils/gpsRuns";

const root = process.cwd();
const fixtureRunId = "archive run/42";
const encodedFixtureRunId = "archive%20run%2F42";

const EXPECTED_LEGACY_EDIT_PATHS: Record<RaceType, string> = {
  [RACE_TYPES.MANUEL]: "/dashboard/opret/manuel",
  [RACE_TYPES.DANSK]: "/dashboard/opret/dansk",
  [RACE_TYPES.ENGELSK]: "/dashboard/opret/engelsk",
  [RACE_TYPES.MATEMATIK]: "/dashboard/opret/matematik",
  [RACE_TYPES.FOTO]: "/dashboard/opret/foto",
  [RACE_TYPES.SCANNER]: "/dashboard/opret/manuel",
  [RACE_TYPES.SELFIE]: "/dashboard/opret/selfie",
  [RACE_TYPES.ESCAPE]: "/dashboard/opret/escape",
  [RACE_TYPES.ROLLESPIL]: "/dashboard/opret/rollespil",
  [RACE_TYPES.PODCAST]: "/dashboard/opret/podcast",
  [RACE_TYPES.ZONE_KRIG]: "/dashboard/opret/zone-krig",
  [RACE_TYPES.STRATEGO]: "/dashboard/opret/stratego",
  [RACE_TYPES.MUSIKQUIZ]: "/dashboard/opret/musikquiz",
  [RACE_TYPES.FIND_BEDRAGEREN]: "/dashboard/opret/find-bedrageren",
};

test.describe("race-type capability contract", () => {
  test("every persisted type has one capability and keeps its legacy deep link", () => {
    expect(Object.keys(RACE_TYPE_CAPABILITIES).sort()).toEqual([...RACE_TYPE_VALUES].sort());

    for (const raceType of RACE_TYPE_VALUES) {
      const capability = RACE_TYPE_CAPABILITIES[raceType];

      expect(capability.label, raceType).not.toBe("");
      expect(capability.legacyEditPath, raceType).toBe(EXPECTED_LEGACY_EDIT_PATHS[raceType]);
      expect(getBuilderHrefForRaceType(fixtureRunId, raceType), raceType).toBe(
        EXPECTED_LEGACY_EDIT_PATHS[raceType] + "?id=" + encodedFixtureRunId
      );
    }
  });

  test("archive promises edit only for types with a verified editor", () => {
    for (const raceType of RACE_TYPE_VALUES) {
      const archiveEdit = getArchiveEditCapability(fixtureRunId, raceType);

      if (raceType === RACE_TYPES.PODCAST || raceType === RACE_TYPES.FIND_BEDRAGEREN) {
        expect(archiveEdit.status, raceType).toBe("unsupported");
        if (archiveEdit.status === "unsupported") {
          expect(archiveEdit.reason, raceType).toMatch(/ikke understøttet/i);
        }
        continue;
      }

      expect(archiveEdit.status, raceType).toBe("supported");
      if (archiveEdit.status === "supported") {
        expect(archiveEdit.href, raceType).toBe(
          EXPECTED_LEGACY_EDIT_PATHS[raceType] + "?id=" + encodedFixtureRunId
        );
      }
    }
  });

  test("archive derives its filter list from every persisted race type", () => {
    const archiveSource = readFileSync(path.join(root, "app", "dashboard", "arkiv", "page.tsx"), "utf8");

    expect(archiveSource).toContain("RACE_TYPE_VALUES.map");
    expect(archiveSource).toContain("RACE_TYPE_CAPABILITIES[raceType].label");
    expect(archiveSource).toContain('.in("status", ["waiting", "running", "active"])');
  });

  test("a historical Podcast deep link stays valid but cannot start a new import as an edit", () => {
    const podcastSource = readFileSync(
      path.join(root, "app", "dashboard", "opret", "podcast", "page.tsx"),
      "utf8"
    );

    expect(getBuilderHrefForRaceType(fixtureRunId, RACE_TYPES.PODCAST)).toBe(
      "/dashboard/opret/podcast?id=" + encodedFixtureRunId
    );
    expect(podcastSource).toContain('const editRunId = searchParams.get("id")?.trim() ?? "";');
    expect(podcastSource).toContain("Dette løb åbnes ikke i podcastimporten");
  });
});
