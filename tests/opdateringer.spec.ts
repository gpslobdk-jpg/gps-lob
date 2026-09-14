import { expect, test } from "@playwright/test";

test.describe("opdateringer", () => {
  test("viser kun de to kommende værktøjer", async ({ page }) => {
    await page.goto("/opdateringer");

    await expect(page.getByRole("heading", { name: "Opdateringer", level: 1 })).toBeVisible();
    await expect(page.getByTestId("upcoming-tools-list").getByRole("heading")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "FondsGPS er på vej", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Jeppe Studio er på vej", level: 2 })).toBeVisible();
    await expect(page.getByText("Åbn SkemaPilot")).toHaveCount(0);
  });

  test("har en diskret indgang fra SkoleGPS-forsiden", async ({ page }) => {
    await page.goto("/");

    const entry = page.getByTestId("home-upcoming-tools");
    await expect(entry).toContainText("FondsGPS og Jeppe Studio");
    await expect(entry.getByRole("link", { name: "Læs mere →" })).toHaveAttribute("href", "/opdateringer");
  });
});
