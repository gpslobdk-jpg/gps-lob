import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CV_PDF = "/dokumenter/Jeppe_Laursen_CV_med_anbefaling_rettet.pdf";
const APPROVED_CV_SHA256 = "301311357bd323e8f1f3dc975bb345956c9451f9c25fb3a49c5f30cead88b57b";

test.describe("Manden bag SkoleGPS", () => {
  test("forsiden har én rolig indgang uden at ændre elevvejen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/");

    const entry = page.getByRole("link", { name: "Manden bag SkoleGPS →" });
    await expect(entry).toHaveAttribute("href", "/manden-bag-skolegps");
    await entry.focus();
    await expect(entry).toBeFocused();
    await expect(page.getByTestId("home-founder-entry")).toContainText(
      "Mød Jeppe Laursen, læreren bag SkoleGPS.",
    );
    await expect(page.getByRole("link", { name: "GPS-hjælp", exact: true })).toHaveAttribute(
      "href",
      "/hjaelp",
    );
  });

  test("den offentlige profilside samler indhold, kontakt og dokumenthandlinger", async ({
    page,
    request,
  }) => {
    await page.goto("/manden-bag-skolegps");

    await expect(
      page.getByRole("heading", { name: "Manden bag SkoleGPS", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Jeppe Laursen", { exact: true })).toBeVisible();
    await expect(page.getByText("Undervisning med hoved, hænder og bevægelse.")).toBeVisible();
    await expect(page.getByText("PDF · 3 sider", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Han har en særlig evne for at kombinere undervisningens teoretiske side og praktiske anvendelighed",
      ),
    ).toBeVisible();

    const readLink = page.getByRole("link", { name: "Læs CV og anbefaling" });
    const downloadLink = page.getByRole("link", { name: "Hent PDF" });
    await expect(readLink).toHaveAttribute("href", CV_PDF);
    await expect(readLink).toHaveAttribute("target", "_blank");
    await expect(downloadLink).toHaveAttribute("href", CV_PDF);
    await expect(downloadLink).toHaveAttribute("download", "");
    await readLink.focus();
    await expect(readLink).toBeFocused();

    const pdfRequestPromise = page.context().waitForEvent(
      "request",
      (request) => new URL(request.url()).pathname === CV_PDF,
    );
    const popupPromise = page.waitForEvent("popup");
    await readLink.click();
    await pdfRequestPromise;
    const pdfPage = await popupPromise;
    await pdfPage.close();

    await downloadLink.focus();
    await expect(downloadLink).toBeFocused();

    const downloadPromise = page.waitForEvent("download");
    await downloadLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Jeppe_Laursen_CV_med_anbefaling_rettet.pdf");

    await expect(page.getByRole("link", { name: /SkoleGPS\s+skolegpsdk@gmail\.com/ })).toHaveAttribute(
      "href",
      "mailto:skolegpsdk@gmail.com",
    );
    await expect(
      page.getByRole("link", { name: /Personlig kontakt\s+jeppelaursen83@gmail\.com/ }),
    ).toHaveAttribute("href", "mailto:jeppelaursen83@gmail.com");

    const pdfResponse = await request.get(CV_PDF);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    const publicPdf = await pdfResponse.body();
    expect(publicPdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(createHash("sha256").update(publicPdf).digest("hex")).toBe(APPROVED_CV_SHA256);
  });

  test("bevarer den gamle om-adresse som en privatlivssikker viderestilling", async ({ page, request }) => {
    const legacyResponse = await request.get("/om", { maxRedirects: 0 });
    expect(legacyResponse.status()).toBe(308);
    expect(legacyResponse.headers()["location"]).toBe("/manden-bag-skolegps");

    await page.goto("/om");
    await expect(page).toHaveURL(/\/manden-bag-skolegps$/);
    await expect(
      page.getByRole("heading", { name: "Manden bag SkoleGPS", level: 1 }),
    ).toBeVisible();
  });

  test("holder profilsiden læsbar uden vandret scroll på almindelige skærme", async ({ page }) => {
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 768, height: 960 },
      { width: 1440, height: 960 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/manden-bag-skolegps");

      const metrics = await page.evaluate(() => ({
        contentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.contentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      await expect(page.getByRole("heading", { name: "Manden bag SkoleGPS", level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: "Læs CV og anbefaling" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Hent PDF" })).toBeVisible();
    }
  });

  test("holder den offentliggjorte PDF som den godkendte, byte-identiske fil", () => {
    const publicPdf = readFileSync(join(process.cwd(), "public", CV_PDF.slice(1)));
    expect(createHash("sha256").update(publicPdf).digest("hex")).toBe(APPROVED_CV_SHA256);
    expect(publicPdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
