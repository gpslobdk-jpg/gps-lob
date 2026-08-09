import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSafeDagensTavlePath, isTrustedSkoleGpsRequest } from "../lib/familySso/config";
import {
  signFamilySsoBackchannel,
  verifyFamilySsoBackchannel,
} from "../lib/familySso/crypto";

const read = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");

let localTeacher: { id: string; email: string; password: string } | null = null;

async function openTeacherTools(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(localTeacher!.email);
  await page.getByPlaceholder("Adgangskode").fill(localTeacher!.password);
  await page.getByRole("button", { name: /Log ind \/ Opret/i }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto("/dashboard/laerervaerktoejer");
  await expect(page.locator('main section[aria-label]')).toBeVisible();
}

test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(url)) return;
  const admin = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
  const email = `family-ui-${crypto.randomUUID()}@isolated.invalid`;
  const password = `Local-${crypto.randomUUID()}-A1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Kunne ikke oprette lokal SSO UI-testlærer.");
  await admin.from("profiles").upsert({ id: data.user.id });
  localTeacher = { id: data.user.id, email, password };
});

test.afterAll(async () => {
  if (!localTeacher) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const admin = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(localTeacher.id);
});

test.describe("DagensTavle family SSO security contract", () => {
  test("accepts only normalized relative DagensTavle return paths", () => {
    expect(getSafeDagensTavlePath("/tavle?fra=skema")).toBe("/tavle?fra=skema");
    for (const unsafe of [
      "https://evil.invalid/",
      "//evil.invalid/",
      "javascript:alert(1)",
      "/\\evil.invalid",
      "/%0d%0aLocation:https://evil.invalid",
      "data:text/html,test",
    ]) {
      expect(getSafeDagensTavlePath(unsafe), unsafe).toBe("/skema");
    }
  });

  test("requires a fresh, exact HMAC and rejects replay outside the clock window", () => {
    const secret = "x".repeat(48);
    const body = JSON.stringify({ action: "inspect", requestHash: "a".repeat(64) });
    const now = 1_786_147_200_000;
    const timestamp = String(now);
    const signature = signFamilySsoBackchannel(body, timestamp, secret);

    expect(verifyFamilySsoBackchannel({ body, timestamp, signature, secret, now })).toBe(true);
    expect(verifyFamilySsoBackchannel({ body: `${body} `, timestamp, signature, secret, now })).toBe(false);
    expect(verifyFamilySsoBackchannel({ body, timestamp, signature: `${signature}x`, secret, now })).toBe(false);
    expect(verifyFamilySsoBackchannel({ body, timestamp, signature, secret, now: now + 31_000 })).toBe(false);
  });

  test("requires a browser same-origin request before logout handoffs are revoked", () => {
    const sameOrigin = new Request("http://127.0.0.1:3000/api/family-sso/revoke", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:3000", "Sec-Fetch-Site": "same-origin" },
    });
    const crossOrigin = new Request("http://127.0.0.1:3000/api/family-sso/revoke", {
      method: "POST",
      headers: { Origin: "https://evil.invalid", "Sec-Fetch-Site": "cross-site" },
    });
    expect(isTrustedSkoleGpsRequest(sameOrigin)).toBe(true);
    expect(isTrustedSkoleGpsRequest(crossOrigin)).toBe(false);
  });

  test("trusts only the canonical www SkoleGPS production origin", () => {
    const requestFor = (origin: string) => new Request("https://www.skolegps.dk/api/family-sso/revoke", {
      method: "POST",
      headers: { Origin: origin, "Sec-Fetch-Site": "same-origin" },
    });

    expect(isTrustedSkoleGpsRequest(requestFor("https://www.skolegps.dk"))).toBe(true);
    for (const untrusted of [
      "https://skolegps.dk",
      "https://teachers.skolegps.dk",
      "https://www.skolegps.dk.attacker.com",
      "https://www.skolegps.dk:444",
      "http://www.skolegps.dk",
      "https://xn--sklegps-54a.dk",
    ]) {
      expect(isTrustedSkoleGpsRequest(requestFor(untrusted)), untrusted).toBe(false);
    }
  });

  test("keeps browser navigation free of credentials and DagensTavle free of service role access", () => {
    const startRoute = read("app", "api", "family-sso", "start", "route.ts");
    const backchannel = read("app", "api", "family-sso", "backchannel", "route.ts");
    const revokeRoute = read("app", "api", "family-sso", "revoke", "route.ts");
    const migration = read("supabase", "migrations", "202608080001_dagenstavle_family_sso.sql");

    expect(startRoute).toContain('searchParams.set("request", requestId)');
    expect(startRoute).not.toMatch(/searchParams\.set\([^)]*(?:token|email|jwt|otp|session)/i);
    expect(backchannel).toContain("generateLink");
    expect(backchannel).toContain("hashed_token");
    expect(migration).toContain("request_hash text not null unique");
    expect(migration).toContain("status = 'consumed'");
    expect(migration).toContain("revoke all on table public.family_sso_requests from public, anon, authenticated");
    for (const route of [startRoute, backchannel, revokeRoute]) {
      expect(route).not.toMatch(/console\.(?:log|info|warn|error)/);
    }
  });

  test("renders four distinct accessible tool cards without horizontal overflow", async ({ page }) => {
    test.skip(!localTeacher, "Kræver den isolerede lokale Supabase-instans.");
    await openTeacherTools(page);
    const cards = page.locator('section[aria-label="Lærerværktøjer"] article');
    await expect(cards).toHaveCount(4);
    await expect(page.getByRole("heading", { name: "DagensTavle" })).toBeVisible();
    const link = page.getByRole("link", { name: /Åbn DagensTavle.*ny fane/i });
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("href", /\/auth\/family-sso\/start/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test("keeps the four-card layout readable, aligned and keyboard visible at every review width", async ({ page }) => {
    test.skip(!localTeacher, "Requires the isolated local Supabase instance.");
    await page.setViewportSize({ width: 1024, height: 900 });
    await openTeacherTools(page);

    const reviewWidths = [
      { width: 360, rows: 4 },
      { width: 390, rows: 4 },
      { width: 768, rows: 2 },
      { width: 1024, rows: 2 },
      { width: 1366, rows: 2 },
      { width: 1920, rows: 1 },
    ];
    for (const review of reviewWidths) {
      await page.setViewportSize({ width: review.width, height: 1000 });
      const layout = await page.locator("main section[aria-label]").evaluate((section) => {
        const cards = [...section.querySelectorAll("article")];
        const rows = new Map<number, Array<{ height: number; ctaBottom: number }>>();
        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          const row = Math.round(rect.top);
          const cta = card.querySelector("a")!.getBoundingClientRect();
          rows.set(row, [...(rows.get(row) ?? []), { height: rect.height, ctaBottom: cta.bottom }]);
        }
        return {
          cardCount: cards.length,
          rowCount: rows.size,
          rowHeightsAligned: [...rows.values()].every((items) =>
            Math.max(...items.map((item) => item.height)) - Math.min(...items.map((item) => item.height)) <= 1,
          ),
          ctasAligned: [...rows.values()].every((items) =>
            Math.max(...items.map((item) => item.ctaBottom)) - Math.min(...items.map((item) => item.ctaBottom)) <= 1,
          ),
          textFits: cards.every((card) => card.scrollWidth <= card.clientWidth + 1),
          pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        };
      });
      expect(layout).toEqual({
        cardCount: 4,
        rowCount: review.rows,
        rowHeightsAligned: true,
        ctasAligned: true,
        textFits: true,
        pageFits: true,
      });
    }

    await page.setViewportSize({ width: 1920, height: 1080 });
    const dagensLink = page.locator('a[href*="/auth/family-sso/start"]');
    const normalBackground = await dagensLink.evaluate((link) => getComputedStyle(link).backgroundColor);
    await dagensLink.hover();
    await expect.poll(() => dagensLink.evaluate((link) => getComputedStyle(link).backgroundColor))
      .not.toBe(normalBackground);
    await dagensLink.focus();
    const focus = await dagensLink.evaluate((link) => ({
      active: document.activeElement === link,
      outline: getComputedStyle(link).outlineStyle,
      shadow: getComputedStyle(link).boxShadow,
    }));
    expect(focus.active).toBe(true);
    expect(focus.outline !== "none" || focus.shadow !== "none").toBe(true);

    // 512 CSS pixels is the reflow-equivalent viewport at 200% browser zoom
    // on a 1024-pixel display.
    await page.setViewportSize({ width: 512, height: 900 });
    const zoomReflow = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cards: document.querySelectorAll("main section[aria-label] article").length,
    }));
    expect(zoomReflow).toEqual({ overflow: false, cards: 4 });
  });
});
