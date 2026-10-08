import { expect, test } from "@playwright/test";

test.describe("desktop homepage entry", () => {
  test("opens directly to the teacher homepage without an intro overlay or sound copy", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Mere liv i undervisningen.", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kom i gang – vælg værktøj", exact: true })).toBeVisible();
    await expect(page.getByTestId("homepage-intro")).toHaveCount(0);
    await expect(page.getByTestId("homepage-intro-audio")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Ingen lyd i webanimationen", { exact: true })).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);

    const autumnScene = page.getByTestId("autumn-home-scene");
    await expect(autumnScene).toBeVisible();
    await expect(autumnScene).toHaveCSS("pointer-events", "none");
    await expect(autumnScene.locator("a, button, input, select, textarea, [tabindex]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("keeps the autumn hero clear and contained at the desktop breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await expect(page.getByTestId("autumn-home-scene")).toBeVisible();
    await expect(page.getByRole("link", { name: "Kom i gang – vælg værktøj", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
