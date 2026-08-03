import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const VIDEO_SRC = "/skolegpsforside.mp4";
const FALLBACK_SRC = "/intro-poster.jpg";

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function collectTypeScriptFiles(relativeDirectory: string): string[] {
  const absoluteDirectory = join(ROOT, relativeDirectory);

  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      return collectTypeScriptFiles(relativePath);
    }

    return /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
}

test.describe("public homepage background video", () => {
  test("wide desktop keeps the top of the original muted autoplay loop visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2560, height: 912 });
    await page.goto("/");

    const fallback = page.getByTestId("home-static-background");
    const video = page.getByTestId("home-background-video");

    await expect(fallback).toHaveCount(1);
    await expect(fallback).toHaveClass(/bg-\[url\('\/intro-poster\.jpg'\)\]/);
    await expect(fallback).toHaveClass(/bg-right-top/);
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("src", VIDEO_SRC);
    await expect(video).toHaveClass(/object-cover/);
    await expect(video).toHaveClass(/object-right-top/);

    const playbackContract = await video.evaluate((element: HTMLVideoElement) => ({
      autoplay: element.autoplay,
      muted: element.muted,
      loop: element.loop,
      playsInline: element.playsInline,
      objectFit: window.getComputedStyle(element).objectFit,
      objectPosition: window.getComputedStyle(element).objectPosition,
    }));

    expect(playbackContract).toEqual({
      autoplay: true,
      muted: true,
      loop: true,
      playsInline: true,
      objectFit: "cover",
      objectPosition: "100% 0%",
    });
  });

  test("reduced motion keeps the fallback and does not request the video", async ({ page }) => {
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === VIDEO_SRC) {
        videoRequests.push(request.url());
      }
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(300);

    await expect(page.getByTestId("home-static-background")).toHaveCount(1);
    await expect(page.getByTestId("home-background-video")).toHaveCount(0);
    expect(videoRequests).toEqual([]);
  });

  test("mobile layout keeps the fallback without requesting the desktop video", async ({
    page,
  }) => {
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === VIDEO_SRC) {
        videoRequests.push(request.url());
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForTimeout(300);

    await expect(page.getByTestId("home-static-background")).toHaveCount(1);
    await expect(page.getByTestId("home-background-video")).toHaveCount(0);
    expect(videoRequests).toEqual([]);
  });

  test("student routes do not reference or mount the homepage background video", async ({
    page,
  }) => {
    const studentFiles = [
      ...collectTypeScriptFiles("app/join"),
      ...collectTypeScriptFiles("app/play"),
      ...collectTypeScriptFiles("components/play"),
    ];

    for (const studentFile of studentFiles) {
      expect(readSource(studentFile), `${studentFile} must not load the homepage video`).not.toContain(
        VIDEO_SRC,
      );
    }

    await page.goto("/join");
    await expect(page.locator(`video[src="${VIDEO_SRC}"]`)).toHaveCount(0);
  });

  test("video remains outside PWA precache and standalone mode is gated", () => {
    const nextConfigSource = readSource("next.config.ts");
    const homePageSource = readSource("components/HomePageClient.tsx");
    const publicExcludes = nextConfigSource.match(
      /\bpublicExcludes\s*:\s*\[([\s\S]*?)\]/,
    )?.[1];

    expect(publicExcludes).toMatch(/["'`]!\*\*\/\*["'`]/);
    expect(nextConfigSource).not.toContain(VIDEO_SRC);
    expect(homePageSource).toContain(FALLBACK_SRC);
    expect(homePageSource).toContain("(display-mode: standalone)");
    expect(homePageSource).toContain("standalone?: boolean");

    for (const serviceWorkerPath of ["public/sw.js", "public/swe-worker-development.js"]) {
      if (existsSync(join(ROOT, serviceWorkerPath))) {
        expect(
          readSource(serviceWorkerPath),
          `${serviceWorkerPath} must not precache ${VIDEO_SRC}`,
        ).not.toContain(VIDEO_SRC);
      }
    }
  });
});
