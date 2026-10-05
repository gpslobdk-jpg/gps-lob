import { expect, test } from "@playwright/test";

test.describe("opdateringer", () => {
  test("den pensionerede opdateringsside sender til forsiden", async ({ page }) => {
    await page.goto("/opdateringer");

    await expect(page).toHaveURL(/\/$/);
  });

  test("forsiden viser ikke længere den pensionerede kommende-værktøjer-nyhed", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("home-upcoming-tools")).toHaveCount(0);
    await expect(page.getByText("FondsGPS og SkoleGPS Music Studio", { exact: false })).toHaveCount(0);
  });

  test("viser Pilen som en tydelig desktop-hjælper med chat og kontaktvej", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const launcher = page.getByRole("button", { name: "Åbn Pilen, SkoleGPS-hjælp" });
    await expect(launcher).toBeVisible();
    await expect(launcher).toContainText("Jeg kan hjælpe");
    await expect(
      page.getByRole("link", { name: "Skriv til skolegpsdk@gmail.com for hjælp eller idéer" }),
    ).toHaveAttribute("href", /mailto:skolegpsdk@gmail\.com/);

    await launcher.click();
    const dialog = page.getByRole("dialog", { name: "Pilen, SkoleGPS-hjælp" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Spørg Pilen" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(launcher).toBeFocused();
  });

  test("holder Pilen rolig, når brugeren har valgt reduceret bevægelse", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const launcher = page.getByRole("button", { name: "Åbn Pilen, SkoleGPS-hjælp" });
    await expect(launcher.locator(".skolegps-mascot-float")).toHaveCSS("animation-name", "none");
  });

  test("viser ikke Pilen på Postløps separate forside", async ({ browser }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-host": "postlob.net" },
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/?code=");
      await expect(page.getByRole("button", { name: "Åbn Pilen, SkoleGPS-hjælp" })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
