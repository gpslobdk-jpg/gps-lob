import { expect, test } from "@playwright/test";

test.describe("opdateringer", () => {
  test("viser kun de to kommende værktøjer", async ({ page }) => {
    await page.goto("/opdateringer");

    await expect(page.getByRole("heading", { name: "Opdateringer", level: 1 })).toBeVisible();
    await expect(page.getByTestId("upcoming-tools-list").getByRole("heading")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "FondsGPS er på vej", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SkoleGPS Music Studio er på vej", level: 2 })).toBeVisible();
    await expect(page.getByText("musikstudie til lærere", { exact: false })).toBeVisible();
    await expect(page.getByText("Jeppe kan optage", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Åbn SkemaPilot")).toHaveCount(0);
  });

  test("har en diskret indgang fra SkoleGPS-forsiden", async ({ page }) => {
    await page.goto("/");

    const entry = page.getByTestId("home-upcoming-tools");
    await expect(entry).toContainText("FondsGPS og SkoleGPS Music Studio");
    await expect(entry.getByRole("link", { name: "Læs mere →" })).toHaveAttribute("href", "/opdateringer");
  });
});
