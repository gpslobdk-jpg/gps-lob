import { expect, test } from "@playwright/test";

import { buildLiveRouteOverview } from "@/lib/routes/liveRouteOverview";

const POSTS = [0, 1, 2, 3];
const DISTRIBUTED = {
  postIndexes: POSTS,
  postOrderMode: "distributed_circular",
  raceType: "manuel",
  routeVersion: 1,
};

test.describe("live route overview", () => {
  test("builds fixed and distributed routes through the central resolver", () => {
    expect(
      buildLiveRouteOverview({
        ...DISTRIBUTED,
        postOrderMode: "fixed",
        startOffset: 3,
        completedPostIndexes: [],
      }).routeOrder
    ).toEqual([0, 1, 2, 3]);

    const distributed = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 2,
      completedPostIndexes: [],
    });
    expect(distributed.routeOrder).toEqual([2, 3, 0, 1]);
    expect(distributed.startPostNumber).toBe(3);
  });

  test("normalizes a large offset", () => {
    expect(
      buildLiveRouteOverview({
        ...DISTRIBUTED,
        startOffset: 10,
        completedPostIndexes: [],
      }).routeOrder
    ).toEqual([2, 3, 0, 1]);
  });

  test("normalizes negative and missing offsets safely", () => {
    const negative = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: -1,
      completedPostIndexes: [],
    });
    const missing = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: null,
      completedPostIndexes: [],
    });

    expect(negative.routeOrder).toEqual([3, 0, 1, 2]);
    expect(negative.isConsistent).toBe(false);
    expect(missing.routeOrder).toEqual([0, 1, 2, 3]);
    expect(missing.isConsistent).toBe(false);
  });

  test("shows the start post before any post is completed", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 1,
      completedPostIndexes: [],
    });

    expect(result.statusLabel).toBe("Ikke startet");
    expect(result.nextPostNumber).toBe(2);
    expect(result.completedCount).toBe(0);
  });

  test("finds the next unresolved post after some completions", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 2,
      completedPostIndexes: [2, 3],
    });

    expect(result.completedCount).toBe(2);
    expect(result.nextPostIndex).toBe(0);
    expect(result.currentRoutePosition).toBe(2);
    expect(result.statusLabel).toBe("2 af 4 poster gennemført");
  });

  test("completed participants have no false next post", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 1,
      completedPostIndexes: [0, 1, 2, 3],
    });

    expect(result.isCompleted).toBe(true);
    expect(result.nextPostIndex).toBeNull();
    expect(result.nextPostNumber).toBeNull();
    expect(result.statusLabel).toBe("Færdig");
  });

  test("an explicit finished state has no next post", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 1,
      completedPostIndexes: [1],
      participantFinished: true,
    });

    expect(result.isCompleted).toBe(true);
    expect(result.nextPostIndex).toBeNull();
  });

  test("handles one post", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      postIndexes: [0],
      startOffset: 99,
      completedPostIndexes: [],
    });

    expect(result.routeOrder).toEqual([0]);
    expect(result.startPostNumber).toBe(1);
    expect(result.nextPostNumber).toBe(1);
  });

  test("handles zero posts without crashing", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      postIndexes: [],
      startOffset: 0,
      completedPostIndexes: [],
    });

    expect(result.routeOrder).toEqual([]);
    expect(result.startPostNumber).toBeNull();
    expect(result.nextPostNumber).toBeNull();
    expect(result.statusLabel).toBe("Ingen poster");
  });

  test("answer storage order does not change the next post", () => {
    const ordered = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 3,
      completedPostIndexes: [3, 0],
    });
    const reversed = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 3,
      completedPostIndexes: [0, 3],
    });

    expect(reversed.nextPostIndex).toBe(ordered.nextPostIndex);
    expect(reversed.nextPostIndex).toBe(1);
  });

  test("duplicate answers count only once", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 0,
      completedPostIndexes: [0, 0, 0],
    });

    expect(result.completedCount).toBe(1);
    expect(result.nextPostIndex).toBe(1);
  });

  test("reload resumes at the first unresolved route post", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 2,
      completedPostIndexes: [2],
    });

    expect(result.nextPostIndex).toBe(3);
  });

  test("a skipped post advances through the same completed-post input", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 2,
      completedPostIndexes: [2, 3],
    });

    expect(result.nextPostIndex).toBe(0);
  });

  test("a valid active post takes precedence in the teacher status", () => {
    const result = buildLiveRouteOverview({
      ...DISTRIBUTED,
      startOffset: 0,
      completedPostIndexes: [0],
      activePostIndex: 2,
    });

    expect(result.nextPostIndex).toBe(2);
    expect(result.statusLabel).toBe("På vej til post 3");
  });
});
