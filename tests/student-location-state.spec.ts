import { expect, test } from "@playwright/test";

import {
  resolveStudentLocationState,
  STUDENT_LOCATION_STALE_AFTER_MS,
  STUDENT_LOCATION_UNLOCK_MAX_ACCURACY_METERS,
  STUDENT_LOCATION_WEAK_ACCURACY_METERS,
  type StudentLocationStateInput,
  usesStandardStudentLocationExperience,
} from "@/lib/location/studentLocationState";

const NOW_MS = 2_000_000;

function buildInput(
  overrides: Partial<StudentLocationStateInput> = {}
): StudentLocationStateInput {
  return {
    enabled: true,
    supported: true,
    online: true,
    permission: "granted",
    requesting: false,
    locating: false,
    hasPosition: true,
    timestampMs: NOW_MS,
    accuracyMeters: 20,
    error: null,
    resumedAtMs: null,
    nowMs: NOW_MS,
    ...overrides,
  };
}

test.describe("student location state", () => {
  test("covers idle, permission request and locating states", () => {
    expect(
      resolveStudentLocationState(buildInput({ enabled: false })).status
    ).toBe("idle");
    expect(
      resolveStudentLocationState(
        buildInput({
          permission: "prompt",
          requesting: true,
          hasPosition: false,
          timestampMs: null,
          accuracyMeters: null,
        })
      ).status
    ).toBe("requesting_permission");
    expect(
      resolveStudentLocationState(
        buildInput({
          locating: true,
          hasPosition: false,
          timestampMs: null,
          accuracyMeters: null,
        })
      ).status
    ).toBe("locating");
  });

  test("reports supported, denied and offline failure states precisely", () => {
    expect(
      resolveStudentLocationState(buildInput({ supported: false })).status
    ).toBe("unsupported");
    expect(
      resolveStudentLocationState(
        buildInput({
          permission: "denied",
          error: "permission_denied",
        })
      ).status
    ).toBe("permission_denied");
    expect(
      resolveStudentLocationState(buildInput({ online: false })).status
    ).toBe("offline");
  });

  test("classifies accurate and weak fresh positions without exposing coordinates", () => {
    const accurate = resolveStudentLocationState(
      buildInput({
        accuracyMeters: STUDENT_LOCATION_WEAK_ACCURACY_METERS,
      })
    );
    const weakButUsable = resolveStudentLocationState(
      buildInput({
        accuracyMeters: STUDENT_LOCATION_WEAK_ACCURACY_METERS + 1,
      })
    );

    expect(accurate).toEqual({
      status: "ready",
      accuracyCategory: "good",
      isFresh: true,
      canUsePositionForUnlock: true,
    });
    expect(weakButUsable).toEqual({
      status: "weak_accuracy",
      accuracyCategory: "weak",
      isFresh: true,
      canUsePositionForUnlock: true,
    });
    expect(Object.keys(accurate).sort()).toEqual([
      "accuracyCategory",
      "canUsePositionForUnlock",
      "isFresh",
      "status",
    ]);
  });

  test("never unlocks from excessive or unknown accuracy", () => {
    const excessive = resolveStudentLocationState(
      buildInput({
        accuracyMeters: STUDENT_LOCATION_UNLOCK_MAX_ACCURACY_METERS + 1,
      })
    );
    const unknown = resolveStudentLocationState(
      buildInput({ accuracyMeters: null })
    );

    expect(excessive.status).toBe("weak_accuracy");
    expect(excessive.canUsePositionForUnlock).toBe(false);
    expect(unknown.accuracyCategory).toBe("unknown");
    expect(unknown.status).toBe("temporarily_unavailable");
    expect(unknown.canUsePositionForUnlock).toBe(false);
  });

  test("treats stale positions and positions from before resume as unusable", () => {
    const atFreshnessBoundary = resolveStudentLocationState(
      buildInput({
        timestampMs: NOW_MS - STUDENT_LOCATION_STALE_AFTER_MS,
      })
    );
    const stale = resolveStudentLocationState(
      buildInput({
        timestampMs: NOW_MS - STUDENT_LOCATION_STALE_AFTER_MS - 1,
      })
    );
    const beforeResume = resolveStudentLocationState(
      buildInput({
        timestampMs: NOW_MS - 1_000,
        resumedAtMs: NOW_MS - 500,
      })
    );

    expect(atFreshnessBoundary.isFresh).toBe(true);
    expect(atFreshnessBoundary.canUsePositionForUnlock).toBe(true);
    expect(stale.status).toBe("temporarily_unavailable");
    expect(stale.isFresh).toBe(false);
    expect(stale.canUsePositionForUnlock).toBe(false);
    expect(beforeResume.status).toBe("temporarily_unavailable");
    expect(beforeResume.isFresh).toBe(false);
    expect(beforeResume.canUsePositionForUnlock).toBe(false);
  });

  test("distinguishes timeout and temporary unavailability", () => {
    expect(
      resolveStudentLocationState(buildInput({ error: "timeout" })).status
    ).toBe("timed_out");
    expect(
      resolveStudentLocationState(
        buildInput({ error: "position_unavailable" })
      ).status
    ).toBe("temporarily_unavailable");
    expect(
      resolveStudentLocationState(buildInput({ error: "unknown" })).status
    ).toBe("temporarily_unavailable");
  });

  test("recovers from one timeout through locating to a fresh ready fix", () => {
    const timedOut = resolveStudentLocationState(
      buildInput({
        error: "timeout",
        hasPosition: false,
        timestampMs: null,
        accuracyMeters: null,
      })
    );
    const retrying = resolveStudentLocationState(
      buildInput({
        error: null,
        locating: true,
        hasPosition: false,
        timestampMs: null,
        accuracyMeters: null,
      })
    );
    const recovered = resolveStudentLocationState(
      buildInput({
        error: null,
        locating: false,
        hasPosition: true,
        timestampMs: NOW_MS,
        accuracyMeters: 30,
      })
    );

    expect(timedOut.status).toBe("timed_out");
    expect(retrying.status).toBe("locating");
    expect(recovered.status).toBe("ready");
    expect(recovered.canUsePositionForUnlock).toBe(true);
  });

  test("keeps a fresh accurate GPS position usable while connection is offline", () => {
    const state = resolveStudentLocationState(buildInput({ online: false }));

    expect(state.status).toBe("offline");
    expect(state.isFresh).toBe(true);
    expect(state.canUsePositionForUnlock).toBe(true);
  });
});

test.describe("standard student location experience policy", () => {
  test("allows only the explicit ordinary race type aliases", () => {
    const allowedRaceTypes = [
      "manuel",
      "quiz",
      "manual",
      "manuelt",
      "dansk",
      "danish",
      "engelsk",
      "english",
      "matematik",
      "math",
      "foto",
      "photo",
    ];

    for (const raceType of allowedRaceTypes) {
      expect(
        usesStandardStudentLocationExperience(raceType),
        raceType
      ).toBe(true);
    }

    expect(usesStandardStudentLocationExperience("  QUIZ ")).toBe(true);
  });

  test("fails closed for special, unknown and missing race types", () => {
    const deniedRaceTypes = [
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
      "future_special_game",
      "",
      null,
      undefined,
    ];

    for (const raceType of deniedRaceTypes) {
      expect(
        usesStandardStudentLocationExperience(raceType),
        String(raceType)
      ).toBe(false);
    }
  });
});
