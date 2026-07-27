import { expect, test, type Page } from "@playwright/test";

import { STUDENT_LOCATION_STALE_AFTER_MS } from "@/lib/location/studentLocationState";

test.use({ serviceWorkers: "block" });

const POST_LAT = 55.6761;
const POST_LNG = 12.5683;
const PARTICIPANT_ID = "f0000000-0000-4000-8000-000000000001";
const TEAM_NAME = "GPS Recovery Hold";
const QUESTION_TEXT = "Hvilken farve har himlen på en klar dag?";

const QUESTION = {
  type: "multiple_choice",
  text: QUESTION_TEXT,
  answers: ["Blå", "Grøn", "Rød", "Sort"],
  correctIndex: 0,
  points: 10,
  lat: POST_LAT,
  lng: POST_LNG,
};

type SessionFixture = {
  sessionId: string;
  raceType?: "quiz" | "photo";
  rawRaceType?: string;
  usesStandardStudentLocationExperience: boolean;
  restoredPosition?: {
    lat: number;
    lng: number;
  };
};

type HarnessSnapshot = {
  watchStarts: number;
  clearWatchCalls: number;
  getCurrentStarts: number;
  activeWatchIds: number[];
  statusCalls: number;
};

async function installPlayHarness(page: Page, fixture: SessionFixture) {
  await page.addInitScript(
    ({ fixture, participantId, teamName, question }) => {
      type WatchCallbacks = {
        success: PositionCallback;
        error: PositionErrorCallback | null;
      };

      type Harness = {
        snapshot: () => {
          watchStarts: number;
          clearWatchCalls: number;
          getCurrentStarts: number;
          activeWatchIds: number[];
          statusCalls: number;
        };
        emitPosition: (
          latitude: number,
          longitude: number,
          accuracy: number,
          timestamp?: number,
        ) => void;
        emitError: (code: 1 | 2 | 3, message?: string) => void;
        setPermission: (state: PermissionState) => void;
        setVisibility: (state: DocumentVisibilityState) => void;
        setOnline: (online: boolean) => void;
        setStatusRecoveryOk: (ok: boolean) => void;
      };

      const harnessWindow = window as typeof window & {
        __studentLocationHarness: Harness;
      };

      type ConnectivityEventType = "online" | "offline";
      type ConnectivityListener = EventListenerOrEventListenerObject;
      const playConnectivityListeners = new Map<
        ConnectivityEventType,
        Set<ConnectivityListener>
      >([
        ["online", new Set()],
        ["offline", new Set()],
      ]);
      const nativeAddEventListener = window.addEventListener.bind(window);
      const nativeRemoveEventListener = window.removeEventListener.bind(window);

      window.addEventListener = ((
        type: string,
        listener: ConnectivityListener | null,
        options?: boolean | AddEventListenerOptions,
      ) => {
        if (
          listener &&
          (type === "online" || type === "offline")
        ) {
          const registrationStack = new Error().stack?.replaceAll("\\", "/") ?? "";
          if (
            registrationStack.includes("/components/play/") ||
            registrationStack.includes("/app/play/")
          ) {
            playConnectivityListeners
              .get(type as ConnectivityEventType)
              ?.add(listener);
          }
        }
        nativeAddEventListener(type, listener as EventListener, options);
      }) as typeof window.addEventListener;

      window.removeEventListener = ((
        type: string,
        listener: ConnectivityListener | null,
        options?: boolean | EventListenerOptions,
      ) => {
        if (
          listener &&
          (type === "online" || type === "offline")
        ) {
          playConnectivityListeners
            .get(type as ConnectivityEventType)
            ?.delete(listener);
        }
        nativeRemoveEventListener(type, listener as EventListener, options);
      }) as typeof window.removeEventListener;

      const storedParticipant = {
        participantId,
        sessionId: fixture.sessionId,
        studentName: teamName,
        startOffset: 0,
        savedAt: new Date().toISOString(),
        teamId: null,
        teamColor: null,
        avatarUrl: null,
        sessionStatus: "running",
        hasCompletedAvatarGate: true,
      };
      window.localStorage.setItem(
        "gpslob_active_participant",
        JSON.stringify(storedParticipant),
      );

      let permissionState: PermissionState = "prompt";
      const permissionListeners = new Set<EventListener>();
      const permissionStatus = {
        get state() {
          return permissionState;
        },
        onchange: null,
        addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
          if (type === "change" && typeof listener === "function") {
            permissionListeners.add(listener);
          }
        },
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
          if (type === "change" && typeof listener === "function") {
            permissionListeners.delete(listener);
          }
        },
        dispatchEvent(event: Event) {
          permissionListeners.forEach((listener) => listener.call(permissionStatus, event));
          return true;
        },
      } as PermissionStatus;

      Object.defineProperty(navigator, "permissions", {
        configurable: true,
        value: {
          query: async () => permissionStatus,
        },
      });

      let nextWatchId = 1;
      let watchStarts = 0;
      let clearWatchCalls = 0;
      let getCurrentStarts = 0;
      const activeWatches = new Map<number, WatchCallbacks>();
      const pendingCurrentPositions: WatchCallbacks[] = [];

      const geolocation: Geolocation = {
        clearWatch(watchId) {
          clearWatchCalls += 1;
          activeWatches.delete(watchId);
        },
        getCurrentPosition(success, error = null) {
          getCurrentStarts += 1;
          pendingCurrentPositions.push({ success, error });
        },
        watchPosition(success, error = null) {
          watchStarts += 1;
          const watchId = nextWatchId;
          nextWatchId += 1;
          activeWatches.set(watchId, { success, error });
          return watchId;
        },
      };

      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: geolocation,
      });

      let online = true;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => online,
      });

      let visibilityState: DocumentVisibilityState = "visible";
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibilityState,
      });
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => visibilityState !== "visible",
      });

      let statusRecoveryOk = true;
      let statusCalls = 0;

      harnessWindow.__studentLocationHarness = {
        snapshot: () => ({
          watchStarts,
          clearWatchCalls,
          getCurrentStarts,
          activeWatchIds: [...activeWatches.keys()],
          statusCalls,
        }),
        emitPosition(latitude, longitude, accuracy, timestamp = Date.now()) {
          const position = {
            coords: {
              latitude,
              longitude,
              accuracy,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp,
            toJSON: () => ({}),
          } as GeolocationPosition;

          [...activeWatches.values()].forEach(({ success }) => success(position));
          pendingCurrentPositions.splice(0).forEach(({ success }) => success(position));
        },
        emitError(code, message = "Mocked geolocation failure") {
          const error = {
            code,
            message,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError;

          [...activeWatches.values()].forEach(({ error: callback }) => callback?.(error));
          pendingCurrentPositions
            .splice(0)
            .forEach(({ error: callback }) => callback?.(error));
        },
        setPermission(state) {
          permissionState = state;
          permissionStatus.dispatchEvent(new Event("change"));
        },
        setVisibility(state) {
          visibilityState = state;
          document.dispatchEvent(new Event("visibilitychange"));
        },
        setOnline(nextOnline) {
          online = nextOnline;
          const type: ConnectivityEventType = nextOnline ? "online" : "offline";
          const event = new Event(type);
          playConnectivityListeners.get(type)?.forEach((listener) => {
            if (typeof listener === "function") {
              listener.call(window, event);
            } else {
              listener.handleEvent(event);
            }
          });
        },
        setStatusRecoveryOk(ok) {
          statusRecoveryOk = ok;
        },
      };

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const method = (
          init?.method ??
          (input instanceof Request ? input.method : "GET")
        ).toUpperCase();

        if (url.includes("/api/play/session")) {
          return new Response(
            JSON.stringify({
              questions: [
                fixture.raceType === "photo"
                  ? {
                      ...question,
                      type: "ai_image",
                      aiPrompt: "Tag et billede af noget blåt",
                    }
                  : question,
              ],
              raceType: fixture.raceType ?? "quiz",
              rawRaceType: fixture.rawRaceType,
              postOrderMode: "fixed",
              radius: 50,
              gpsOverride: false,
              usesStandardStudentLocationExperience:
                fixture.usesStandardStudentLocationExperience,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url.includes("/api/play/status")) {
          statusCalls += 1;
          return new Response(
            JSON.stringify(
              statusRecoveryOk
                ? { sessionStatus: "running", gpsOverride: false }
                : { error: "Mocked status recovery failure" },
            ),
            {
              status: statusRecoveryOk ? 200 : 503,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url.includes("/api/play/participant")) {
          return new Response(
            JSON.stringify({
              participant: {
                id: participantId,
                session_id: fixture.sessionId,
                student_name: teamName,
                start_offset: 0,
                lat: fixture.restoredPosition?.lat ?? null,
                lng: fixture.restoredPosition?.lng ?? null,
                finished_at: null,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url.includes("/api/join") && method === "POST") {
          return new Response(
            JSON.stringify({
              participantId,
              sessionId: fixture.sessionId,
              studentName: teamName,
              startOffset: 0,
              sessionStatus: "running",
              teamId: null,
              teamColor: null,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (
          url.includes("/api/play/location") ||
          url.includes("/api/telemetry") ||
          url.includes("supabase") ||
          url.includes("realtime")
        ) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return originalFetch(input, init);
      };
    },
    {
      fixture,
      participantId: PARTICIPANT_ID,
      teamName: TEAM_NAME,
      question: QUESTION,
    },
  );
}

async function dismissMaintenanceOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("div").forEach((element) => {
      const className =
        typeof element.className === "string" ? element.className : "";
      const text = element.textContent ?? "";
      if (
        className.includes("fixed") &&
        className.includes("inset-0") &&
        (text.includes("lukke siden ned") || text.includes("Vi holder pause"))
      ) {
        element.remove();
      }
    });
  });
}

async function harnessSnapshot(page: Page): Promise<HarnessSnapshot> {
  return page.evaluate(() => {
    const harnessWindow = window as typeof window & {
      __studentLocationHarness: {
        snapshot: () => HarnessSnapshot;
      };
    };
    return harnessWindow.__studentLocationHarness.snapshot();
  });
}

async function callHarness(
  page: Page,
  action:
    | {
        type: "position";
        accuracy: number;
        timestamp?: number;
        latitude?: number;
        longitude?: number;
      }
    | { type: "error"; code: 1 | 2 | 3; message?: string }
    | { type: "visibility"; state: DocumentVisibilityState }
    | { type: "online"; online: boolean }
    | { type: "status"; ok: boolean },
) {
  await page.evaluate(
    ({ action, lat, lng }) => {
      const harnessWindow = window as typeof window & {
        __studentLocationHarness: {
          emitPosition: (
            latitude: number,
            longitude: number,
            accuracy: number,
            timestamp?: number,
          ) => void;
          emitError: (code: 1 | 2 | 3, message?: string) => void;
          setVisibility: (state: DocumentVisibilityState) => void;
          setOnline: (online: boolean) => void;
          setStatusRecoveryOk: (ok: boolean) => void;
        };
      };
      const harness = harnessWindow.__studentLocationHarness;

      if (action.type === "position") {
        harness.emitPosition(
          action.latitude ?? lat,
          action.longitude ?? lng,
          action.accuracy,
          action.timestamp,
        );
      } else if (action.type === "error") {
        harness.emitError(action.code, action.message);
      } else if (action.type === "visibility") {
        harness.setVisibility(action.state);
      } else if (action.type === "online") {
        harness.setOnline(action.online);
      } else {
        harness.setStatusRecoveryOk(action.ok);
      }
    },
    { action, lat: POST_LAT, lng: POST_LNG },
  );
}

async function openStandardPlay(page: Page, sessionId: string) {
  await installPlayHarness(page, {
    sessionId,
    raceType: "quiz",
    usesStandardStudentLocationExperience: true,
  });
  await page.goto(`/play/${sessionId}?name=${encodeURIComponent(TEAM_NAME)}`);
  await dismissMaintenanceOverlay(page);
  await expect(page.getByText("Find din placering", { exact: true })).toBeVisible({
    timeout: 35_000,
  });
}

test.describe("student location recovery", () => {
  test.setTimeout(60_000);

  test("asks before starting one watcher and deduplicates permission retry", async ({
    page,
  }) => {
    await openStandardPlay(page, "student-location-permission");

    await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(0);

    await page.getByRole("button", { name: "Tillad placering" }).click();
    await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(1);
    await expect.poll(async () => (await harnessSnapshot(page)).activeWatchIds).toHaveLength(1);

    await callHarness(page, {
      type: "error",
      code: 1,
      message: "PERMISSION_DENIED code 1",
    });

    await expect(page.getByText("Placering er slået fra", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /PERMISSION_DENIED|GeolocationPositionError|code 1/i,
    );

    const retryButton = page.getByRole("button", { name: "Prøv igen" });
    await retryButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });

    await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(2);
    await expect.poll(async () => (await harnessSnapshot(page)).activeWatchIds).toHaveLength(1);

    await callHarness(page, { type: "error", code: 3 });
    await expect(
      page.getByText("Det tager længere tid end normalt", { exact: true }),
    ).toBeVisible();
  });

  test("requires a fresh accurate fix and an explicit single open action", async ({
    page,
  }) => {
    await openStandardPlay(page, "student-location-arrival");
    await page.getByRole("button", { name: "Tillad placering" }).click();
    await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(1);

    await callHarness(page, { type: "position", accuracy: 300 });
    await expect(
      page.getByText("GPS-signalet er lidt usikkert", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Du er fremme!", { exact: true })).toHaveCount(0);
    await expect(page.getByText(QUESTION_TEXT, { exact: true })).toHaveCount(0);

    await callHarness(page, { type: "position", accuracy: 5 });
    const arrivedCard = page
      .getByRole("status")
      .filter({ hasText: "Du er fremme!" });
    await expect(arrivedCard).toBeVisible();
    const openButton = arrivedCard.getByRole("button", {
      name: "Åbn post",
      exact: true,
    });
    await expect(openButton).toBeEnabled();
    await expect(page.getByText(QUESTION_TEXT, { exact: true })).toHaveCount(0);

    await openButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });

    await expect(page.getByText(QUESTION_TEXT, { exact: true })).toBeVisible();
    await expect(page.getByText(QUESTION_TEXT, { exact: true })).toHaveCount(1);

    await callHarness(page, { type: "error", code: 2 });
    await expect(page.getByText(QUESTION_TEXT, { exact: true })).toBeVisible();
    await expect(
      page.getByText("Vi mistede din placering", { exact: true }),
    ).toHaveCount(0);
  });

  test("does not treat a restored participant position as a fresh arrival", async ({
    page,
  }) => {
    const sessionId = "student-location-stale-restore";
    await installPlayHarness(page, {
      sessionId,
      raceType: "quiz",
      usesStandardStudentLocationExperience: true,
      restoredPosition: { lat: POST_LAT, lng: POST_LNG },
    });
    await page.goto(`/play/${sessionId}?name=${encodeURIComponent(TEAM_NAME)}`);
    await dismissMaintenanceOverlay(page);
    await expect(page.getByText("Find din placering", { exact: true })).toBeVisible({
      timeout: 35_000,
    });

    await expect(page.getByText("Du er fremme!", { exact: true })).toHaveCount(0);
    await expect(page.getByText(QUESTION_TEXT, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Tillad placering" }).click();
    await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(1);
    await expect(page.getByText("Du er fremme!", { exact: true })).toHaveCount(0);
    await expect(page.getByText(QUESTION_TEXT, { exact: true })).toHaveCount(0);

    await callHarness(page, { type: "position", accuracy: 5 });
    await expect(page.getByText("Du er fremme!", { exact: true })).toBeVisible();
  });

  test("rejected GPS jumps cannot keep an old arrival fresh", async ({
    page,
  }) => {
    await openStandardPlay(page, "student-location-rejected-jumps");
    await page.getByRole("button", { name: "Tillad placering" }).click();
    await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(1);

    await callHarness(page, { type: "position", accuracy: 5 });
    await expect(page.getByText("Du er fremme!", { exact: true })).toBeVisible();

    const jumpIntervalMs = 4_000;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.waitForTimeout(jumpIntervalMs);
      await callHarness(page, {
        type: "position",
        latitude: POST_LAT + 0.5,
        longitude: POST_LNG + 0.5,
        accuracy: 5,
      });
    }

    await page.waitForTimeout(
      STUDENT_LOCATION_STALE_AFTER_MS - jumpIntervalMs * 3 + 1_000,
    );
    await expect(page.getByText("Du er fremme!", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Vi mistede din placering", { exact: true }),
    ).toBeVisible();
  });

  test("clears the hidden watcher and requires a fresh fix after resume", async ({
    page,
  }) => {
    await openStandardPlay(page, "student-location-visibility");
    await page.getByRole("button", { name: "Tillad placering" }).click();
    await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(1);
    await callHarness(page, { type: "position", accuracy: 5 });
    await expect(page.getByText("Du er fremme!", { exact: true })).toBeVisible();

    await page.waitForTimeout(850);
    await callHarness(page, { type: "visibility", state: "hidden" });
    await expect.poll(async () => (await harnessSnapshot(page)).activeWatchIds).toHaveLength(0);
    await expect(page.getByText("Du er fremme!", { exact: true })).toHaveCount(0);

    await callHarness(page, { type: "visibility", state: "visible" });
    await expect.poll(async () => (await harnessSnapshot(page)).activeWatchIds).toHaveLength(1);
    await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(2);
    await expect(page.getByText("Du er fremme!", { exact: true })).toHaveCount(0);

    await callHarness(page, { type: "position", accuracy: 5 });
    await expect(page.getByText("Du er fremme!", { exact: true })).toBeVisible();
  });

  for (const special of [
    { rawRaceType: "musikquiz", raceType: "quiz" as const },
    { rawRaceType: "selfie", raceType: "photo" as const },
    { rawRaceType: "scanner", raceType: "quiz" as const },
  ]) {
    test(`${special.rawRaceType} keeps legacy GPS without the standard prompt`, async ({
      page,
    }) => {
      const sessionId = `student-location-special-${special.rawRaceType}`;
      await installPlayHarness(page, {
        sessionId,
        rawRaceType: special.rawRaceType,
        raceType: special.raceType,
        usesStandardStudentLocationExperience: false,
      });

      await page.goto(`/play/${sessionId}?name=${encodeURIComponent(TEAM_NAME)}`);
      await dismissMaintenanceOverlay(page);

      await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(1);
      await expect.poll(async () => (await harnessSnapshot(page)).activeWatchIds).toHaveLength(1);
      await expect(page.getByText("Find din placering", { exact: true })).toHaveCount(0);

      await callHarness(page, { type: "error", code: 1 });
      await expect(
        page.getByText("GPS er blokeret", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Placering er slået fra", { exact: true }),
      ).toHaveCount(0);

      await page.getByRole("button", { name: "Prøv igen" }).click();
      await expect.poll(async () => (await harnessSnapshot(page)).watchStarts).toBe(2);
    });
  }

  test("keeps the page offline and confirms reconnection only after status recovery", async ({
    page,
  }) => {
    await openStandardPlay(page, "student-location-offline");
    const playUrl = page.url();

    await callHarness(page, { type: "online", online: false });
    await expect(page.getByText("Ingen forbindelse", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tillad placering" }),
    ).toBeVisible();
    expect(page.url()).toBe(playUrl);
    expect((await page.locator("body").innerText()).trim().length).toBeGreaterThan(20);

    await callHarness(page, { type: "status", ok: false });
    const failedRecoveryBaseline = (await harnessSnapshot(page)).statusCalls;
    await callHarness(page, { type: "online", online: true });
    await expect
      .poll(async () => (await harnessSnapshot(page)).statusCalls)
      .toBeGreaterThan(failedRecoveryBaseline);
    await page.waitForTimeout(500);
    await expect(
      page.getByText("Forbindelsen er tilbage", { exact: true }),
    ).toHaveCount(0);

    await callHarness(page, { type: "online", online: false });
    await expect(page.getByText("Ingen forbindelse", { exact: true })).toBeVisible();
    await callHarness(page, { type: "status", ok: true });
    const successfulRecoveryBaseline = (await harnessSnapshot(page)).statusCalls;
    await callHarness(page, { type: "online", online: true });
    await expect
      .poll(async () => (await harnessSnapshot(page)).statusCalls)
      .toBeGreaterThan(successfulRecoveryBaseline);
    await expect(
      page.getByText("Forbindelsen er tilbage", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
