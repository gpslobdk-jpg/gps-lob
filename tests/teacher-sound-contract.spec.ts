import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const ROOT = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function teacherAudioRequests(page: Page) {
  const requests = new Set<string>();
  page.on("request", (request: { url: () => string }) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/audio/teacher/")) {
      requests.add(url.pathname);
    }
  });
  return requests;
}

test.describe("Lyd og ro for lærere", () => {
  test("assets er dokumenterede, teknisk validerede og uden et falsk biblioteks-preset", () => {
    const verifier = path.join(ROOT, "scripts", "verify-teacher-audio-assets.mjs");
    expect(existsSync(verifier)).toBe(true);
    execFileSync(process.execPath, [verifier], { cwd: ROOT, stdio: "pipe" });

    const catalog = source("lib/teacherSound/catalog.ts");
    const documentation = source("docs/skolegps/teacher-sound-assets.md");
    for (const filename of [
      "afteraarsskov.mp3",
      "regn-ved-vinduet.mp3",
      "stille-klaver.mp3",
      "papir-1.mp3",
      "papir-2.mp3",
      "papir-3.mp3",
    ]) {
      expect(existsSync(path.join(ROOT, "public", "audio", "teacher", filename))).toBe(true);
    }

    expect(catalog).toContain('id: "bibliotekets-ro"');
    expect(catalog).toContain("available: false");
    expect(catalog).not.toContain("/skovlyd.mp3");
    expect(catalog).not.toContain("/forest.mp3");
    expect(documentation).toContain("ikke afspilningsklar");
    expect(documentation).toMatch(/menneskelig lyttegennemgang/i);
  });

  test("henter ingen lærerlyd før et bevidst starttryk og bevarer motoren ved intern lærer-navigation", async ({
    page,
  }) => {
    const requests = teacherAudioRequests(page);
    const homepageResponse = await page.request.get("/");
    expect(homepageResponse.ok()).toBe(true);
    const homepageHtml = await homepageResponse.text();
    expect(homepageHtml).toContain('data-testid="teacher-sound-control"');
    expect(homepageHtml).toContain("Lyd og ro");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByTestId("teacher-sound-control")).toBeVisible();
    await expect(page.getByText("Vælg lyd", { exact: true })).toBeVisible();
    await expect(page.locator("audio")).toHaveCount(0);
    expect(requests.size).toBe(0);

    await page.getByRole("button", { name: "Lyd og ro", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Lyd og ro", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Bibliotekets ro/i })).toBeDisabled();
    expect(requests.size).toBe(0);

    await page.getByTestId("teacher-sound-start").click();
    await expect(page.getByTestId("teacher-sound-stop")).toBeVisible();
    await expect.poll(() => requests.size).toBeGreaterThan(0);
    expect(requests.has("/audio/teacher/afteraarsskov.mp3")).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Lyd og ro", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Om", exact: true }).click();
    await expect(page).toHaveURL(/\/manden-bag-skolegps$/, { timeout: 30_000 });
    await expect(page.getByTestId("teacher-sound-stop")).toBeVisible();
    expect([...requests]).toEqual(["/audio/teacher/afteraarsskov.mp3"]);
  });

  test("en anden fane bliver lydløs, og en reload tilbyder kun eksplicit fortsættelse", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const first = await context.newPage();
    const second = await context.newPage();
    const firstRequests = teacherAudioRequests(first);
    const secondRequests = teacherAudioRequests(second);

    try {
      await first.goto("/");
      await first.getByRole("button", { name: "Lyd og ro", exact: true }).click();
      await first.getByTestId("teacher-sound-start").click();
      await expect(first.getByTestId("teacher-sound-stop")).toBeVisible();
      await expect.poll(() => firstRequests.size).toBeGreaterThan(0);
      await expect
        .poll(() =>
          first.evaluate(() =>
            JSON.parse(window.localStorage.getItem("skolegps.teacher-sound.preferences.v1") ?? "{}").hasUsedSound,
          ),
        )
        .toBe(true);

      await second.goto("/");
      await second.getByRole("button", { name: "Lyd og ro", exact: true }).click();
      await second.getByTestId("teacher-sound-start").click();
      await expect(second.getByText("Lyd spiller allerede i en anden fane. Stop den dér, før du starter her.")).toBeVisible();
      expect(secondRequests.size).toBe(0);

      await first.reload();
      await first.getByRole("button", { name: "Lyd og ro", exact: true }).click();
      await expect(first.getByTestId("teacher-sound-start")).toHaveText("Fortsæt lyd");
      await expect(first.getByTestId("teacher-sound-stop")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("student- og livegrænser deler ikke lærerafspilleren", async ({ page }) => {
    const requests = teacherAudioRequests(page);
    await page.goto("/join");

    await expect(page.getByTestId("teacher-sound-control")).toHaveCount(0);
    await expect(page.locator("audio[src*='/audio/teacher/']")).toHaveCount(0);
    expect(requests.size).toBe(0);

    const rootLayout = source("app/layout.tsx");
    const dashboardLayout = source("app/dashboard/layout.tsx");
    const dashboardHeader = source("components/dashboard/DashboardHeader.tsx");
    const catalog = source("lib/teacherSound/catalog.ts");
    expect(rootLayout).toContain("TeacherSoundProvider");
    expect(dashboardLayout).not.toContain("DashboardAudioPlayer");
    expect(dashboardLayout).not.toContain("AudioProvider");
    expect(dashboardHeader).toContain('<TeacherSoundControl variant="dashboard"');
    expect(catalog).toContain('pathname.startsWith("/dashboard/live")');
    expect(catalog).toContain('pathname.startsWith("/dashboard/opret/musikquiz")');
  });
});
