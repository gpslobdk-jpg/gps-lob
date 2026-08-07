import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DPA_PDF =
  "/dokumenter/SkoleGPS_standarddatabehandleraftale.pdf";
const DPA_DOCX =
  "/dokumenter/SkoleGPS_standarddatabehandleraftale.docx";

test.describe("IT- og databeskyttelsessiden", () => {
  test("viser den versionsstyrede standardskabelon og korrekte fakta", async ({ page, request }, testInfo) => {
    await page.goto("/it-afdelinger");

    await expect(
      page.getByRole("heading", { name: "Til IT og databeskyttelse", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Ikke underskrevet standardskabelon")).toBeVisible();
    await expect(page.getByText(/version 1\.0 fra 7\. august 2026/i)).toBeVisible();
    await expect(page.getByText(/Standardflowet opbygger ikke en særskilt rutehistorik/)).toBeVisible();
    await expect(page.getByText(/ikke fotograferes/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Hent Word-skabelon" })).toHaveAttribute(
      "href",
      DPA_DOCX,
    );
    await expect(page.getByRole("link", { name: "Åbn PDF" })).toHaveAttribute(
      "href",
      DPA_PDF,
    );

    const [docxResponse, pdfResponse] = await Promise.all([
      request.get(DPA_DOCX),
      request.get(DPA_PDF),
    ]);

    expect(docxResponse.ok()).toBeTruthy();
    expect(pdfResponse.ok()).toBeTruthy();
    expect((await docxResponse.body()).byteLength).toBeGreaterThan(50_000);
    expect((await pdfResponse.body()).byteLength).toBeGreaterThan(50_000);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Privatlivspolitik" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await expect(page.getByRole("link", { name: "Ophavsret" })).toHaveAttribute("href", "/ophavsret");
    expect(await page.locator("body").innerText()).not.toContain("foersteudkast");
    await page.screenshot({ path: testInfo.outputPath("it-afdelinger-desktop.png"), fullPage: true });
  });

  test("holder indhold og handlinger inden for en smal mobilskærm", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/it-afdelinger");

    const metrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));

    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    const heading = page.getByRole("heading", {
      name: "Til IT og databeskyttelse",
      level: 1,
    });
    expect(
      await heading.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBeTruthy();
    await expect(page.getByRole("link", { name: "Hent Word-skabelon" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Åbn PDF" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("it-afdelinger-mobile.png"), fullPage: true });
  });

  test("kan findes fra både forside og login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Til IT-afdelinger" })).toHaveAttribute(
      "href",
      "/it-afdelinger",
    );

    const loginSource = readFileSync(join(process.cwd(), "app/login/LoginPageClient.tsx"), "utf8");
    expect(loginSource).toContain('href="/it-afdelinger"');
    expect(loginSource).toContain("Til kommunernes IT- og databeskyttelsesafdelinger");
  });

  test("privatlivspolitikken skelner mellem dataansvarlig og databehandler", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.getByRole("heading", { name: "Privatlivspolitik", level: 1 })).toBeVisible();
    await expect(page.getByText(/Jeppe Laursen er dataansvarlig/)).toBeVisible();
    await expect(page.getByText(/Kommunen eller skoleejeren er dataansvarlig for elevdata/)).toBeVisible();
    await expect(page.getByText("Senest opdateret: 7. august 2026.")).toBeVisible();

    const metrics = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  });

  test("offentliggør identiske dokumentkopier uden gamle kladdenavne", () => {
    const docsDir = join(process.cwd(), "docs/legal");
    const publicDir = join(process.cwd(), "public/dokumenter");
    const names = [
      "SkoleGPS_standarddatabehandleraftale.docx",
      "SkoleGPS_standarddatabehandleraftale.pdf",
    ];

    for (const name of names) {
      expect(readFileSync(join(docsDir, name)).equals(readFileSync(join(publicDir, name)))).toBeTruthy();
    }

    expect(
      existsSync(join(publicDir, "SkoleGPS_databehandleraftale_foersteudkast_2026-08-07.docx")),
    ).toBeFalsy();
    expect(
      existsSync(join(publicDir, "SkoleGPS_databehandleraftale_foersteudkast_2026-08-07.pdf")),
    ).toBeFalsy();
  });
});
