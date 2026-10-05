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
  });
});
