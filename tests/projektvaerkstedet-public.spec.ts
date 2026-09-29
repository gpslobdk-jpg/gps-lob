import { expect, test } from "@playwright/test";

import {
  getProjectWorkshopStartHref,
  PROJECT_WORKSHOP_NEWS_PATH,
} from "../lib/projektvaerkstedet/links";

test.describe("Projektværkstedet public launch", () => {
  test("explains the two workshops and uses the existing protected PrintMit handoff", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/projektvaerkstedet");

    await expect(page.getByRole("heading", { name: "Projektværkstedet", exact: true })).toBeVisible();
    await expect(page.getByText("Rumfang — hvad tæller vi egentlig?", { exact: true })).toBeVisible();
    await expect(page.getByText("Renover klasselokalet", { exact: true })).toBeVisible();
    await expect(page.getByText(/overfører ikke klasse-, elev- eller projektdata/i)).toBeVisible();
    await expect(page.getByTestId("project-workshop-start")).toHaveAttribute(
      "href",
      getProjectWorkshopStartHref(),
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    const handoff = new URL(getProjectWorkshopStartHref());
    expect(handoff.pathname).toBe("/auth/family-sso/start");
    expect(handoff.searchParams.get("next")).toBe("/projekter");
    expect(handoff.searchParams.get("source")).toBe("skolegps");
  });

  test("publishes a linked news item", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PROJECT_WORKSHOP_NEWS_PATH);

    await expect(page.getByRole("heading", { name: "Projektværkstedet er klar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Til Projektværkstedet" })).toHaveAttribute(
      "href",
      "/projektvaerkstedet",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    await page.goto("/projektvaerkstedet");
    await expect(page.getByRole("heading", { name: "Projektværkstedet", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
  });
});
