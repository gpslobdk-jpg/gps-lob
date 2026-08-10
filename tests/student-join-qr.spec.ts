import { expect, test, type Page, type Route } from "@playwright/test";

test.use({
  serviceWorkers: "block",
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

type CameraMode = "granted" | "pending" | "denied";

type CameraSnapshot = {
  getUserMediaCalls: number;
  stopCalls: number;
  createdTracks: number;
  activeTracks: number;
};

const VALID_CODE = "ABC123";
const SESSION_ID = "11111111-2222-4333-8444-555555555555";
const RUN_TITLE = "QR-testløbet";

async function installCameraMock(page: Page, mode: CameraMode) {
  await page.addInitScript((cameraMode: CameraMode) => {
    const mediaDevices = navigator.mediaDevices;
    const originalGetUserMedia = mediaDevices?.getUserMedia?.bind(mediaDevices);
    const originalStop = globalThis.MediaStreamTrack?.prototype.stop;
    const activeTracks = new Set<MediaStreamTrack>();
    const knownTracks = new Set<MediaStreamTrack>();
    const retainedCanvases: HTMLCanvasElement[] = [];
    let getUserMediaCalls = 0;
    let stopCalls = 0;

    if (originalStop) {
      Object.defineProperty(MediaStreamTrack.prototype, "stop", {
        configurable: true,
        value: function stop(this: MediaStreamTrack) {
          stopCalls += 1;
          activeTracks.delete(this);
          return originalStop.call(this);
        },
      });
    }

    const rememberStream = (stream: MediaStream) => {
      for (const track of stream.getTracks()) {
        knownTracks.add(track);
        activeTracks.add(track);
      }
      return stream;
    };

    const createFallbackStream = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "#0f172a";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      retainedCanvases.push(canvas);
      return canvas.captureStream(1);
    };

    const mockedGetUserMedia = async (constraints?: MediaStreamConstraints) => {
      getUserMediaCalls += 1;

      if (cameraMode === "denied") {
        throw new DOMException("Camera permission denied", "NotAllowedError");
      }

      if (cameraMode === "pending") {
        return await new Promise<MediaStream>(() => {});
      }

      if (originalGetUserMedia) {
        try {
          return rememberStream(await originalGetUserMedia(constraints));
        } catch {
          // The canvas stream keeps this test independent of host camera hardware.
        }
      }

      return rememberStream(createFallbackStream());
    };

    const nextMediaDevices = mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(nextMediaDevices, "getUserMedia", {
      configurable: true,
      value: mockedGetUserMedia,
    });
    Object.defineProperty(nextMediaDevices, "enumerateDevices", {
      configurable: true,
      value: async () => [
        {
          deviceId: "student-join-test-camera",
          groupId: "student-join-test-group",
          kind: "videoinput" as MediaDeviceKind,
          label: "Student join test camera",
          toJSON() {
            return this;
          },
        },
      ],
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: nextMediaDevices,
    });

    (
      window as Window & {
        __joinQrCameraMock?: { snapshot: () => CameraSnapshot };
      }
    ).__joinQrCameraMock = {
      snapshot: () => ({
        getUserMediaCalls,
        stopCalls,
        createdTracks: knownTracks.size,
        activeTracks: activeTracks.size,
      }),
    };
  }, mode);
}

async function mockNonJoinRequests(page: Page) {
  await page.context().route(/\/api\/telemetry(?:\?|$)/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.context().route(
    /supabase.*realtime|realtime\/v1\/websocket/i,
    async (route: Route) => {
      await route.abort("connectionrefused");
    },
  );
}

async function dismissMaintenanceOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("div.fixed.inset-0").forEach((element) => {
      const text = element.textContent ?? "";
      if (text.includes("lukke siden ned") || text.includes("Vi holder pause")) {
        element.remove();
      }
    });
  });
}

async function openJoinPage(page: Page, cameraMode: CameraMode) {
  await installCameraMock(page, cameraMode);
  await mockNonJoinRequests(page);
  await page.context().grantPermissions(["camera"], {
    origin: "http://localhost:3000",
  });
  await page.goto("/join", { waitUntil: "domcontentloaded" });
  await dismissMaintenanceOverlay(page);

  const scanButton = page.getByRole("button", { name: "Scan QR-kode" });
  await expect(scanButton).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === "Scan QR-kode",
    );
    return (
      button !== undefined &&
      Object.keys(button).some((key) => key.startsWith("__reactProps$"))
    );
  });
  return scanButton;
}

async function cameraSnapshot(page: Page) {
  return page.evaluate(() => {
    const cameraMock = (
      window as Window & {
        __joinQrCameraMock?: { snapshot: () => CameraSnapshot };
      }
    ).__joinQrCameraMock;
    if (!cameraMock) {
      throw new Error("Join QR camera mock was not installed");
    }
    return cameraMock.snapshot();
  });
}

async function startScanner(page: Page) {
  await page.waitForFunction(
    () =>
      typeof (
        window as Window & {
          __joinQrTestHook?: unknown;
        }
      ).__joinQrTestHook === "function",
  );
}

async function sendQrValue(page: Page, value: string) {
  await page.evaluate((decodedValue) => {
    const hook = (
      window as Window & {
        __joinQrTestHook?: (candidate: string) => void;
      }
    ).__joinQrTestHook;
    if (!hook) {
      throw new Error("Join QR test hook is not ready");
    }
    hook(decodedValue);
  }, value);
}

test.describe("production /join QR scanner", () => {
  test("starts in one tap, traps focus, locks scroll and restores focus on Escape", async ({
    page,
  }) => {
    const scanButton = await openJoinPage(page, "granted");

    await scanButton.click();
    await expect(page.getByTestId("join-qr-dialog")).toBeVisible();
    await expect(
      page.getByText("Tillad kameraet for at scanne lærerens QR-kode."),
    ).toBeVisible();
    await expect(page.getByTestId("join-qr-close")).toBeFocused();
    await expect
      .poll(async () => (await cameraSnapshot(page)).getUserMediaCalls)
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Tab");
    await expect(page.getByTestId("join-qr-close")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("join-qr-dialog")).toBeHidden();
    await expect(scanButton).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

    await scanButton.click();
    await expect(page.getByTestId("join-qr-dialog")).toBeVisible();
    await page.getByTestId("join-qr-close").click();
    await expect(page.getByTestId("join-qr-dialog")).toBeHidden();
  });

  test("one-tap camera start and close stop all mock tracks", async ({
    page,
  }) => {
    const scanButton = await openJoinPage(page, "granted");
    await scanButton.click();
    await expect
      .poll(async () => (await cameraSnapshot(page)).getUserMediaCalls)
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await cameraSnapshot(page)).createdTracks)
      .toBeGreaterThan(0);

    await page.getByTestId("join-qr-close").click();
    await expect(page.getByTestId("join-qr-dialog")).toBeHidden();
    await expect
      .poll(async () => (await cameraSnapshot(page)).activeTracks)
      .toBe(0);
    expect((await cameraSnapshot(page)).stopCalls).toBeGreaterThan(0);
  });

  test("a trusted join QR performs lookup and reaches the name step", async ({ page }) => {
    let lookupCount = 0;
    await page.context().route(/\/api\/join(?:\?|$)/, async (route: Route) => {
      expect(route.request().headers()["x-student-join-code"]).toBe(VALID_CODE);
      lookupCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "active",
          sessionId: SESSION_ID,
          sessionStatus: "running",
          runTitle: RUN_TITLE,
          schedule: null,
          scheduleGate: "active",
          raceType: "quiz",
        }),
      });
    });

    const scanButton = await openJoinPage(page, "pending");
    await scanButton.click();
    await startScanner(page);
    await sendQrValue(page, `http://localhost:3000/join?pin=${VALID_CODE}`);

    await expect(page.locator("#join-name")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(RUN_TITLE, { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("join-qr-dialog")).toBeHidden();
    expect(lookupCount).toBe(1);
    expect(new URL(page.url()).pathname).toBe("/join");
  });

  test("an external QR shows the exact fallback without lookup or navigation", async ({
    page,
  }) => {
    let lookupCount = 0;
    await page.context().route(/\/api\/join(?:\?|$)/, async (route: Route) => {
      lookupCount += 1;
      await route.abort();
    });

    const scanButton = await openJoinPage(page, "pending");
    await scanButton.click();
    await startScanner(page);
    await sendQrValue(page, `https://example.com/join?pin=${VALID_CODE}`);

    await expect(
      page.getByRole("alert").filter({
        hasText: "QR-koden tilhører ikke et aktivt SkoleGPS-løb.",
      }),
    ).toBeVisible();
    expect(lookupCount).toBe(0);
    expect(new URL(page.url()).pathname).toBe("/join");
  });

  test("the allowlisted Find Bedrageren entry keeps its separate join route", async ({
    page,
  }) => {
    let lookupCount = 0;
    await page.context().route(/\/api\/join(?:\?|$)/, async (route: Route) => {
      lookupCount += 1;
      await route.abort();
    });

    const scanButton = await openJoinPage(page, "pending");
    await scanButton.click();
    await startScanner(page);
    await sendQrValue(
      page,
      "http://localhost:3000/find-bedrageren/join",
    );

    await page.waitForURL("**/find-bedrageren/join", { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/find-bedrageren/join");
    expect(lookupCount).toBe(0);
  });

  test("denied camera access keeps the exact manual-code fallback visible", async ({
    page,
  }) => {
    const scanButton = await openJoinPage(page, "denied");
    await scanButton.click();

    await expect(
      page.getByRole("alert").filter({
        hasText: "Kameraet kunne ikke åbnes. Luk kameraet, og skriv koden i stedet.",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("join-qr-start")).toBeVisible();
    await expect(
      page.getByText("Du kan stadig indtaste koden manuelt på join-siden."),
    ).toBeVisible();
    expect((await cameraSnapshot(page)).getUserMediaCalls).toBe(1);
    expect(new URL(page.url()).pathname).toBe("/join");
  });
});
