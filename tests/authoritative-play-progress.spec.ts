import { expect, test } from "@playwright/test";

import {
  buildAuthoritativeProgressSnapshot,
} from "@/app/api/play/_shared";
import {
  normalizeAuthoritativeProgressSnapshot,
} from "@/components/play/participantHandoff";

test.describe("authoritative standard-play progress", () => {
  test("fixed progress is canonical, unique, and selects the first unresolved post", () => {
    expect(
      buildAuthoritativeProgressSnapshot({
        routeOrder: [0, 1, 2, 3, 4],
        answerRows: [
          { question_index: 3, post_index: 4 },
          { question_index: 1, post_index: 2 },
          { question_index: 1, post_index: 2 },
          { question_index: 0, post_index: 1 },
        ],
      })
    ).toEqual({
      answeredPostIndexes: [0, 1, 3],
      expectedPostIndex: 2,
      isFinished: false,
    });
  });

  test("distributed progress follows the participant route without restarting at its offset", () => {
    expect(
      buildAuthoritativeProgressSnapshot({
        routeOrder: [3, 4, 0, 1, 2],
        answerRows: [
          { question_index: 3 },
          { question_index: 4 },
          { question_index: 0 },
          { question_index: 1 },
        ],
      })
    ).toEqual({
      answeredPostIndexes: [0, 1, 3, 4],
      expectedPostIndex: 2,
      isFinished: false,
    });
  });

  test("all-complete and one-post progress finish with no fallback post", () => {
    expect(
      buildAuthoritativeProgressSnapshot({
        routeOrder: [3, 4, 0, 1, 2],
        answerRows: [0, 1, 2, 3, 4].map((question_index) => ({ question_index })),
      })
    ).toEqual({
      answeredPostIndexes: [0, 1, 2, 3, 4],
      expectedPostIndex: null,
      isFinished: true,
    });

    expect(
      buildAuthoritativeProgressSnapshot({
        routeOrder: [0],
        answerRows: [{ post_index: 1 }],
      })
    ).toEqual({
      answeredPostIndexes: [0],
      expectedPostIndex: null,
      isFinished: true,
    });
  });

  test("invalid and out-of-route answer indexes are excluded", () => {
    expect(
      buildAuthoritativeProgressSnapshot({
        routeOrder: [0, 1, 2],
        answerRows: [
          { question_index: -1 },
          { question_index: 9 },
          { question_index: "not-an-index" },
          { post_index: 2 },
        ],
      })
    ).toEqual({
      answeredPostIndexes: [1],
      expectedPostIndex: 0,
      isFinished: false,
    });
  });

  test("an empty route is an error, not a completed or post-zero snapshot", () => {
    expect(() =>
      buildAuthoritativeProgressSnapshot({ routeOrder: [], answerRows: [] })
    ).toThrow("Progression route is empty");
  });

  test("the client accepts only internally consistent authoritative snapshots", () => {
    expect(
      normalizeAuthoritativeProgressSnapshot(
        {
          answeredPostIndexes: [3, 1, 1, 0],
          expectedPostIndex: 2,
          isFinished: false,
        },
        5
      )
    ).toEqual({
      answeredPostIndexes: [0, 1, 3],
      expectedPostIndex: 2,
      isFinished: false,
    });

    expect(
      normalizeAuthoritativeProgressSnapshot(
        {
          answeredPostIndexes: [0],
          expectedPostIndex: null,
          isFinished: false,
        },
        1
      )
    ).toBeNull();

    expect(
      normalizeAuthoritativeProgressSnapshot(
        {
          answeredPostIndexes: [0],
          expectedPostIndex: 0,
          isFinished: false,
        },
        2
      )
    ).toBeNull();
  });

  test("concurrent mocked retries persist one answer and return identical final progress", async () => {
    const storedAnswers = new Map<
      string,
      { question_index: number; awarded_points: number }
    >();
    let awardedPointWrites = 0;

    const submit = async (operationId: string) => {
      await Promise.resolve();
      let answer = storedAnswers.get(operationId);
      const duplicate = Boolean(answer);
      if (!answer) {
        answer = { question_index: 0, awarded_points: 10 };
        storedAnswers.set(operationId, answer);
        awardedPointWrites += 1;
      }
      await Promise.resolve();
      return {
        duplicate,
        awardedPoints: answer.awarded_points,
        ...buildAuthoritativeProgressSnapshot({
          routeOrder: [0],
          answerRows: [...storedAnswers.values()],
        }),
      };
    };

    const operationId = "00000000-0000-4000-8000-000000000099";
    const [firstResponse, secondResponse] = await Promise.all([
      submit(operationId),
      submit(operationId),
    ]);

    expect(storedAnswers.size).toBe(1);
    expect(awardedPointWrites).toBe(1);
    expect(firstResponse).toMatchObject({
      answeredPostIndexes: [0],
      expectedPostIndex: null,
      isFinished: true,
    });
    expect(secondResponse).toMatchObject({
      answeredPostIndexes: firstResponse.answeredPostIndexes,
      expectedPostIndex: firstResponse.expectedPostIndex,
      isFinished: firstResponse.isFinished,
    });
    expect([firstResponse.duplicate, secondResponse.duplicate].sort()).toEqual([
      false,
      true,
    ]);
  });
});
