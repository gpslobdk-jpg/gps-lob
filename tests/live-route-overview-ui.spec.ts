import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { buildLiveRouteOverview } from "@/lib/routes/liveRouteOverview";

const componentSource = readFileSync(
  join(process.cwd(), "components", "live", "LiveRouteOverview.tsx"),
  "utf8"
);
const livePageSource = readFileSync(
  join(process.cwd(), "app", "dashboard", "live", "[sessionId]", "page.tsx"),
  "utf8"
);

test.describe("teacher live route overview UI contract", () => {
  test("shows start, next post, progression and completed state", () => {
    const overview = buildLiveRouteOverview({
      postIndexes: [0, 1, 2, 3],
      startOffset: 2,
      completedPostIndexes: [2],
      postOrderMode: "distributed_circular",
      raceType: "manuel",
      routeVersion: 1,
    });

    expect(overview.startPostNumber).toBe(3);
    expect(overview.nextPostNumber).toBe(4);
    expect(overview.completedCount).toBe(1);
    expect(componentSource).toContain("Holdenes rute");
    expect(componentSource).toContain("Startede ved post");
    expect(componentSource).toContain("Næste: Post");
    expect(componentSource).toContain("gennemført");
    expect(componentSource).toContain('"Færdig"');
  });

  test("uses teacher-friendly fixed/distributed and empty-state copy", () => {
    const visibleCopy = [
      "Holdene er fordelt på forskellige startposter og følger derefter den samme rute.",
      "Alle hold følger den samme postrækkefølge.",
      "Fordelingen vises, når deltagerne er startet.",
    ];

    for (const copy of visibleCopy) {
      expect(componentSource).toContain(copy);
    }
    expect(visibleCopy.join(" ").toLocaleLowerCase("da-DK")).not.toMatch(
      /offset|circular|rpc|route_version/
    );
  });

  test("gates special games and reports only a privacy-safe category and count", () => {
    expect(livePageSource).toContain(
      "isDistributedCircularEligibleRaceType(live.runRaceType)"
    );
    const warningCall = livePageSource.match(
      /captureAppMessage\("live_route_overview_inconsistent", \{[\s\S]*?\}\);/
    )?.[0];

    expect(warningCall).toBeTruthy();
    expect(warningCall).toContain('category: "route_assignment_inconsistent"');
    expect(warningCall).toContain("affectedCount:");
    expect(warningCall).not.toMatch(
      /student|name|pin|sessionId|answer|lat|lng|coordinate/i
    );
  });
});
