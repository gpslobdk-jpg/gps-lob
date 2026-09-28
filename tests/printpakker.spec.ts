import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  getPrintpakkeFilterOptions,
  PRINTPAKKER,
} from "../lib/printpakker/catalog";
import { hasPrintpakkeDownloadSession } from "../lib/printpakker/access";
import {
  buildPrintpakkeDownloadHref,
  buildPrintpakkeLoginReturnPath,
  PRINTPAKKE_DOWNLOAD_VARIANTS,
} from "../lib/printpakker/links";
import {
  createTeacherToolRegistry,
  TEACHER_TOOL_FALLBACK_ORIGINS,
} from "../lib/teacherTools/registry";

const root = process.cwd();
const originalPackageSlug = "efteraarsmysteriet";

const protectedAssetNames = {
  efteraarsmysteriet: "SkoleGPS_Efteraarsmysteriet",
  "kystbyens-forsyningsplan": "SkoleGPS_Kystbyens_forsyningsplan",
  "det-sidste-program": "SkoleGPS_Det_sidste_program",
  "the-pop-up-bookshop": "SkoleGPS_The_pop_up_bookshop",
  "regnhavens-laboratorium": "SkoleGPS_Regnhavens_laboratorium",
  "kufferten-fra-kobstaden": "SkoleGPS_Kufferten_fra_kobstaden",
} as const;

const protectedAssetSuffixes = [
  "hele_pakken_farve",
  "hele_pakken_blaekbesparende",
  "elevark",
  "facit",
  "laerervejledning",
] as const;

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

test.describe("Printpakker catalogue contracts", () => {
  test("catalogues six complete packages across five subjects and exposes their real categories", () => {
    expect(PRINTPAKKER).toHaveLength(6);
    expect(PRINTPAKKER.map(({ slug }) => slug)).toEqual([
      "efteraarsmysteriet",
      "kystbyens-forsyningsplan",
      "det-sidste-program",
      "the-pop-up-bookshop",
      "regnhavens-laboratorium",
      "kufferten-fra-kobstaden",
    ]);

    expect(getPrintpakkeFilterOptions(PRINTPAKKER)).toEqual({
      subjects: ["Matematik", "Dansk", "Engelsk", "Natur/teknologi", "Historie"],
      gradeLevels: ["5.-6. klasse", "5.-7. klasse"],
      activityTypes: ["Makkerløb ved bordene", "Fysisk postløb"],
    });

    for (const printpakke of PRINTPAKKER) {
      expect(printpakke.stationCount).toBe(6);
      expect(printpakke.phases).toHaveLength(3);
      // Efterårsmysteriet predates the new slug convention and keeps its
      // established public filename.  Every package must nevertheless expose
      // a concrete, facit-free preview PDF from the public Printpakker area.
      expect(printpakke.publicPreview).toMatch(/^\/printpakker\/[a-z0-9-]+-forhaandsvisning\.pdf$/);
      expect(printpakke.previewImages).toHaveLength(2);
      expect(printpakke.curriculumHref).toMatch(/^https:\/\/uvm\.dk\//);
      expect(printpakke.curriculumNote).toMatch(/kompetenc/i);
      for (const variant of PRINTPAKKE_DOWNLOAD_VARIANTS) {
        expect(buildPrintpakkeDownloadHref(printpakke.slug, variant))
          .toBe(`/api/printpakker/${printpakke.slug}/${variant}`);
      }
    }

    expect(buildPrintpakkeLoginReturnPath(originalPackageSlug, "answer-key"))
      .toBe("/dashboard/laerervaerktoejer/printpakker?download=answer-key&slug=efteraarsmysteriet");
  });

  test("keeps every completed teacher PDF protected and every preview explicitly facit-free", () => {
    const publicDirectory = join(root, "public", "printpakker");
    const publicFiles = listFiles(publicDirectory).map((path) => path.slice(publicDirectory.length + 1));

    expect(publicFiles.some((file) => /facit|laerervejledning|hele_pakken/i.test(file))).toBe(false);

    for (const printpakke of PRINTPAKKER) {
      expect(existsSync(join(root, "public", printpakke.publicPreview))).toBe(true);
      for (const previewImage of printpakke.previewImages) {
        expect(existsSync(join(root, "public", previewImage))).toBe(true);
      }

      const assetStem = protectedAssetNames[printpakke.slug as keyof typeof protectedAssetNames];
      expect(assetStem, `Protected asset stem missing for ${printpakke.slug}`).toBeTruthy();
      for (const suffix of protectedAssetSuffixes) {
        expect(existsSync(join(
          root,
          "assets",
          "printpakker",
          printpakke.slug,
          `${assetStem}_${suffix}.pdf`,
        ))).toBe(true);
      }
    }
  });

  test("rejects an anonymous student session for protected downloads", () => {
    expect(hasPrintpakkeDownloadSession(null)).toBe(false);
    expect(hasPrintpakkeDownloadSession({ is_anonymous: true })).toBe(false);
    expect(hasPrintpakkeDownloadSession({ is_anonymous: false })).toBe(true);
  });

  test("keeps Printpakker separate from the existing PrintMit destination", () => {
    const tools = createTeacherToolRegistry(TEACHER_TOOL_FALLBACK_ORIGINS);
    expect(tools.find((tool) => tool.id === "printpakker")).toMatchObject({
      link: { href: "/printpakker", kind: "internal", target: "_self" },
      status: "active",
      title: "Printpakker",
    });
    expect(tools.find((tool) => tool.id === "printmit-arbejdsark")).toMatchObject({
      link: { href: expect.stringContaining("printmitarbejdsark.dk/auth/family-sso/start") },
    });
  });

  test("keeps public catalogue sources free of answer and teacher-only phrases", () => {
    const publicSources = [
      "app/printpakker/page.tsx",
      "app/printpakker/[slug]/page.tsx",
      "components/printpakker/PrintpakkerCatalog.tsx",
      "lib/printpakker/catalog.ts",
    ].map((file) => readFileSync(join(root, file), "utf8")).join("\n");

    for (const privatePhrase of ["Sporbrik til holdet", "RØDE KURV", "Korrekt svar:"]) {
      expect(publicSources).not.toContain(privatePhrase);
    }
  });
});

test.describe("Printpakker browser journey", () => {
  test("renders all six packages, filters by the real categories, and keeps quick actions keyboard-safe", async ({ page }) => {
    await page.goto("/printpakker");
    await expect(page.getByRole("heading", { name: /færdige pakker/i })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(PRINTPAKKER.length);

    for (const { title } of PRINTPAKKER) {
      await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
    }

    await page.getByLabel("Fag").selectOption("Engelsk");
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "The Pop-up Bookshop", exact: true })).toBeVisible();

    await page.getByLabel("Fag").selectOption("");
    await page.getByLabel("Aktivitet").selectOption("Fysisk postløb");
    await expect(page.locator("article")).toHaveCount(5);
    await page.getByLabel("Aktivitet").selectOption("");
    await page.getByLabel("Klassetrin").selectOption("5.-7. klasse");
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "The Pop-up Bookshop", exact: true })).toBeVisible();
    await page.getByLabel("Klassetrin").selectOption("");

    const selectedPackage = PRINTPAKKER.find(({ slug }) => slug === "kystbyens-forsyningsplan");
    expect(selectedPackage).toBeDefined();
    const selectedCard = page.locator("article").filter({
      has: page.getByRole("link", { name: selectedPackage!.title, exact: true }),
    });
    const menuButton = selectedCard.getByRole("button", { name: "Materialer" });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    for (const [label, variant] of [
      ["Hele pakken", "whole-colour"],
      ["Elevark", "student"],
      ["Facit", "answer-key"],
      ["Lærervejledning", "teacher-guide"],
    ] as const) {
      await expect(selectedCard.getByRole("link", { name: label, exact: true }))
        .toHaveAttribute("href", buildPrintpakkeDownloadHref(selectedPackage!.slug, variant));
    }
    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await page.getByPlaceholder("Søg efter fag, klassetrin eller aktivitet").fill("ingen-sadan-pakke");
    await expect(page.getByText("Ingen pakker matcher lige nu.")).toBeVisible();
  });

  test("shows a facit-free public preview for every package", async ({ page }) => {
    for (const printpakke of PRINTPAKKER) {
      await page.goto(`/printpakker/${printpakke.slug}`);
      await expect(page.getByRole("heading", { name: printpakke.title, exact: true })).toBeVisible();
      await expect(page.getByText("Facitfri forhaandsvisning")).toBeVisible();
      await expect(page.getByRole("link", { name: /åbn facitfri forhåndsvisning/i }))
        .toHaveAttribute("href", printpakke.publicPreview);

      const preview = await page.request.get(printpakke.publicPreview);
      expect(preview.status(), printpakke.slug).toBe(200);
      expect(preview.headers()["content-type"], printpakke.slug).toContain("application/pdf");
      expect((await preview.body()).subarray(0, 5).toString(), printpakke.slug).toBe("%PDF-");
    }
  });

  test("keeps every known PDF variant behind the existing teacher-login boundary without leaking a PDF", async ({ page }) => {
    for (const printpakke of PRINTPAKKER) {
      for (const variant of PRINTPAKKE_DOWNLOAD_VARIANTS) {
        const response = await page.request.get(buildPrintpakkeDownloadHref(printpakke.slug, variant), {
          maxRedirects: 0,
        });
        expect(response.status(), `${printpakke.slug}/${variant}`).toBe(307);
        expect(response.headers()["cache-control"], `${printpakke.slug}/${variant}`).toContain("private, no-store");
        expect(response.headers()["x-content-type-options"], `${printpakke.slug}/${variant}`).toBe("nosniff");
        expect(response.headers()["x-robots-tag"], `${printpakke.slug}/${variant}`).toContain("noindex");
        expect(response.headers()["content-disposition"], `${printpakke.slug}/${variant}`).toBeUndefined();
        expect(response.headers()["content-type"] ?? "", `${printpakke.slug}/${variant}`).not.toContain("application/pdf");
        expect((await response.body()).subarray(0, 5).toString(), `${printpakke.slug}/${variant}`).not.toBe("%PDF-");

        const location = response.headers().location;
        expect(location, `${printpakke.slug}/${variant}`).toContain("/login?next=%2Fdashboard%2Flaerervaerktoejer%2Fprintpakker");
        const next = new URL(location!, "http://localhost").searchParams.get("next");
        expect(next, `${printpakke.slug}/${variant}`).toBe(buildPrintpakkeLoginReturnPath(printpakke.slug, variant));
      }
    }
  });

  test("returns a private 404 without a PDF for unknown package and variant URLs", async ({ page }) => {
    for (const path of [
      "/api/printpakker/findes-ikke/student",
      `/api/printpakker/${originalPackageSlug}/findes-ikke`,
    ]) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      expect(response.headers()["cache-control"], path).toContain("private, no-store");
      expect(response.headers()["content-type"] ?? "", path).not.toContain("application/pdf");
      expect((await response.body()).subarray(0, 5).toString(), path).not.toBe("%PDF-");
    }

    const response = await page.goto("/printpakker/findes-ikke");
    expect(response?.status()).toBe(404);
  });

  test("keeps the catalogue usable at required viewport widths and honors reduced motion", async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/printpakker", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /færdige pakker/i })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${width}px should not overflow horizontally`).toBe(false);
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/printpakker", { waitUntil: "domcontentloaded" });
    const transitionDuration = await page.locator("article").first().evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(transitionDuration).toBe("0s");
  });
});
