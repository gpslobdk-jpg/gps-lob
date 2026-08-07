import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DPA_PDF =
  "/dokumenter/SkoleGPS_databehandleraftale_foersteudkast_2026-08-07.pdf";
const DPA_DOCX =
  "/dokumenter/SkoleGPS_databehandleraftale_foersteudkast_2026-08-07.docx";

test.describe("IT- og databeskyttelsessiden", () => {
  test("viser en tydelig og ærlig vej til aftaledokumenterne", async ({ page, request }, testInfo) => {
    await page.goto("/it-afdelinger");

    await expect(
      page.getByRole("heading", { name: "Til kommunens IT-afdeling", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Første udkast – ikke klar til underskrift endnu")).toBeVisible();
    await expect(page.getByText(/ikke fotograferes/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Hent redigerbart Word-udkast" })).toHaveAttribute(
      "href",
      DPA_DOCX,
    );
    await expect(page.getByRole("link", { name: "Åbn PDF-udkast" })).toHaveAttribute(
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
      name: "Til kommunens IT-afdeling",
      level: 1,
    });
    expect(
      await heading.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBeTruthy();
    await expect(page.getByRole("link", { name: "Hent redigerbart Word-udkast" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Åbn PDF-udkast" })).toBeVisible();
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
});
