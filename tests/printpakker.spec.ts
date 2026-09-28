import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { PRINTPAKKER } from "../lib/printpakker/catalog";
import {
  buildPrintpakkeDownloadHref,
  buildPrintpakkeLoginReturnPath,
} from "../lib/printpakker/links";
import { hasPrintpakkeDownloadSession } from "../lib/printpakker/access";
import { createTeacherToolRegistry, TEACHER_TOOL_FALLBACK_ORIGINS } from "../lib/teacherTools/registry";

const root = process.cwd();
const packageSlug = "efteraarsmysteriet";

test.describe("Printpakker catalogue contracts", () => {
  test("uses one real catalogued package with safe download links and no public facit file", () => {
    expect(PRINTPAKKER).toHaveLength(1);
    expect(PRINTPAKKER[0]).toMatchObject({
      activityType: "Makkerløb ved bordene",
      gradeLevel: "5.-6. klasse",
      slug: packageSlug,
      subject: "Matematik",
      version: "1.0",
    });
    expect(buildPrintpakkeDownloadHref(packageSlug, "student"))
      .toBe("/api/printpakker/efteraarsmysteriet/student");
    expect(buildPrintpakkeLoginReturnPath(packageSlug, "answer-key"))
      .toBe("/dashboard/laerervaerktoejer/printpakker?download=answer-key&slug=efteraarsmysteriet");

    const publicFiles = readdirSync(join(root, "public", "printpakker"));
    expect(publicFiles).toContain("afteraarsmysteriet-forhaandsvisning.pdf");
    expect(publicFiles.some((file) => /facit|laerervejledning|hele_pakken/i.test(file))).toBe(false);
    expect(existsSync(join(root, "assets", "printpakker", packageSlug, "SkoleGPS_Efteraarsmysteriet_facit.pdf"))).toBe(true);
    for (const artwork of [
      "kastanjekranse.png",
      "bladarkivet.png",
      "aeblemosten.png",
      "lanterneruden.png",
      "farvevaerkstedet.png",
      "skumringsuret.png",
    ]) {
      expect(existsSync(join(root, "public", "printpakker", "stations", artwork))).toBe(true);
    }
  });

  test("rejects an anonymous student session for protected downloads", () => {
    expect(hasPrintpakkeDownloadSession(null)).toBe(false);
    expect(hasPrintpakkeDownloadSession({ is_anonymous: true })).toBe(false);
    expect(hasPrintpakkeDownloadSession({ is_anonymous: false })).toBe(true);
  });

  test("adds a separate internal Printpakker registry entry without changing PrintMit's destination", () => {
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

  test("keeps public components and previews free of answers", () => {
    const publicSources = [
      "app/printpakker/page.tsx",
      "components/printpakker/PrintpakkerCatalog.tsx",
      "lib/printpakker/catalog.ts",
    ].map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    for (const privatePhrase of ["Sporbrik til holdet", "RØDE KURV", "Korrekt svar:"]) {
      expect(publicSources).not.toContain(privatePhrase);
    }
  });
});

test.describe("Printpakker browser journey", () => {
  test("renders the catalogue, filters to an empty state, and opens then closes the quick menu", async ({ page }) => {
    await page.goto("/printpakker");
    await expect(page.getByRole("heading", { name: /færdige pakker/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Efterårsmysteriet", exact: true })).toBeVisible();

    const menuButton = page.getByRole("button", { name: "Materialer" });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Hele pakken" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Elevark" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Facit" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lærervejledning" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await page.getByPlaceholder("Søg efter fag, klassetrin eller aktivitet").fill("ingen-sadan-pakke");
    await expect(page.getByText("Ingen pakker matcher lige nu.")).toBeVisible();
    await page.getByPlaceholder("Søg efter fag, klassetrin eller aktivitet").fill("");
    await expect(page.getByRole("link", { name: "Efterårsmysteriet", exact: true })).toBeVisible();
  });

  test("shows a facit-free package preview and sends anonymous downloads to the safe login return", async ({ page }) => {
    await page.goto(`/printpakker/${packageSlug}`);
    await expect(page.getByRole("heading", { name: "Efterårsmysteriet" })).toBeVisible();
    await expect(page.getByText("Facitfri forhåndsvisning")).toBeVisible();
    await expect(page.getByRole("link", { name: /åbn facitfri forhåndsvisning/i })).toHaveAttribute(
      "href",
      "/printpakker/afteraarsmysteriet-forhaandsvisning.pdf",
    );
    await expect(page.getByText("Sporbrik til holdet")).toHaveCount(0);
    await expect(page.getByText("RØDE KURV")).toHaveCount(0);

    const response = await page.request.get(buildPrintpakkeDownloadHref(packageSlug, "answer-key"), { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["cache-control"]).toContain("private, no-store");
    expect(response.headers()["location"]).toContain("/login?next=%2Fdashboard%2Flaerervaerktoejer%2Fprintpakker");
    expect(response.headers()["location"]).toContain("download%3Danswer-key");
  });

  test("keeps the catalog usable at the required viewport widths and honors reduced motion", async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/printpakker");
      await expect(page.getByRole("heading", { name: /færdige pakker/i })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${width}px should not overflow horizontally`).toBe(false);
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/printpakker");
    const transitionDuration = await page.locator("article").first().evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(transitionDuration).toBe("0s");
  });

  test("returns 404 for an unknown package id", async ({ page }) => {
    const response = await page.goto("/printpakker/findes-ikke");
    expect(response?.status()).toBe(404);
  });
});
