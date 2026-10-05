import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const LINKS = {
  classroom:
    "https://dagenstavle.dk/auth/family-sso/start?next=%2Ftavle&source=skolegps",
  worksheets:
    "https://printmitarbejdsark.dk/auth/family-sso/start?next=%2Flav&source=skolegps",
  gps: "/dashboard/opret/valg",
} as const;

function source(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test.describe("PISA-notits på forsiden", () => {
  test("er kun synlig i computerlayout og ligger samlet under nyheder", async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      await expect(page.getByTestId("pisa-notice")).toBeHidden();
      expect(
        await page.locator('a[href="#nyheder"]').evaluateAll(
          (links) => links.every((link) => link.getClientRects().length === 0),
        ),
      ).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    for (const width of [640, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const pisaNotice = page.getByTestId("pisa-notice");
      await expect(pisaNotice).toBeVisible();
      await expect(page.getByRole("heading", { name: "Mere liv i undervisningen." })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Indgange og perspektiv.", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Log ind", exact: true }).first()).toBeVisible();

      expect(
        await page.evaluate(() => {
          const hero = document.querySelector("h1");
          const news = document.querySelector("#nyheder");
          const pisa = document.querySelector('[data-testid="pisa-notice"]');
          return Boolean(
            hero && news && pisa
              && (hero.compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING)
              && (news.compareDocumentPosition(pisa) & Node.DOCUMENT_POSITION_CONTAINED_BY),
          );
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
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
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
    const homeSource = source("components/home/TeacherHomepage.tsx");

    expect(noticeSource).toContain("<details");
    expect(noticeSource).toContain("<summary");
    expect(noticeSource).not.toMatch(/useState|useEffect|localStorage|fetch\(/);
    expect(noticeSource).not.toContain("https://ugepilot.dk/");
    expect(noticeSource).not.toContain("/dashboard\";");
    expect(homeSource).toContain('id="nyheder"');
    expect(homeSource).toContain('requiredActiveTool("dagens-tavle")');
    expect(homeSource).toContain('requiredActiveTool("printmit-arbejdsark")');
    expect(homeSource).toContain('requiredActiveTool("gps-lob")');
    expect(homeSource).toContain("classroom.link.href");
    expect(homeSource).toContain("worksheets.link.href");
    expect(homeSource).toContain("gps.link.href");
  });
});
