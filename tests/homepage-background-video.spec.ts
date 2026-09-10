import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const REMOVED_VIDEO_SRC = "/skolegpsforside.mp4";
const HERO_SRC = "/brand/heroes/adventure-hero.webp";
const HERO_MOBILE_SRC = "/brand/heroes/adventure-hero-mobile.webp";

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

test.describe("public homepage scenic background", () => {
  test("wide desktop uses the static SkoleGPS hero asset without mounting a video", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2560, height: 912 });
    await page.goto("/");

    const background = page.getByTestId("home-static-background");

    await expect(background).toHaveCount(1);
    await expect(page.getByTestId("home-background-video")).toHaveCount(0);
    await expect(background.locator('img[src*="adventure-hero.webp"]')).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Få undervisningen ud at gå", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Opret et løb/i }).first()).toHaveAttribute(
      "href",
      "/login?next=%2Fdashboard%2Fopret%2Fvalg",
    );
    await expect(page.getByRole("link", { name: /Deltag i et løb som elev/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Læs debatten/i })).toHaveAttribute(
      "href",
      "/mobil-i-skolen",
    );
    await expect(page.getByRole("button", { name: /Scan QR-kode/i })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /SkoleGPS-gruppen/i })).toHaveCount(0);
    await expect(page.getByText(/Planlæg, start og behold overblikket/i)).toBeVisible();

    await expect(page.locator(`video[src="${REMOVED_VIDEO_SRC}"]`)).toHaveCount(0);
  });

  test("reduced motion keeps the static background and does not request the old video", async ({ page }) => {
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === REMOVED_VIDEO_SRC) {
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

  test("mobile root preserves the student entry redirect without requesting the desktop video", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === REMOVED_VIDEO_SRC) {
        videoRequests.push(request.url());
      }
    });

    try {
      await page.goto("/");
      await page.waitForTimeout(300);

      await expect(page).toHaveURL(/\/join$/);
      await expect(page.getByTestId("home-background-video")).toHaveCount(0);
      expect(videoRequests).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("the school-and-screen page states the legal status cautiously and links primary sources", async ({
    page,
  }) => {
    await page.goto("/mobil-i-skolen");

    await expect(
      page.getByRole("heading", {
        name: "Mobilfri skole — med plads til en voksenstyret læringsaktivitet",
      })
    ).toBeVisible();
    await expect(page.getByText(/L 130 fra samlingen 2025-26 som/i)).toBeVisible();
    await expect(page.getByText(/ikke juridisk rådgivning/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Undervisningsministeriet: Anbefalinger om skærmbrug/i })
    ).toHaveAttribute("href", /uvm\.dk/);
    await expect(page.getByRole("link", { name: /Folketinget: L 130/i })).toHaveAttribute(
      "href",
      /ft\.dk/,
    );
  });

  test("student routes do not reference or mount the removed homepage video", async ({
    page,
  }) => {
    const studentFiles = [
      ...collectTypeScriptFiles("app/join"),
      ...collectTypeScriptFiles("app/play"),
      ...collectTypeScriptFiles("components/play"),
    ];

    for (const studentFile of studentFiles) {
      expect(readSource(studentFile), `${studentFile} must not load the removed homepage video`).not.toContain(
        REMOVED_VIDEO_SRC,
      );
    }

    await page.goto("/join");
    await expect(page.locator(`video[src="${REMOVED_VIDEO_SRC}"]`)).toHaveCount(0);
  });

  test("old video remains outside PWA precache and the homepage uses optimized brand assets", () => {
    const nextConfigSource = readSource("next.config.ts");
    const homePageSource = readSource("components/HomePageClient.tsx");
    const logoSource = readSource("public/skolegps-logo.svg");
    const publicExcludes = nextConfigSource.match(
      /\bpublicExcludes\s*:\s*\[([\s\S]*?)\]/,
    )?.[1];

    expect(publicExcludes).toMatch(/["'`]!\*\*\/\*["'`]/);
    expect(nextConfigSource).not.toContain(REMOVED_VIDEO_SRC);
    expect(homePageSource).toContain(HERO_SRC);
    expect(homePageSource).toContain(HERO_MOBILE_SRC);
    expect(homePageSource).toContain("skolegps-scenic-drift");
    expect(homePageSource).toContain("skolegps-route-drift");
    expect(homePageSource).not.toContain(REMOVED_VIDEO_SRC);
    expect(homePageSource).not.toContain("FacebookGroupModal");
    expect(homePageSource).not.toContain("skolegps-facebook-group");
    expect(logoSource).toContain("route arrow");

    for (const serviceWorkerPath of ["public/sw.js", "public/swe-worker-development.js"]) {
      if (existsSync(join(ROOT, serviceWorkerPath))) {
        expect(
          readSource(serviceWorkerPath),
          `${serviceWorkerPath} must not precache ${REMOVED_VIDEO_SRC}`,
        ).not.toContain(REMOVED_VIDEO_SRC);
      }
    }
  });
});
