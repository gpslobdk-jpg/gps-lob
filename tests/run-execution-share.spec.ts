import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildRunExecutionShareLink,
  isSupportedRunExecutionShareRaceType,
  normalizeRunExecutionShareToken,
  RUN_EXECUTION_SHARE_PATH,
  SUPPORTED_RUN_EXECUTION_SHARE_RACE_TYPES,
} from "../lib/runExecutionShare";
import {
  generateRunExecutionShareToken,
  hashRunExecutionShareToken,
} from "../lib/runExecutionShareServer";
import { filterPrivacySafeAnalyticsEvent } from "../components/PrivacySafeAnalytics";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test.describe("Del til afvikling security contract", () => {
  test("supports only the five approved standard run types", () => {
    expect([...SUPPORTED_RUN_EXECUTION_SHARE_RACE_TYPES]).toEqual([
      "manuel",
      "dansk",
      "engelsk",
      "matematik",
      "foto",
    ]);

    for (const raceType of SUPPORTED_RUN_EXECUTION_SHARE_RACE_TYPES) {
      expect(isSupportedRunExecutionShareRaceType(raceType)).toBe(true);
    }

    for (const raceType of [
      "scanner",
      "selfie",
      "escape",
      "rollespil",
      "podcast",
      "zone_krig",
      "stratego",
      "musikquiz",
      "find_bedrageren",
      null,
    ]) {
      expect(isSupportedRunExecutionShareRaceType(raceType)).toBe(false);
    }
  });

  test("generates a high-entropy one-time token and stores only its digest", () => {
    const first = generateRunExecutionShareToken();
    const second = generateRunExecutionShareToken();
    const digest = hashRunExecutionShareToken(first);

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(normalizeRunExecutionShareToken(first)).toBe(first);
    expect(normalizeRunExecutionShareToken(`${first}x`)).toBeNull();
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(first);
  });

  test("places the bearer secret in the URL fragment, never path or query", () => {
    const token = generateRunExecutionShareToken();
    const link = buildRunExecutionShareLink("https://skolegps.dk/dashboard", token);

    expect(link).toBe(`https://skolegps.dk${RUN_EXECUTION_SHARE_PATH}#${token}`);
    const parsed = new URL(link!);
    expect(parsed.pathname).toBe(RUN_EXECUTION_SHARE_PATH);
    expect(parsed.search).toBe("");
    expect(parsed.hash).toBe(`#${token}`);
  });

  test("migration creates revocable shares and one idempotent claim per teacher", () => {
    const migration = source(
      "supabase/migrations/202608050001_gps_run_execution_shares.sql"
    ).toLowerCase();

    expect(migration).toContain("create table public.gps_run_execution_shares");
    expect(migration).toContain("create table public.gps_run_execution_share_claims");
    expect(migration).toContain("primary key (share_id, teacher_id)");
    expect(migration).toContain("copied_run_id uuid unique");
    expect(migration).toContain("on delete set null");
    expect(migration).toContain("copy_deleted boolean");
    expect(migration).toContain("where revoked_at is null");
    expect(migration).toContain("for update");
    expect(migration).toContain("for share");
    expect(migration).toContain("preview_gps_run_execution_share");
    expect(migration).toContain(
      "v_source_owner_id is distinct from v_share_owner_id"
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("force row level security");
    expect(migration).toContain(
      "from public, anon, authenticated, service_role"
    );
    expect(migration).toContain(
      "grant select on table public.gps_run_execution_shares to service_role"
    );
    expect(migration).not.toContain("grant all privileges");
  });

  test("atomic copy uses an explicit material-only gps_runs column list", () => {
    const migration = source(
      "supabase/migrations/202608050001_gps_run_execution_shares.sql"
    ).toLowerCase();
    const copyStatement = migration.match(
      /insert into public\.gps_runs\s*\(([\s\S]*?)\)\s*select([\s\S]*?)from public\.gps_runs gr/
    );

    expect(copyStatement).not.toBeNull();
    const columns = (copyStatement?.[1] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    expect(columns).toEqual([
      "user_id",
      "title",
      "subject",
      "description",
      "topic",
      "questions",
      "grade_levels",
      "radius",
      "race_type",
      "game_config",
      "bonus_enabled",
      "post_order_mode",
    ]);

    const insertBody = copyStatement?.[0] ?? "";
    for (const forbiddenTable of [
      "live_sessions",
      "participants",
      "answers",
      "bonus_questions",
      "find_bedrageren_games",
      "participant-uploads",
    ]) {
      expect(insertBody).not.toContain(forbiddenTable);
    }
    expect(insertBody).toContain(
      "public.strip_gps_run_execution_schedule(gr.description)"
    );
    expect(insertBody).toContain(
      "public.strip_gps_run_execution_schedule(gr.topic)"
    );
  });

  test("schedule stripping requires the stored SkoleGPS timestamp shape", () => {
    const migration = source(
      "supabase/migrations/202608050001_gps_run_execution_shares.sql"
    );

    expect(migration).toContain("jsonb_typeof(v_schedule_candidate) = 'object'");
    expect(migration).toContain("v_start_is_valid or v_end_is_valid");
    expect(migration).toContain("::timestamptz");
    expect(migration).toContain("v_schedule_candidate ? 'startAt'");
    expect(migration).toContain("v_schedule_candidate ? 'endAt'");
    expect(migration).toContain("return p_description");
    expect(migration).toContain("[gpslob_schedule");
  });

  test("isolated database plan covers tombstones, ownership, races, and copy boundaries", () => {
    const plan = source("docs/run-execution-share-db-test-plan.md");

    for (const contract of [
      "copied_run_id is null",
      "To claims",
      "Revoke mod claim",
      "To rotationer",
      "Source-sletning mod claim",
      "Flere lærere",
      "Ejerskab og metadata",
      "sessions-",
      "deltager-",
      "elevpayloads",
    ]) {
      expect(plan).toContain(contract);
    }
    expect(plan).toContain("må aldrig køres mod produktion");
  });

  test("API authenticates owners and claimants without logging raw request data", () => {
    const route = source("app/api/run-execution-share/route.ts");

    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("fetchOwnedRun");
    expect(route).toContain("create_gps_run_execution_share");
    expect(route).toContain("revoke_gps_run_execution_share");
    expect(route).toContain("claim_gps_run_execution_share");
    expect(route).toContain("preview_gps_run_execution_share");
    expect(route).toContain(
      "Du har tidligere hentet dette løb, men din kopi er siden blevet slettet."
    );
    expect(route).toContain("terminal: true");
    expect(route).not.toContain("copiedRunId");
    expect(route).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(route).not.toMatch(/console\.(log|info|warn|error)/);
    expect(route).not.toContain("request.url +");
    expect(route).not.toContain("requestUrl.href");
  });

  test("recipient removes the fragment before preview and preserves it only for login return", () => {
    const client = source("app/del/afvikling/RunExecutionShareClient.tsx");
    const layout = source("app/del/layout.tsx");
    const fragmentRead = client.indexOf("window.location.hash");
    const fragmentRemoval = client.indexOf("window.history.replaceState");
    const featureEvaluation = client.indexOf(
      "const featureEnabled = isRunExecutionSharingEnabled()"
    );
    const featureCheck = client.indexOf("if (!featureEnabled)");
    const loginHandler = client.indexOf("const handleLogin");
    const effectBody = client.slice(client.indexOf("useEffect"), loginHandler);

    expect(fragmentRead).toBeGreaterThan(-1);
    expect(fragmentRemoval).toBeGreaterThan(fragmentRead);
    expect(featureEvaluation).toBeGreaterThan(fragmentRemoval);
    expect(featureCheck).toBeGreaterThan(fragmentRemoval);
    expect(client).toContain("window.sessionStorage.setItem");
    expect(client).toContain("window.sessionStorage.removeItem");
    expect(effectBody).not.toContain("window.sessionStorage.setItem");
    expect(client.indexOf("window.sessionStorage.setItem")).toBeGreaterThan(
      loginHandler
    );
    expect(client).toMatch(/hadFragment\s*\?\s*null/);
    expect(client).toContain("body.terminal");
    expect(client).toContain('action: "preview"');
    expect(client).toContain('action: "claim"');
    expect(client).toContain("LOG IND FOR AT FORTSÆTTE");
    expect(client).toContain("OPRET MIN KOPI");
    expect(layout).toContain('import { AuthProvider } from "@/components/AuthProvider"');
    expect(layout).toContain("<AuthProvider>{children}</AuthProvider>");
  });

  test("owner UI explains independent copies and one-time link display", () => {
    const modal = source("components/archive/RunExecutionShareModal.tsx");

    expect(modal).toContain("Dit originale løb ændres ikke");
    expect(modal).toContain("Linket kan bruges af flere lærere");
    expect(modal).toContain("OPRET DELINGSLINK");
    expect(modal).toContain("KOPIÉR LINK");
    expect(modal).toContain("DEAKTIVÉR LINK");
    expect(modal).toContain("kan derfor ikke vises igen");
  });

  test("feature is default-off and sensitive routes bypass analytics and cache", () => {
    const envExample = source(".env.example");
    const analytics = source("components/PrivacySafeAnalytics.tsx");
    const bugsnag = source("utils/observability.ts");
    const nextConfig = source("next.config.ts");

    expect(envExample).toContain("NEXT_PUBLIC_RUN_EXECUTION_SHARING_ENABLED=false");
    expect(analytics).toContain("RUN_EXECUTION_SHARE_PATH");
    expect(analytics).toContain("return null");
    expect(analytics).toContain("return event");
    expect(analytics).not.toContain("sanitizeObservabilityUrl");
    expect(bugsnag).toContain(
      'window.location.pathname === "/del/afvikling"'
    );
    expect(nextConfig).toContain('url.pathname === "/del/afvikling"');
    expect(nextConfig).toContain('handler: "NetworkOnly"');
    expect(nextConfig).toContain('value: "no-store, max-age=0"');
    expect(nextConfig).toContain('value: "no-referrer"');
    expect(nextConfig).toContain('value: "noindex, nofollow, noarchive"');
  });

  test("drops share analytics while preserving ordinary analytics events", () => {
    const shareEvent = {
      type: "pageview",
      url: "https://skolegps.dk/del/afvikling?ignored=1#secret",
    } as Parameters<typeof filterPrivacySafeAnalyticsEvent>[0];
    const ordinaryEvent = {
      type: "pageview",
      url: "https://skolegps.dk/dashboard/arkiv?filter=foto#oversigt",
    } as Parameters<typeof filterPrivacySafeAnalyticsEvent>[0];

    expect(filterPrivacySafeAnalyticsEvent(shareEvent)).toBeNull();
    expect(filterPrivacySafeAnalyticsEvent(ordinaryEvent)).toBe(
      ordinaryEvent
    );
    expect(ordinaryEvent.url).toContain("?filter=foto#oversigt");
  });
});
