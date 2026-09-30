import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const REMOVED_VIDEO_SRC = "/skolegpsforside.mp4";
const PILEN_WELCOME_VIDEO_SRC = "/brand/mascot/skolegps-pilen-welcome.mp4";

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

test.describe("public homepage", () => {
  test("wide desktop uses the non-blocking Pilen scene with a silent welcome clip", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2560, height: 912 });
    await page.goto("/");

    const scene = page.getByTestId("pilen-welcome-scene");

    await expect(scene).toBeVisible();
    await expect(page.getByTestId("pilen-welcome-video")).toHaveCount(1);
    expect(
      await page.getByTestId("pilen-welcome-video").evaluate((video) => (video as HTMLVideoElement).muted),
    ).toBe(true);
    expect(
      await page.getByTestId("pilen-welcome-video").evaluate((video) => (video as HTMLVideoElement).playsInline),
    ).toBe(true);
    await expect(page.getByTestId("pilen-welcome-video")).not.toHaveAttribute("loop", "");
    await expect(page.getByTestId("home-background-video")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Mere liv i undervisningen.", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Log ind", exact: true }).first()).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(page.getByRole("link", { name: "Find dit værktøj", exact: true })).toHaveAttribute(
      "href",
      "#vaerktojer",
    );
    await expect(page.getByRole("link", { name: "Elev? Deltag med kode", exact: true }).first()).toHaveAttribute(
      "href",
      "/join",
    );
    await expect(page.getByRole("link", { name: /Opret et løb/i })).toHaveCount(0);
    const newsBanner = page.getByRole("link", { name: /Læs vores svar/i });
    await expect(newsBanner).toHaveAttribute(
      "href",
      "/mobil-i-skolen",
    );
    await newsBanner.focus();
    await expect(newsBanner).toBeFocused();
    await expect(page.getByRole("button", { name: /Scan QR-kode/i })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /SkoleGPS-gruppen/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Det sker i SkoleGPS", exact: true })).toBeVisible();
    await expect(page.getByText(/GPS-løb, arbejdsark og værktøjer til skoledagen/i)).toBeVisible();
    await expect(page.getByTestId("home-founder-entry")).toBeVisible();
    const projectWorkshopAnnouncement = page.getByTestId("home-project-workshop");
    await expect(projectWorkshopAnnouncement).toBeVisible();
    await expect(projectWorkshopAnnouncement.getByRole("link", { name: "Se Projektværkstedet" })).toHaveAttribute(
      "href",
      "/projektvaerkstedet",
    );
    await expect(projectWorkshopAnnouncement.getByRole("link", { name: "Læs nyheden" })).toHaveAttribute(
      "href",
      "/nyheder/projektvaerkstedet",
    );
    const printpakkerAnnouncement = page.getByTestId("home-printpakker-news");
    await expect(printpakkerAnnouncement.getByRole("link", { name: "Se Printpakker" })).toHaveAttribute(
      "href",
      "/printpakker",
    );
    expect(
      await page.evaluate(() => {
        const hero = document.querySelector("h1");
        const news = document.querySelector("#nyheder");
        return Boolean(hero && news && (hero.compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING));
      }),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("link", { name: "GPS-hjælp", exact: true })).toHaveAttribute(
      "href",
      "/hjaelp",
    );
    await expect(page.getByRole("link", { name: "Facebook-side", exact: true })).toHaveAttribute(
      "href",
      "https://www.facebook.com/profile.php?id=61594705569977",
    );
    await expect(page.getByRole("link", { name: "Facebook-gruppe", exact: true })).toHaveAttribute(
      "href",
      "https://www.facebook.com/groups/1649785632764130",
    );

    await expect(page.locator(`video source[src="${REMOVED_VIDEO_SRC}"]`)).toHaveCount(0);
  });

  test("reduced motion keeps Pilen static and does not request either video", async ({ page }) => {
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if ([REMOVED_VIDEO_SRC, PILEN_WELCOME_VIDEO_SRC].includes(new URL(request.url()).pathname)) {
        videoRequests.push(request.url());
      }
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(300);

    await expect(page.getByTestId("pilen-welcome-scene")).toHaveAttribute("data-welcome-state", "static");
    await expect(page.getByTestId("pilen-welcome-video")).toHaveCount(0);
    await expect(page.getByTestId("home-background-video")).toHaveCount(0);
    expect(videoRequests).toEqual([]);
  });

  test("Pilen byder kun velkommen én gang pr. browserfane", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/hjaelp");
    await page.evaluate(() => window.sessionStorage.removeItem("skolegps.home.pilen-welcome.v1"));
    await page.goto("/");

    const scene = page.getByTestId("pilen-welcome-scene");
    await expect(scene).toHaveAttribute("data-welcome-state", "playing");
    await expect(page.getByTestId("pilen-welcome-video")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Find dit værktøj", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Elev? Deltag med kode", exact: true }).first()).toBeVisible();

    await page.getByTestId("pilen-welcome-video").evaluate((video) => {
      video.dispatchEvent(new Event("ended"));
    });
    await expect(scene).toHaveAttribute("data-welcome-state", "static");
    await expect(page.getByTestId("pilen-welcome-video")).toHaveCount(0);

    await page.reload();
    await expect(scene).toHaveAttribute("data-welcome-state", "static");
    await expect(page.getByTestId("pilen-welcome-video")).toHaveCount(0);
  });

  test("tekst og indgange fungerer, når velkomstklippet ikke kan hentes", async ({ page }) => {
    await page.route("**/brand/mascot/skolegps-pilen-welcome.mp4", (route) => route.abort());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Mere liv i undervisningen.", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Find dit værktøj", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Elev? Deltag med kode", exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("pilen-welcome-video")).toHaveCount(0);
  });

  test("teacher homepage content is present before JavaScript runs", async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/");

      await expect(
        page.getByRole("heading", { name: "Mere liv i undervisningen.", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Find dit værktøj", exact: true })).toHaveAttribute(
        "href",
        "#vaerktojer",
      );
      await expect(page.getByRole("link", { name: "Elev? Deltag med kode", exact: true }).first()).toHaveAttribute(
        "href",
        "/join",
      );
    } finally {
      await context.close();
    }
  });

  test("Postløp keeps its separate host and does not inherit the Danish campaign banner", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-host": "postlob.net" },
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/?code=");

      await expect(
        page.getByRole("heading", {
          name: "Lag aktive læringsløp på få minutter",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByText("Regeringens mobiludmelding", { exact: true })).toHaveCount(0);
      await expect(page.getByText(/Planlæg, start og behold overblikket/i)).toBeVisible();
      await expect(page.getByRole("link", { name: "Bli med i løp", exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("mobile root preserves the student entry redirect without requesting desktop video", async ({
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
      if ([REMOVED_VIDEO_SRC, PILEN_WELCOME_VIDEO_SRC].includes(new URL(request.url()).pathname)) {
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

  test("iPadOS desktop-style user agent preserves the student entry redirect", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 834, height: 1112 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();

    try {
      await page.goto("/");
      await expect(page).toHaveURL(/\/join$/);
      await expect(page.getByTestId("pilen-welcome-scene")).toHaveCount(0);
      await expect(page.locator(`video source[src="${PILEN_WELCOME_VIDEO_SRC}"]`)).toHaveCount(0);
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

  test("the footer GPS guide preserves the student’s existing team and progress", async ({ page }) => {
    await page.goto("/hjaelp");

    await expect(
      page.getByRole("heading", { name: "GPS-hjælp, når placeringen mangler" }),
    ).toBeVisible();
    await expect(page.getByText(/Hold og fremdrift bliver bevaret/i)).toBeVisible();
    await expect(page.getByText(/ikke eleven rydde browserdata/i)).toBeVisible();
  });

  test("student routes do not reference or mount homepage videos", async ({
    page,
  }) => {
    const studentFiles = [
      ...collectTypeScriptFiles("app/join"),
      ...collectTypeScriptFiles("app/play"),
      ...collectTypeScriptFiles("components/play"),
    ];

    for (const studentFile of studentFiles) {
      const source = readSource(studentFile);
      expect(source, `${studentFile} must not load the retired homepage video`).not.toContain(REMOVED_VIDEO_SRC);
      expect(source, `${studentFile} must not load the Pilen welcome video`).not.toContain(PILEN_WELCOME_VIDEO_SRC);
    }

    await page.goto("/join");
    await expect(page.locator(`video source[src="${REMOVED_VIDEO_SRC}"]`)).toHaveCount(0);
    await expect(page.locator(`video source[src="${PILEN_WELCOME_VIDEO_SRC}"]`)).toHaveCount(0);
  });

  test("homepage videos remain outside PWA precache and use local Pilen assets", () => {
    const nextConfigSource = readSource("next.config.ts");
    const appPageSource = readSource("app/page.tsx");
    const homePageSource = readSource("components/HomePageClient.tsx");
    const teacherHomeSource = readSource("components/home/TeacherHomepage.tsx");
    const mascotSource = readSource("components/brand/Mascot.tsx");
    const logoSource = readSource("public/skolegps-logo.svg");
    const publicExcludes = nextConfigSource.match(
      /\bpublicExcludes\s*:\s*\[([\s\S]*?)\]/,
    )?.[1];

    expect(publicExcludes).toMatch(/["'`]!\*\*\/\*["'`]/);
    expect(nextConfigSource).not.toContain(REMOVED_VIDEO_SRC);
    expect(homePageSource).not.toContain(REMOVED_VIDEO_SRC);
    expect(teacherHomeSource).not.toContain(REMOVED_VIDEO_SRC);
    expect(teacherHomeSource).toContain("PilenWelcomeScene");
    expect(teacherHomeSource).toContain(PILEN_WELCOME_VIDEO_SRC);
    expect(teacherHomeSource).not.toContain("<Mascot");
    expect(teacherHomeSource).not.toContain("<RoutePath");
    expect(mascotSource).toContain('/brand/mascot/skolegps-pin.webp');
    expect(appPageSource).toContain("<TeacherHomepage />");
    expect(appPageSource).toContain("isMobileBrowser");
    expect(homePageSource).not.toContain("FacebookGroupModal");
    expect(homePageSource).not.toContain("skolegps-facebook-group");
    expect(logoSource).toContain("route arrow");

    for (const serviceWorkerPath of ["public/sw.js", "public/swe-worker-development.js"]) {
      if (existsSync(join(ROOT, serviceWorkerPath))) {
        expect(
          readSource(serviceWorkerPath),
          `${serviceWorkerPath} must not precache homepage videos`,
        ).not.toContain(REMOVED_VIDEO_SRC);
        expect(readSource(serviceWorkerPath)).not.toContain(PILEN_WELCOME_VIDEO_SRC);
      }
    }
  });
});
