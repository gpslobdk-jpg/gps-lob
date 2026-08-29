import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { POST as handleFamilySsoBackchannel } from "../app/api/family-sso/backchannel/route";
import { GET as handleFamilySsoStart } from "../app/api/family-sso/start/route";
import {
  getFamilySsoAudience,
  getFamilySsoExchangeSecret,
  getFamilySsoOrigin,
  getSafeDagensTavlePath,
  getSafeFamilySsoPath,
  isTrustedSkoleGpsRequest,
} from "../lib/familySso/config";
import {
  signFamilySsoBackchannel,
  verifyFamilySsoBackchannel,
} from "../lib/familySso/crypto";
import { createPrintMitIdentity, isActiveFamilySsoUser } from "../lib/familySso/identity";

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
  test("opens DagensTavle on the board through Family SSO from SkoleGPS", () => {
    const toolsPage = read("app", "dashboard", "laerervaerktoejer", "page.tsx");

    expect(toolsPage).toContain("/auth/family-sso/start?next=%2Ftavle&source=skolegps");
  });

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

  test("keeps DagensTavle as the default and adds PrintMit as a separate audience", () => {
    expect(getFamilySsoAudience(null)).toBe("dagenstavle");
    expect(getFamilySsoAudience("dagenstavle")).toBe("dagenstavle");
    expect(getFamilySsoAudience("printmitarbejdsark")).toBe("printmitarbejdsark");
    expect(getFamilySsoAudience("unknown")).toBeNull();
    expect(getSafeFamilySsoPath("printmitarbejdsark", "/projekter?fra=skolegps"))
      .toBe("/projekter?fra=skolegps");
    for (const unsafe of ["https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/%2e%2e/admin"]) {
      expect(getSafeFamilySsoPath("printmitarbejdsark", unsafe), unsafe).toBe("/lav");
    }

    const previousOrigin = process.env.PRINTMITARBEJDSARK_SSO_ORIGIN;
    const previousSecret = process.env.PRINTMITARBEJDSARK_SSO_EXCHANGE_SECRET;
    process.env.PRINTMITARBEJDSARK_SSO_ORIGIN = "https://printmitarbejdsark.vercel.app";
    process.env.PRINTMITARBEJDSARK_SSO_EXCHANGE_SECRET = "p".repeat(48);
    expect(getFamilySsoOrigin("printmitarbejdsark")).toBe("https://printmitarbejdsark.vercel.app");
    expect(getFamilySsoExchangeSecret("printmitarbejdsark")).toBe("p".repeat(48));
    process.env.PRINTMITARBEJDSARK_SSO_ORIGIN = "https://print-mit-arbejdsark-preview.vercel.app";
    expect(getFamilySsoOrigin("printmitarbejdsark"))
      .toBe("https://print-mit-arbejdsark-preview.vercel.app");
    process.env.PRINTMITARBEJDSARK_SSO_ORIGIN = "https://attacker.vercel.app";
    expect(getFamilySsoOrigin("printmitarbejdsark")).toBeNull();
    if (previousOrigin === undefined) delete process.env.PRINTMITARBEJDSARK_SSO_ORIGIN;
    else process.env.PRINTMITARBEJDSARK_SSO_ORIGIN = previousOrigin;
    if (previousSecret === undefined) delete process.env.PRINTMITARBEJDSARK_SSO_EXCHANGE_SECRET;
    else process.env.PRINTMITARBEJDSARK_SSO_EXCHANGE_SECRET = previousSecret;
  });

  test("rejects an unknown audience before any handoff or redirect", async () => {
    const startResponse = await handleFamilySsoStart(new Request(
      `https://www.skolegps.dk/api/family-sso/start?request=${"r".repeat(43)}&audience=unknown`,
    ));
    expect(startResponse.status).toBe(400);
    expect(startResponse.headers.get("location")).toBeNull();

    const backchannelResponse = await handleFamilySsoBackchannel(new Request(
      "https://www.skolegps.dk/api/family-sso/backchannel",
      {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          audience: "unknown",
          requestHash: "a".repeat(64),
          nonceHash: "b".repeat(64),
        }),
      },
    ));
    expect(backchannelResponse.status).toBe(400);
    await expect(backchannelResponse.json()).resolves.toMatchObject({ code: "INVALID_AUDIENCE" });
  });

  test("rejects an invalid PrintMit HMAC before opening database access", async () => {
    const previous = {
      familyEnabled: process.env.FAMILY_SSO_ENABLED,
      printMitEnabled: process.env.PRINTMITARBEJDSARK_ENABLED,
      printMitOrigin: process.env.PRINTMITARBEJDSARK_SSO_ORIGIN,
      printMitSecret: process.env.PRINTMITARBEJDSARK_SSO_EXCHANGE_SECRET,
    };
    process.env.FAMILY_SSO_ENABLED = "true";
    process.env.PRINTMITARBEJDSARK_ENABLED = "true";
    process.env.PRINTMITARBEJDSARK_SSO_ORIGIN = "https://printmitarbejdsark.vercel.app";
    process.env.PRINTMITARBEJDSARK_SSO_EXCHANGE_SECRET = "s".repeat(48);
    const response = await handleFamilySsoBackchannel(new Request(
      "https://www.skolegps.dk/api/family-sso/backchannel",
      {
        method: "POST",
        headers: {
          "X-Family-SSO-Timestamp": String(Date.now()),
          "X-Family-SSO-Signature": "invalid",
        },
        body: JSON.stringify({
          action: "create",
          audience: "printmitarbejdsark",
          requestHash: "a".repeat(64),
          nonceHash: "b".repeat(64),
        }),
      },
    ));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHORIZED" });
    for (const [name, value] of Object.entries({
      FAMILY_SSO_ENABLED: previous.familyEnabled,
      PRINTMITARBEJDSARK_ENABLED: previous.printMitEnabled,
      PRINTMITARBEJDSARK_SSO_ORIGIN: previous.printMitOrigin,
      PRINTMITARBEJDSARK_SSO_EXCHANGE_SECRET: previous.printMitSecret,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
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

  test("trusts only the exact SkoleGPS production and PrintMit preview origins", () => {
    const requestFor = (requestOrigin: string, origin = requestOrigin) => new Request(`${requestOrigin}/api/family-sso/revoke`, {
      method: "POST",
      headers: { Origin: origin, "Sec-Fetch-Site": "same-origin" },
    });

    expect(isTrustedSkoleGpsRequest(requestFor("https://www.skolegps.dk"))).toBe(true);
    expect(isTrustedSkoleGpsRequest(requestFor("https://skolegps-printmit-preview.vercel.app"))).toBe(true);
    expect(isTrustedSkoleGpsRequest(requestFor(
      "https://www.skolegps.dk",
      "https://skolegps-printmit-preview.vercel.app",
    ))).toBe(false);
    for (const untrusted of [
      "https://skolegps.dk",
      "https://teachers.skolegps.dk",
      "https://www.skolegps.dk.attacker.com",
      "https://www.skolegps.dk:444",
      "http://www.skolegps.dk",
      "https://xn--sklegps-54a.dk",
    ]) {
      expect(isTrustedSkoleGpsRequest(requestFor("https://www.skolegps.dk", untrusted)), untrusted).toBe(false);
    }
  });

  test("keeps browser navigation free of credentials and DagensTavle free of service role access", () => {
    const startRoute = read("app", "api", "family-sso", "start", "route.ts");
    const backchannel = read("app", "api", "family-sso", "backchannel", "route.ts");
    const revokeRoute = read("app", "api", "family-sso", "revoke", "route.ts");
    const migration = read("supabase", "migrations", "202608080001_dagenstavle_family_sso.sql");

    expect(startRoute).toContain('searchParams.set("request", requestId)');
    expect(startRoute).toContain('searchParams.set("audience", audience)');
    expect(startRoute).toContain('new URL("/login", requestUrl.origin)');
    expect(startRoute).toContain('target.searchParams.set("next"');
    expect(startRoute).toContain('audience === "printmitarbejdsark"');
    expect(startRoute).toContain('redirectToDestination(destinationOrigin, audience, requestId, "login")');
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

  test("returns a short-lived identity instead of a SkoleGPS magic token for PrintMit", () => {
    const backchannel = read("app", "api", "family-sso", "backchannel", "route.ts");
    const migration = read("supabase", "migrations", "202608080001_dagenstavle_family_sso.sql");
    const printIdentityBranch = backchannel.lastIndexOf('if (audience === "printmitarbejdsark")');

    expect(printIdentityBranch).toBeGreaterThan(0);
    expect(printIdentityBranch).toBeLessThan(backchannel.indexOf("admin.auth.admin.generateLink"));
    expect(backchannel).toContain("requestId");
    expect(backchannel).not.toMatch(/PRINTMIT.*SERVICE_ROLE|PRINTMIT.*SUPABASE_SERVICE/i);
    expect(migration).toContain("status = 'consumed'");
    expect(migration).toContain("and r.nonce_hash = p_nonce_hash");
    expect(migration).toContain("and r.destination_origin = p_destination_origin");

    expect(createPrintMitIdentity({
      subject: "11111111-1111-4111-8111-111111111111",
      email: "teacher@example.invalid",
      requestId: "r".repeat(43),
      now: 1_786_147_200_000,
    })).toEqual({
      version: 1,
      issuer: "skolegps",
      audience: "printmitarbejdsark",
      subject: "11111111-1111-4111-8111-111111111111",
      email: "teacher@example.invalid",
      issuedAt: 1_786_147_200_000,
      expiresAt: 1_786_147_290_000,
      requestId: "r".repeat(43),
    });
    expect(isActiveFamilySsoUser({
      email: "teacher@example.invalid",
      email_confirmed_at: new Date(1_700_000_000_000).toISOString(),
    }, 1_786_147_200_000)).toBe(true);
    expect(isActiveFamilySsoUser({
      email: "teacher@example.invalid",
      email_confirmed_at: new Date(1_700_000_000_000).toISOString(),
      banned_until: new Date(1_786_147_201_000).toISOString(),
    }, 1_786_147_200_000)).toBe(false);
    expect(isActiveFamilySsoUser({ email: null, email_confirmed_at: null }, 1_786_147_200_000))
      .toBe(false);
  });

  test("renders five distinct accessible tool cards without horizontal overflow", async ({ page }) => {
    test.skip(!localTeacher, "Kræver den isolerede lokale Supabase-instans.");
    await openTeacherTools(page);
    const cards = page.locator('section[aria-label="Lærerværktøjer"] article');
    await expect(cards).toHaveCount(5);
    await expect(page.getByRole("heading", { name: "PrintMitArbejdsark" })).toBeVisible();
    const printMitLink = page.getByRole("link", { name: /Åbn PrintMitArbejdsark.*ny fane/i });
    await expect(printMitLink).toHaveAttribute("rel", "noopener noreferrer");
    await expect(printMitLink).toHaveAttribute("href", /printmitarbejdsark.*\/auth\/family-sso\/start\?next=%2Flav&source=skolegps/);
    await expect(page.getByRole("heading", { name: "DagensTavle" })).toBeVisible();
    const link = page.getByRole("link", { name: /Åbn DagensTavle.*ny fane/i });
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("href", /\/auth\/family-sso\/start/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test("keeps the five-card layout readable, aligned and keyboard visible at every review width", async ({ page }) => {
    test.skip(!localTeacher, "Requires the isolated local Supabase instance.");
    await page.setViewportSize({ width: 1024, height: 900 });
    await openTeacherTools(page);

    const reviewWidths = [
      { width: 360, rows: 5 },
      { width: 390, rows: 5 },
      { width: 768, rows: 3 },
      { width: 1024, rows: 3 },
      { width: 1366, rows: 3 },
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
        cardCount: 5,
        rowCount: review.rows,
        rowHeightsAligned: true,
        ctasAligned: true,
        textFits: true,
        pageFits: true,
      });
    }

    await page.setViewportSize({ width: 1920, height: 1080 });
    const dagensLink = page.getByRole("link", { name: /Åbn DagensTavle.*ny fane/i });
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
    expect(zoomReflow).toEqual({ overflow: false, cards: 5 });
  });
});
