import { expect, test } from "@playwright/test";

import {
  buildCircularRouteOrder,
  CURRENT_ROUTE_VERSION,
  isActivePostOrderMode,
  isDistributedCircularEligibleRaceType,
  isPostOrderMode,
  isSupportedRouteVersion,
  normalizeCircularStartOffset,
  normalizePostOrderMode,
  POST_ORDER_MODES,
  resolvePostOrderMode,
  resolveSessionPostOrderMode,
} from "@/lib/routes/postOrderPolicy";
import { buildRouteOrder } from "@/components/play/playUtils";
import {
  getServerRouteOrder,
  supportsServerStaggeredStart,
} from "@/app/api/play/_shared";

test.describe("buildCircularRouteOrder", () => {
  test("offset 0 preserves canonical post order", () => {
    expect(buildCircularRouteOrder(5, 0)).toEqual([0, 1, 2, 3, 4]);
  });

  test("offset 2 rotates the route without shuffling it", () => {
    expect(buildCircularRouteOrder(5, 2)).toEqual([2, 3, 4, 0, 1]);
  });

  test("offsets larger than the post count are normalized", () => {
    expect(buildCircularRouteOrder(5, 12)).toEqual([2, 3, 4, 0, 1]);
  });

  test("negative offsets wrap safely", () => {
    expect(buildCircularRouteOrder(5, -1)).toEqual([4, 0, 1, 2, 3]);
  });

  test("zero or invalid post counts return an empty route", () => {
    expect(buildCircularRouteOrder(0, 0)).toEqual([]);
    expect(buildCircularRouteOrder(-1, 0)).toEqual([]);
    expect(buildCircularRouteOrder(2.5, 0)).toEqual([]);
    expect(buildCircularRouteOrder(Number.NaN, 0)).toEqual([]);
  });

  test("invalid offsets fall back deterministically to zero", () => {
    expect(buildCircularRouteOrder(3, Number.NaN)).toEqual([0, 1, 2]);
    expect(buildCircularRouteOrder(3, Number.POSITIVE_INFINITY)).toEqual([0, 1, 2]);
    expect(normalizeCircularStartOffset(1.5, 3)).toBe(0);
  });

  test("each invocation returns a fresh route", () => {
    const first = buildCircularRouteOrder(4, 2);
    const second = buildCircularRouteOrder(4, 2);

    first.reverse();

    expect(second).toEqual([2, 3, 0, 1]);
  });

  test("the client and server helpers delegate to the same circular resolver", () => {
    expect(buildRouteOrder(4, 2, true)).toEqual([2, 3, 0, 1]);
    expect(buildRouteOrder(4, 2, false)).toEqual([0, 1, 2, 3]);
    expect(getServerRouteOrder(4, 2, true)).toEqual([2, 3, 0, 1]);
    expect(getServerRouteOrder(4, 2, false)).toEqual([0, 1, 2, 3]);
  });
});

test.describe("post order policy", () => {
  test("legacy, null, unknown and reserved random modes execute as fixed", () => {
    expect(normalizePostOrderMode(null)).toBe(POST_ORDER_MODES.FIXED);
    expect(normalizePostOrderMode(undefined)).toBe(POST_ORDER_MODES.FIXED);
    expect(normalizePostOrderMode("legacy")).toBe(POST_ORDER_MODES.FIXED);
    expect(normalizePostOrderMode(POST_ORDER_MODES.RANDOM_PER_ASSIGNMENT)).toBe(
      POST_ORDER_MODES.FIXED
    );
  });

  test("random_per_assignment is recognized but cannot be activated in V1", () => {
    expect(isPostOrderMode(POST_ORDER_MODES.RANDOM_PER_ASSIGNMENT)).toBe(true);
    expect(isActivePostOrderMode(POST_ORDER_MODES.RANDOM_PER_ASSIGNMENT)).toBe(false);
    expect(resolvePostOrderMode(POST_ORDER_MODES.RANDOM_PER_ASSIGNMENT, "manuel")).toBe(
      POST_ORDER_MODES.FIXED
    );
  });

  test("eligible standard race types may use distributed circular order", () => {
    const eligibleRaceTypes = [
      "manuel",
      "quiz",
      "manual",
      "generel quiz",
      "dansk",
      "danish",
      "engelsk",
      "english",
      "matematik",
      "math",
      "foto",
      "photo",
      "standard",
      "standardløb",
      "standardloeb",
      "blandet",
      "mixed",
    ];

    for (const raceType of eligibleRaceTypes) {
      expect(isDistributedCircularEligibleRaceType(raceType), raceType).toBe(true);
      expect(
        resolvePostOrderMode(POST_ORDER_MODES.DISTRIBUTED_CIRCULAR, raceType),
        raceType
      ).toBe(POST_ORDER_MODES.DISTRIBUTED_CIRCULAR);
    }
  });

  test("special games and deferred types are always fixed", () => {
    const fixedRaceTypes = [
      "escape",
      "escape_room",
      "rollespil",
      "tidsmaskinen",
      "zone_krig",
      "zone-krigen",
      "stratego",
      "find_bedrageren",
      "impostor",
      "stjerneloeb",
      "stjerneløb",
      "podcast",
      "musikquiz",
      "musik quiz",
      "scanner",
      "selfie",
    ];

    for (const raceType of fixedRaceTypes) {
      expect(isDistributedCircularEligibleRaceType(raceType), raceType).toBe(false);
      expect(
        resolvePostOrderMode(POST_ORDER_MODES.DISTRIBUTED_CIRCULAR, raceType),
        raceType
      ).toBe(POST_ORDER_MODES.FIXED);
    }
  });

  test("unknown and missing race types fail closed", () => {
    for (const raceType of [null, undefined, "", "future_special_game"]) {
      expect(isDistributedCircularEligibleRaceType(raceType)).toBe(false);
      expect(resolvePostOrderMode(POST_ORDER_MODES.DISTRIBUTED_CIRCULAR, raceType)).toBe(
        POST_ORDER_MODES.FIXED
      );
    }
  });

  test("fixed remains fixed even for eligible race types", () => {
    expect(resolvePostOrderMode(POST_ORDER_MODES.FIXED, "manuel")).toBe(
      POST_ORDER_MODES.FIXED
    );
    expect(resolvePostOrderMode(null, "manuel")).toBe(POST_ORDER_MODES.FIXED);
  });

  test("session snapshots execute distributed order only for the supported route version", () => {
    expect(isSupportedRouteVersion(CURRENT_ROUTE_VERSION)).toBe(true);
    expect(isSupportedRouteVersion(String(CURRENT_ROUTE_VERSION))).toBe(true);
    expect(
      resolveSessionPostOrderMode(
        POST_ORDER_MODES.DISTRIBUTED_CIRCULAR,
        "standard",
        CURRENT_ROUTE_VERSION
      )
    ).toBe(POST_ORDER_MODES.DISTRIBUTED_CIRCULAR);

    for (const routeVersion of [null, undefined, 0, 2, "future"]) {
      expect(
        resolveSessionPostOrderMode(
          POST_ORDER_MODES.DISTRIBUTED_CIRCULAR,
          "standard",
          routeVersion
        ),
        String(routeVersion)
      ).toBe(POST_ORDER_MODES.FIXED);
    }

    expect(
      supportsServerStaggeredStart(
        "standard",
        POST_ORDER_MODES.DISTRIBUTED_CIRCULAR,
        CURRENT_ROUTE_VERSION
      )
    ).toBe(true);
    expect(
      supportsServerStaggeredStart(
        "standard",
        POST_ORDER_MODES.DISTRIBUTED_CIRCULAR,
        null
      )
    ).toBe(false);
  });

  test("the client can trust the server-resolved mode for generic standard aliases", () => {
    const resolvedApiMode = resolveSessionPostOrderMode(
      POST_ORDER_MODES.DISTRIBUTED_CIRCULAR,
      "mixed",
      CURRENT_ROUTE_VERSION
    );

    expect(normalizePostOrderMode(resolvedApiMode)).toBe(
      POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
    );
  });
});
