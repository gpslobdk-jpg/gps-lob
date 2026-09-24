import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const LINKS = {
  classroom:
    "https://dagenstavle.dk/auth/family-sso/start?next=%2Ftavle&source=skolegps",
  worksheets:
    "https://printmitarbejdsark.dk/auth/family-sso/start?next=%2Flav&source=skolegps",
  gps: "/login?next=%2Fdashboard%2Fopret%2Fvalg",
} as const;

function source(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test.describe("PISA-notits på forsiden", () => {
  test("er kun synlig i computerlayout og lader mobilnotitsen stå først", async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      await expect(page.getByTestId("pisa-notice")).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const mobileNotice = page.getByRole("link", { name: /Læs vores svar/i });
      const pisaNotice = page.getByTestId("pisa-notice");
      await expect(mobileNotice).toBeVisible();
      await expect(pisaNotice).toBeVisible();
      await expect(page.getByRole("heading", { name: "Undervisning i bevægelse." })).toBeVisible();

      expect(
        await page.evaluate(() => {
          const mobile = document.querySelector('a[href="/mobil-i-skolen"]');
          const pisa = document.querySelector('[data-testid="pisa-notice"]');
          return Boolean(mobile && pisa && (mobile.compareDocumentPosition(pisa) & Node.DOCUMENT_POSITION_FOLLOWING));
        }),
      ).toBe(true);
    }
  });

  test("bevarer native details, tastaturbetjening og de eksisterende destinationer", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto("/");

    const notice = page.getByTestId("pisa-notice");
    const details = notice.locator("details");
    const summary = notice.locator("summary");

    await expect(details).not.toHaveAttribute("open", "");
    await expect(summary).toContainText("Se mulighederne");
    await expect(notice.getByText("Tre måder at sætte fagligheden først")).toBeHidden();

    await summary.focus();
    await expect(summary).toBeFocused();
    await expect(summary).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");

    await expect(details).toHaveAttribute("open", "");
    await expect(summary).toContainText("Luk forklaringen");
    await expect(notice.getByText("Tre måder at sætte fagligheden først")).toBeVisible();
    await expect(notice.getByText("UgePilot", { exact: true })).toHaveCount(0);

    await expect(notice.getByRole("link", { name: /Åbn DagensTavle/i })).toHaveAttribute(
      "href",
      LINKS.classroom,
    );
    await expect(notice.getByRole("link", { name: /Åbn PrintMitArbejdsark/i })).toHaveAttribute(
      "href",
      LINKS.worksheets,
    );
    await expect(notice.getByRole("link", { name: /Gå til lærerområdet/i })).toHaveAttribute(
      "href",
      LINKS.gps,
    );

    for (const link of [
      notice.getByRole("link", { name: /Åbn DagensTavle/i }),
      notice.getByRole("link", { name: /Åbn PrintMitArbejdsark/i }),
      notice.getByRole("link", { name: /Gå til lærerområdet/i }),
    ]) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press("Space");
    await expect(details).not.toHaveAttribute("open", "");
  });

  test("har plads til 200 % tekststørrelse i computerlayout", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1400 });
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });

    const notice = page.getByTestId("pisa-notice");
    await notice.locator("summary").click();
    await expect(notice.locator("details")).toHaveAttribute("open", "");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("holder udfoldningen native og fri for ny klient-state eller standardlinks", () => {
    const noticeSource = source("components/home/PisaNotice.tsx");
    const homeSource = source("components/HomePageClient.tsx");

    expect(noticeSource).toContain("<details");
    expect(noticeSource).toContain("<summary");
    expect(noticeSource).not.toMatch(/useState|useEffect|localStorage|fetch\(/);
    expect(noticeSource).not.toContain("https://ugepilot.dk/");
    expect(noticeSource).not.toContain("/dashboard\";");
    expect(homeSource).toContain('className="hidden md:block"');
    expect(homeSource).toContain(LINKS.classroom);
    expect(homeSource).toContain(LINKS.worksheets);
    expect(homeSource).toContain(LINKS.gps);
  });
});
