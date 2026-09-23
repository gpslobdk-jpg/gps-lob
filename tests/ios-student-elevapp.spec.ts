import { expect, test } from "@playwright/test";

test.describe("elevoplevelsen på iPhone-profil", () => {
  test("join bevarer Pilen, de to indgange og et smalt layout på iPhone-mobilprofilen", async ({
    page,
  }) => {
    await page.context().route(/supabase.*realtime|realtime\/v1\/websocket/i, (route) =>
      route.abort("connectionrefused"),
    );

    await page.goto("/join", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Deltag i et løb", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "Deltag i et løb", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Scan QR-kode", exact: true }),
    ).toBeVisible();

    const mobileProfile = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    expect(mobileProfile.userAgent).toMatch(/iPhone/i);
    expect(mobileProfile.viewportWidth).toBeLessThanOrEqual(430);
    expect(mobileProfile.hasHorizontalOverflow).toBe(false);

    await page
      .getByRole("button", { name: "Deltag i et løb", exact: true })
      .click();
    await expect(page.locator("#join-code")).toBeFocused();
  });
});
