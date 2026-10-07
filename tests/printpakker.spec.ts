import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { hasPrintpakkeDownloadSession } from "../lib/printpakker/access";
import {
  getPrintpakkeFilterOptions,
  PRINTPAKKER,
} from "../lib/printpakker/catalog";
import {
  buildPrintpakkeDownloadHref,
  buildPrintpakkeLoginReturnPath,
} from "../lib/printpakker/links";
import {
  getCardDownloadActions,
  getPrintmaterialFilterOptions,
  PRINTMATERIALS,
  type Printmaterial,
} from "../lib/printpakker/materials";
import {
  createTeacherToolRegistry,
  TEACHER_TOOL_FALLBACK_ORIGINS,
} from "../lib/teacherTools/registry";

const root = process.cwd();
const originalPackageSlug = "efteraarsmysteriet";
const klassebodenPostloebSlug = "klasseboden-postloeb";
const klassebodenArbejdsarkSlug = "klasseboden-arbejdsark";

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

type KlassebodenManifest = {
  artifacts: Array<{
    materialId: string;
    pageCount: number;
    privatePath: string;
    variant: string;
  }>;
  previews: Array<{
    materialId: string;
    pageCount: number;
    publicPath: string;
  }>;
  version: string;
};

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function materialBySlug(slug: string): Printmaterial {
  const material = PRINTMATERIALS.find((candidate) => candidate.slug === slug);
  if (!material) throw new Error(`Materiale mangler i kataloget: ${slug}`);
  return material;
}

function cardDownloadHref(material: Printmaterial, cardAction: "student" | "answers" | "whole") {
  const action = getCardDownloadActions(material).find((candidate) => candidate.cardAction === cardAction);
  if (!action) throw new Error(`Korthandling mangler: ${material.slug}/${cardAction}`);
  return buildPrintpakkeDownloadHref(material.slug, action.variant);
}

test.describe("Printbibliotek catalogue contracts", () => {
  test("keeps the six legacy packages unchanged and adds two separate Klasseboden materials", () => {
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

    expect(PRINTMATERIALS).toHaveLength(8);
    expect(PRINTMATERIALS.slice(0, 6).map(({ slug }) => slug)).toEqual(PRINTPAKKER.map(({ slug }) => slug));
    expect(PRINTMATERIALS.slice(6).map(({ slug }) => slug)).toEqual([
      klassebodenPostloebSlug,
      klassebodenArbejdsarkSlug,
    ]);

    const filters = getPrintmaterialFilterOptions();
    expect(filters.subjects).toContain("Matematik");
    expect(filters.gradeLevels).toContain("2. klasse · indskoling");
    expect(filters.topics).toContain("Tal og regning · plus og minus");
    expect(filters.formats).toEqual(expect.arrayContaining(["Postløb", "Arbejdsark"]));

    for (const printpakke of PRINTPAKKER) {
      expect(printpakke.stationCount).toBe(6);
      expect(printpakke.phases).toHaveLength(3);
      expect(printpakke.publicPreview).toMatch(/^\/printpakker\/[a-z0-9-]+-forhaandsvisning\.pdf$/);
      expect(printpakke.previewImages).toHaveLength(2);
      expect(printpakke.curriculumHref).toMatch(/^https:\/\/uvm\.dk\//);
      expect(printpakke.curriculumNote).toMatch(/kompetenc/i);
    }

    for (const material of PRINTMATERIALS) {
      expect(getCardDownloadActions(material).map(({ cardAction }) => cardAction)).toEqual([
        "student",
        "answers",
        "whole",
      ]);
      expect(material.preview.publicPdfUrl).toMatch(/^\/printpakker\/.*-forhaandsvisning\.pdf$/);
      expect(material.preview.pageImageUrls).toHaveLength(2);
      for (const download of material.downloads) {
        expect(buildPrintpakkeDownloadHref(material.slug, download.variant))
          .toBe(`/api/printpakker/${material.slug}/${download.variant}`);
      }
    }

    const postloeb = materialBySlug(klassebodenPostloebSlug);
    const arbejdsark = materialBySlug(klassebodenArbejdsarkSlug);
    expect(postloeb.stationCount).toBe(6);
    expect(postloeb.downloads.map(({ variant }) => variant)).toEqual(expect.arrayContaining([
      "stations", "answer-sheet", "support", "whole-colour", "whole-ink-saver",
    ]));
    expect(arbejdsark.stationCount).toBeUndefined();
    expect(arbejdsark.downloads.map(({ variant }) => variant)).not.toContain("stations");

    expect(buildPrintpakkeLoginReturnPath(originalPackageSlug, "answer-key"))
      .toBe("/dashboard/laerervaerktoejer/printpakker?download=answer-key&slug=efteraarsmysteriet");
  });

  test("keeps every legacy PDF protected and registers all fixed Klasseboden artifacts", () => {
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

    const manifest = JSON.parse(readFileSync(
      join(root, "assets", "printpakker", "klasseboden-artifacts.json"),
      "utf8",
    )) as KlassebodenManifest;
    expect(manifest.version).toBe("2026-10-07.1");
    expect(manifest.artifacts).toHaveLength(22);
    expect(manifest.previews).toHaveLength(2);
    expect(manifest.artifacts.filter(({ materialId }) => materialId === klassebodenPostloebSlug)).toHaveLength(14);
    expect(manifest.artifacts.filter(({ materialId }) => materialId === klassebodenArbejdsarkSlug)).toHaveLength(8);
    expect(manifest.artifacts.find(({ materialId, variant }) => materialId === klassebodenPostloebSlug && variant === "stations")?.pageCount).toBe(6);
    expect(manifest.artifacts.find(({ materialId, variant }) => materialId === klassebodenPostloebSlug && variant === "answer-sheet")?.pageCount).toBe(2);
    expect(manifest.artifacts.find(({ materialId, variant }) => materialId === klassebodenPostloebSlug && variant === "whole-colour")?.pageCount).toBe(11);
    expect(manifest.artifacts.find(({ materialId, variant }) => materialId === klassebodenArbejdsarkSlug && variant === "whole-colour")?.pageCount).toBe(4);
    for (const artifact of manifest.artifacts) {
      expect(existsSync(join(root, artifact.privatePath)), artifact.privatePath).toBe(true);
      expect(artifact.privatePath.startsWith("public/")).toBe(false);
    }
    for (const preview of manifest.previews) {
      expect(existsSync(join(root, preview.publicPath)), preview.publicPath).toBe(true);
      expect(preview.pageCount).toBe(2);
    }
  });

  test("rejects anonymous and anonymous-like sessions for protected downloads", () => {
    expect(hasPrintpakkeDownloadSession(null)).toBe(false);
    expect(hasPrintpakkeDownloadSession({ is_anonymous: true })).toBe(false);
    expect(hasPrintpakkeDownloadSession({ is_anonymous: false })).toBe(true);
  });

  test("keeps Printbibliotek separate from the existing PrintMit destination", () => {
    const tools = createTeacherToolRegistry(TEACHER_TOOL_FALLBACK_ORIGINS);
    expect(tools.find((tool) => tool.id === "printpakker")).toMatchObject({
      link: { href: "/printpakker", kind: "internal", target: "_self" },
      status: "active",
      title: "Printklare postløb",
    });
    expect(tools.find((tool) => tool.id === "printmit-arbejdsark")).toMatchObject({
      link: { href: expect.stringContaining("printmitarbejdsark.dk/auth/family-sso/start") },
    });
  });

  test("keeps public catalogue sources free of Klasseboden answers and teacher-only text", () => {
    const publicSources = [
      "app/printpakker/page.tsx",
      "app/printpakker/[slug]/page.tsx",
      "components/printpakker/PrintpakkerCatalog.tsx",
      "lib/printpakker/catalog.ts",
      "lib/printpakker/materials.ts",
    ].map((file) => readFileSync(join(root, file), "utf8")).join("\n");

    for (const privatePhrase of [
      "Maja skriver: 14 - 8 = 8.",
      "Tre gyldige valg.",
      "Sporbrik til holdet",
      "RØDE KURV",
      "Korrekt svar:",
    ]) {
      expect(publicSources).not.toContain(privatePhrase);
    }
  });
});

test.describe("Printbibliotek browser journey", () => {
  test("renders eight materials, filters by format, and keeps the four card actions keyboard-safe", async ({ page }) => {
    await page.goto("/printpakker");
    await expect(page.getByRole("heading", { name: /printklare arbejdsark og postløb/i })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(PRINTMATERIALS.length);

    for (const { title } of PRINTMATERIALS) {
      await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
    }

    await page.getByLabel("Format").selectOption("Postløb");
    await expect(page.locator("article")).toHaveCount(7);
    await expect(page.getByRole("link", { name: "Klasseboden — postløb", exact: true })).toBeVisible();
    await page.getByLabel("Format").selectOption("");

    await page.getByLabel("Trin").selectOption("2. klasse · indskoling");
    await expect(page.locator("article")).toHaveCount(2);
    await page.getByLabel("Format").selectOption("Arbejdsark");
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Klasseboden — arbejdsark", exact: true })).toBeVisible();
    await page.getByLabel("Trin").selectOption("");
    await page.getByLabel("Format").selectOption("");

    const selectedMaterial = materialBySlug(klassebodenPostloebSlug);
    const selectedCard = page.locator("article").filter({
      has: page.getByRole("link", { name: selectedMaterial.title, exact: true }),
    });
    const menuButton = selectedCard.getByRole("button", { name: "Materialer" });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(selectedCard.getByRole("link", { name: "Elevmateriale", exact: true }))
      .toHaveAttribute("href", cardDownloadHref(selectedMaterial, "student"));
    await expect(selectedCard.getByRole("link", { name: "Facit", exact: true }))
      .toHaveAttribute("href", cardDownloadHref(selectedMaterial, "answers"));
    await expect(selectedCard.getByRole("link", { name: "Hele pakken · inkl. facit", exact: true }))
      .toHaveAttribute("href", cardDownloadHref(selectedMaterial, "whole"));

    const saveButton = selectedCard.getByRole("button", { name: "Gem", exact: true });
    await saveButton.click();
    await expect(selectedCard.getByRole("button", { name: "Gemt", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(selectedCard.getByText("Gemt i denne browser.", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("skolegps:printbibliotek:saved:v1")))
      .toContain("klasseboden:postloeb");

    await menuButton.focus();
    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();

    await page.getByPlaceholder("Søg efter fag, trin, emne eller format").fill("ingen-sadan-pakke");
    await expect(page.getByText("Ingen materialer matcher lige nu.")).toBeVisible();
  });

  test("shows real facit-free previews and the separate Klasseboden files", async ({ page }) => {
    for (const material of PRINTMATERIALS) {
      await page.goto(`/printpakker/${material.slug}`);
      await expect(page.getByRole("heading", { name: material.title, exact: true })).toBeVisible();
      await expect(page.getByText("Facitfri forhåndsvisning", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /åbn facitfri forhåndsvisning/i }))
        .toHaveAttribute("href", material.preview.publicPdfUrl);

      const preview = await page.request.get(material.preview.publicPdfUrl);
      expect(preview.status(), material.slug).toBe(200);
      expect(preview.headers()["content-type"], material.slug).toContain("application/pdf");
      expect((await preview.body()).subarray(0, 5).toString(), material.slug).toBe("%PDF-");
    }

    await page.goto(`/printpakker/${klassebodenPostloebSlug}`);
    await page.getByText("Flere filer og blækbesparende udgaver", { exact: true }).click();
    await expect(page.locator(`a[href="${buildPrintpakkeDownloadHref(klassebodenPostloebSlug, "stations")}"]`))
      .toContainText("Poster · farve");
    await expect(page.locator(`a[href="${buildPrintpakkeDownloadHref(klassebodenPostloebSlug, "answer-sheet")}"]`))
      .toContainText("Svarark · farve");
    await expect(page.locator(`a[href="${buildPrintpakkeDownloadHref(klassebodenPostloebSlug, "support-ink-saver")}"]`))
      .toContainText("Støtteark · blækbesparende");
  });

  test("keeps every registered PDF behind the existing teacher-login boundary without leaking a PDF", async ({ page }) => {
    for (const material of PRINTMATERIALS) {
      for (const download of material.downloads) {
        const response = await page.request.get(buildPrintpakkeDownloadHref(material.slug, download.variant), {
          maxRedirects: 0,
          headers: { Range: "bytes=0-4" },
        });
        const requestLabel = `${material.slug}/${download.variant}`;
        expect(response.status(), requestLabel).toBe(307);
        expect(response.headers()["cache-control"], requestLabel).toContain("private, no-store");
        expect(response.headers()["x-content-type-options"], requestLabel).toBe("nosniff");
        expect(response.headers()["x-robots-tag"], requestLabel).toContain("noindex");
        expect(response.headers()["content-disposition"], requestLabel).toBeUndefined();
        expect(response.headers()["content-type"] ?? "", requestLabel).not.toContain("application/pdf");
        expect((await response.body()).subarray(0, 5).toString(), requestLabel).not.toBe("%PDF-");

        const location = response.headers().location;
        expect(location, requestLabel).toContain("/login?next=%2Fdashboard%2Flaerervaerktoejer%2Fprintpakker");
        const next = new URL(location!, "http://localhost").searchParams.get("next");
        expect(next, requestLabel).toBe(buildPrintpakkeLoginReturnPath(material.slug, download.variant));
      }
    }
  });

  test("returns a private 404 without a PDF for unknown or unsupported package variants", async ({ page }) => {
    for (const path of [
      "/api/printpakker/findes-ikke/student",
      `/api/printpakker/${originalPackageSlug}/findes-ikke`,
      `/api/printpakker/${originalPackageSlug}/stations`,
      `/api/printpakker/${klassebodenArbejdsarkSlug}/stations`,
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
      await expect(page.getByRole("heading", { name: /printklare arbejdsark og postløb/i })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${width}px should not overflow horizontally`).toBe(false);
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/printpakker", { waitUntil: "domcontentloaded" });
    const transitionDuration = await page.locator("article").first().evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(transitionDuration).toBe("0s");
  });
});
