import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sanitizeSentryEvent } from "../lib/observability/privacy";

const ROOT = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function countMatches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].length;
}

type DeclaredIcon = {
  src: string;
  sizes: string;
  type: string;
};

function readDeclaredIcons(manifestSource: string): DeclaredIcon[] {
  const iconsSection = manifestSource.match(/\bicons\s*:\s*\[([\s\S]*?)\]\s*,/);
  expect(iconsSection, "The web manifest must declare at least one icon").not.toBeNull();

  const icons: DeclaredIcon[] = [];
  const iconObjectPattern = /\{([\s\S]*?)\}/g;

  for (const match of iconsSection?.[1].matchAll(iconObjectPattern) ?? []) {
    const block = match[1];
    const src = block.match(/\bsrc\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
    const sizes = block.match(/\bsizes\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
    const type = block.match(/\btype\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];

    if (src && sizes && type) {
      icons.push({ src, sizes, type });
    }
  }

  return icons;
}

function readPngDimensions(path: string) {
  const png = readFileSync(path);

  expect(png.length, `${path} must contain a complete PNG header`).toBeGreaterThanOrEqual(24);
  expect(png.subarray(0, 8).toString("hex"), `${path} must be a PNG file`).toBe(
    "89504e470d0a1a0a",
  );
  expect(png.subarray(12, 16).toString("ascii"), `${path} must begin with an IHDR chunk`).toBe(
    "IHDR",
  );

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

function hasLocalReducedMotionGuard(source: string, animationClass: string) {
  const escapedClass = animationClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const classBeforeGuard = new RegExp(
    String.raw`className\s*=\s*["'\`][^"'\`]*\b${escapedClass}\b[^"'\`]*\bmotion-reduce:animate-none\b`,
  );
  const guardBeforeClass = new RegExp(
    String.raw`className\s*=\s*["'\`][^"'\`]*\bmotion-reduce:animate-none\b[^"'\`]*\b${escapedClass}\b`,
  );

  return classBeforeGuard.test(source) || guardBeforeClass.test(source);
}

function hasGlobalReducedMotionGuard(globalCss: string, animationClass: string) {
  const escapedClass = animationClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reducedMotionRule = String.raw`@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)`;
  const selector =
    String.raw`(?:\.${escapedClass}\b|\[class\*=["']animate-["']\]|\*)`;
  const animationDisabled =
    String.raw`(?:animation\s*:\s*none|animation-duration\s*:\s*(?:0|0\.0*1)(?:ms|s))`;

  return new RegExp(
    `${reducedMotionRule}[\\s\\S]{0,2500}${selector}[\\s\\S]{0,600}${animationDisabled}`,
    "i",
  ).test(globalCss);
}

test.describe("student PWA source contracts", () => {
  test("manifest starts at the public home screen and declares standalone display", () => {
    const manifestSource = readSource("app/manifest.ts");

    expect(manifestSource).toMatch(/\bstart_url\s*:\s*["'`]\/["'`]/);
    expect(manifestSource).toMatch(/\bdisplay\s*:\s*["'`]standalone["'`]/);
  });

  test("every declared PNG icon exists and matches its declared dimensions", () => {
    const manifestSource = readSource("app/manifest.ts");
    const icons = readDeclaredIcons(manifestSource);

    expect(icons.length).toBeGreaterThan(0);

    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.src.startsWith("/"), `${icon.src} must be a root-relative public asset`).toBe(
        true,
      );

      const iconPath = join(ROOT, "public", icon.src.replace(/^\/+/, ""));
      expect(existsSync(iconPath), `Manifest icon is missing: ${icon.src}`).toBe(true);

      const actual = readPngDimensions(iconPath);
      const declaredSizes = icon.sizes.trim().split(/\s+/);

      expect(declaredSizes.length).toBeGreaterThan(0);
      for (const declaredSize of declaredSizes) {
        expect(declaredSize, `${icon.src} must declare numeric PNG dimensions`).toMatch(
          /^\d+x\d+$/,
        );
        const [width, height] = declaredSize.split("x").map(Number);
        expect(
          actual,
          `${icon.src} is ${actual.width}x${actual.height}, not ${declaredSize}`,
        ).toEqual({ width, height });
      }
    }
  });

  test("next-pwa excludes public assets from precache but keeps student routes NetworkOnly", () => {
    const nextConfigSource = readSource("next.config.ts");
    const publicExcludes = nextConfigSource.match(
      /\bpublicExcludes\s*:\s*\[([\s\S]*?)\]/,
    )?.[1];

    expect(
      publicExcludes,
      "next-pwa must explicitly exclude public assets from precache",
    ).toBeDefined();
    expect(publicExcludes).toMatch(/["'`]!\*\*\/\*["'`]/);

    const networkOnlyRules = [
      ...nextConfigSource.matchAll(
        /\{\s*urlPattern\s*:[\s\S]*?\bhandler\s*:\s*["'`]NetworkOnly["'`][\s\S]*?\},/g,
      ),
    ]
      .map((match) => match[0])
      .filter(
        (rule) =>
          /url\.pathname\s*===\s*["'`]\/join["'`]/.test(rule) &&
          /url\.pathname\.startsWith\(\s*["'`]\/play\/["'`]\s*\)/.test(rule),
      );

    expect(
      networkOnlyRules.length,
      "Both the RSC and document requests for /join and /play/* must remain NetworkOnly",
    ).toBeGreaterThanOrEqual(2);
  });

  test("execution-share landing requests stay NetworkOnly", () => {
    const nextConfigSource = readSource("next.config.ts");
    const shareNetworkOnlyRules = [
      ...nextConfigSource.matchAll(
        /\{\s*urlPattern\s*:[\s\S]*?\bhandler\s*:\s*["'`]NetworkOnly["'`][\s\S]*?\},/g,
      ),
    ]
      .map((match) => match[0])
      .filter((rule) =>
        /url\.pathname\s*===\s*["'`]\/del\/afvikling["'`]/.test(rule)
      );

    expect(shareNetworkOnlyRules.length).toBeGreaterThanOrEqual(2);
  });

  test("the public homepage exposes a /join CTA in both mobile and desktop layouts", () => {
    const homePageSource = readSource("components/HomePageClient.tsx");
    const mobileLayout = homePageSource.match(
      /<main\b[^>]*className=["'][^"']*\bmd:hidden\b[^"']*["'][^>]*>[\s\S]*?<\/main>/,
    )?.[0];
    const desktopLayout = homePageSource.match(
      /<main\b[^>]*className=["'][^"']*\bhidden\b[^"']*\bmd:flex\b[^"']*["'][^>]*>[\s\S]*?<\/main>/,
    )?.[0];

    expect(mobileLayout, "The public homepage must retain its mobile layout").toBeDefined();
    expect(desktopLayout, "The public homepage must retain its desktop layout").toBeDefined();
    expect(mobileLayout).toMatch(/\bhref\s*=\s*["'`]\/join["'`]/);
    expect(desktopLayout).toMatch(/\bhref\s*=\s*["'`]\/join["'`]/);
  });

  test("a supported offline fallback page exists", () => {
    const supportedFallbacks = [
      "app/~offline/page.tsx",
      "pages/_offline.tsx",
      "pages/_offline.jsx",
      "pages/_offline.js",
    ];
    const fallbackPath = supportedFallbacks.find((candidate) =>
      existsSync(join(ROOT, candidate)),
    );

    expect(
      fallbackPath,
      "Add app/~offline/page.tsx (or a supported pages/_offline file) for next-pwa",
    ).toBeDefined();

    const fallbackSource = readSource(fallbackPath!);
    expect(fallbackSource).toMatch(/\bexport\s+default\b/);
    expect(fallbackSource).toMatch(/offline|forbindelse|internet|netværk/i);
  });

  test("student-facing animation utilities have a reduced-motion CSS guard", () => {
    const globalCss = readSource("app/globals.css");
    const homePageSource = readSource("components/HomePageClient.tsx");
    const studentSources = [
      readSource("app/join/page.tsx"),
      readSource("components/QRScannerModal.tsx"),
    ];

    expect(globalCss).toMatch(
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/,
    );
    expect(homePageSource).toMatch(/useReducedMotion|prefers-reduced-motion\s*:\s*reduce/);

    for (const source of studentSources) {
      const animationClasses = new Set(
        [...source.matchAll(/\b(animate-(?:spin|pulse|ping|bounce))\b/g)].map(
          (match) => match[1],
        ),
      );

      for (const animationClass of animationClasses) {
        expect(
          hasLocalReducedMotionGuard(source, animationClass) ||
            hasGlobalReducedMotionGuard(globalCss, animationClass),
          `${animationClass} must stop when prefers-reduced-motion is enabled`,
        ).toBe(true);
      }
    }

    expect(
      countMatches(globalCss, /prefers-reduced-motion\s*:\s*reduce/g),
    ).toBeGreaterThan(0);
  });

  test("student observability strips join queries and participant identifiers", () => {
    const joinSource = readSource("app/join/page.tsx");
    const joinApiSource = readSource("app/api/join/route.ts");
    const sentrySource = readSource("instrumentation-client.ts");
    const telemetrySource = readSource("utils/telemetry.ts");

    expect(joinSource).not.toMatch(/\/api\/join\?pin=/);
    expect(joinSource).toMatch(/X-Student-Join-Code/);
    expect(joinApiSource).toMatch(/x-student-join-code/);
    expect(sentrySource).toMatch(/\bbeforeBreadcrumb\s*\(/);
    expect(sentrySource).toMatch(/\bbeforeAddRecordingEvent\s*\(/);
    expect(sentrySource).toMatch(/\bmaskAllInputs\s*:\s*true/);
    expect(telemetrySource).toMatch(/\bparticipant_id\s*:\s*null/);
    expect(telemetrySource).toMatch(/\bsession_id\s*:\s*null/);
  });

  test("the Sentry scrubber removes sensitive data from full events", () => {
    const sessionId = "11111111-2222-4333-8444-555555555555";
    const participantId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const joinCode = "ABCDEF";
    const authToken = "very-secret-auth-token";
    const studentName = "Asta Elev";
    const teamName = "Hold Blå";

    const sanitized = sanitizeSentryEvent({
      request: {
        url: `https://gpslob.dk/play/${sessionId}?pin=${joinCode}#answer`,
        query_string: `pin=${joinCode}`,
        headers: {
          Referer: `https://gpslob.dk/join?pin=${joinCode}`,
          "X-Student-Join-Code": joinCode,
          Authorization: `Bearer ${authToken}`,
          Cookie: `participant=${participantId}`,
          "User-Agent": "Privacy contract test",
        },
        data: JSON.stringify({
          studentName,
          teamName,
          sessionId,
          participantId,
          answer: "København",
          lat: 55.6761,
          lng: 12.5683,
        }),
      },
      user: {
        id: participantId,
        name: studentName,
      },
      message: `participant_id=${participantId} session_code=${joinCode} auth_token=${authToken}`,
      logentry: {
        formatted: `QR content: https://gpslob.dk/join?pin=${joinCode}`,
      },
      exception: {
        values: [
          {
            type: "Error",
            value: `student_name="${studentName}" participant_id=${participantId}`,
          },
        ],
      },
      breadcrumbs: [
        {
          data: {
            teamName,
            answer: "København",
            coordinates: { lat: 55.6761, lng: 12.5683 },
          },
        },
      ],
    });

    expect(sanitized).not.toBeNull();
    if (!sanitized) {
      throw new Error("Expected the privacy-safe Sentry event to be retained");
    }

    const serialized = JSON.stringify(sanitized);

    for (const secret of [
      sessionId,
      participantId,
      joinCode,
      authToken,
      studentName,
      teamName,
      "København",
      "55.6761",
      "12.5683",
    ]) {
      expect(serialized).not.toContain(secret);
    }

    expect(sanitized.user).toBeUndefined();
    expect(sanitized.request.query_string).toBeUndefined();
    expect(sanitized.request.data).toBeUndefined();
    expect(sanitized.request.headers).toBeUndefined();
    expect(sanitized.request.url).not.toContain("?");
  });
});
