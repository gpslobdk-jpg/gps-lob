import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildMarketingConsentUpdate,
  MARKETING_CONSENT_SOURCE,
  parseMarketingConsentPayload,
} from "../lib/marketingConsent";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test.describe("profile security reconciliation", () => {
  test("profiles migration grants authenticated users own-row read access only", () => {
    const migration = source(
      "supabase/migrations/202607250002_secure_profiles_access.sql"
    ).toLowerCase();

    expect(migration).toContain(
      "alter table public.profiles enable row level security;"
    );
    expect(migration).toMatch(
      /create policy profiles_select_own[\s\S]*?on public\.profiles[\s\S]*?for select[\s\S]*?to authenticated[\s\S]*?using \(auth\.uid\(\) = id\);/
    );
    expect(migration.match(/create policy /g)).toHaveLength(1);
    expect(migration).not.toMatch(
      /create policy [\s\S]*?for (insert|update|delete)[\s\S]*?to authenticated/
    );

    expect(migration).toMatch(
      /revoke all privileges on table public\.profiles\s+from public, anon, authenticated;/
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete|all privileges)[\s\S]*?to authenticated;/
    );

    const authenticatedSelectGrant = migration.match(
      /grant select \(([\s\S]*?)\)\s+on table public\.profiles\s+to authenticated;/
    );
    expect(authenticatedSelectGrant).not.toBeNull();
    const grantedColumns = (authenticatedSelectGrant?.[1] ?? "")
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);
    expect(grantedColumns).toEqual([
      "id",
      "plan_type",
      "access_expires_at",
      "has_used_free_trial",
      "stripe_customer_id",
      "stripe_current_period_end",
      "cancel_at_period_end",
      "marketing_consent",
    ]);
    expect(migration.match(/grant select \(/g)).toHaveLength(1);
    expect(migration).not.toMatch(
      /grant select\s+on table public\.profiles\s+to authenticated;/
    );
    expect(
      migration.match(/\bgrant\b[\s\S]*?\bto authenticated;/g)
    ).toHaveLength(1);
    expect(migration).toContain(
      "grant all privileges on table public.profiles to service_role;"
    );
  });

  test("marketing consent endpoint accepts only a boolean choice and owns sensitive fields", () => {
    const route = source("app/api/profile/marketing-consent/route.ts");

    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("const adminSupabase = createAdminClient()");
    expect(route).toContain("if (!adminSupabase)");
    expect(route).toContain("status: 503");
    expect(route).toContain("userId: user.id");
    expect(route).toContain("consent: payload.consent");
    expect(route).toContain("canonicalConsentText");
    expect(route).not.toContain("createAdminClient() ??");
  });

  test("marketing consent payload rejects client-controlled profile fields", () => {
    expect(parseMarketingConsentPayload({ consent: true })).toEqual({ consent: true });
    expect(parseMarketingConsentPayload({ consent: false })).toEqual({ consent: false });
    expect(parseMarketingConsentPayload({ consent: "true" })).toBeNull();
    expect(parseMarketingConsentPayload({ consent: true, id: "other-user" })).toBeNull();
    expect(
      parseMarketingConsentPayload({
        consent: true,
        marketing_consent_text: "client supplied",
      })
    ).toBeNull();
    expect(parseMarketingConsentPayload(null)).toBeNull();
  });

  test("server canonicalizes affirmative consent and withdrawal", () => {
    const now = new Date("2026-07-29T10:15:00.000Z");
    const affirmative = buildMarketingConsentUpdate({
      userId: "validated-user",
      consent: true,
      canonicalConsentText: "canonical-v1",
      now,
    });
    const withdrawn = buildMarketingConsentUpdate({
      userId: "validated-user",
      consent: false,
      canonicalConsentText: "canonical-v1",
      now,
    });

    expect(affirmative).toEqual({
      id: "validated-user",
      marketing_consent: true,
      marketing_consent_at: now.toISOString(),
      marketing_consent_text: "canonical-v1",
      marketing_consent_source: MARKETING_CONSENT_SOURCE,
    });
    expect(withdrawn).toEqual({
      id: "validated-user",
      marketing_consent: false,
      marketing_consent_at: null,
      marketing_consent_text: null,
      marketing_consent_source: MARKETING_CONSENT_SOURCE,
    });
  });

  test("signup and settings cannot write profile fields directly", () => {
    for (const relativePath of [
      "app/login/LoginPageClient.tsx",
      "app/dashboard/indstillinger/page.tsx",
    ]) {
      const client = source(relativePath);

      expect(client).toContain('fetch("/api/profile/marketing-consent"');
      expect(client).not.toMatch(/\.from\(["']profiles["']\)[\s\S]*?\.upsert/);
      expect(client).not.toContain("marketing_consent_at:");
      expect(client).not.toContain("marketing_consent_text:");
      expect(client).not.toContain("marketing_consent_source:");
    }
  });

  test("privileged plan and trial writes never fall back to a user client", () => {
    const authCallback = source("app/api/auth/callback/route.ts");
    const archive = source("app/api/archive/live-session/route.ts");
    const zoneKrig = source("app/api/zone-krig/init/route.ts");

    for (const route of [authCallback, archive, zoneKrig]) {
      expect(route).not.toContain("createAdminClient() ??");
    }

    expect(authCallback).toContain("if (profileClient)");
    expect(archive).toContain("if (shouldConsumeFreeTrial && !freeTrialProfileClient)");
    expect(zoneKrig).toContain("await markFreeTrialAsUsed(user.id, adminSupabase)");

    const adminPreflight = archive.indexOf(
      "if (shouldConsumeFreeTrial && !freeTrialProfileClient)"
    );
    const sessionMutation = archive.indexOf("const result =");
    expect(adminPreflight).toBeGreaterThan(-1);
    expect(sessionMutation).toBeGreaterThan(adminPreflight);
  });
});
