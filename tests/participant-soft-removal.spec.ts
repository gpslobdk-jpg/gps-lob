import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const root = process.cwd();
const source = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

const migration = source(
  "supabase",
  "migrations",
  "202609100001_participant_soft_removal.sql"
);
const strictRlsMigration = source(
  "supabase",
  "migrations",
  "202603110003_strict_rls_and_cascade.sql"
);

test.describe("participant soft removal contracts", () => {
  test("migration makes removal terminal without restoring browser DELETE access", () => {
    expect(migration).toContain("add column if not exists removed_at timestamptz");
    expect(migration).toContain("participants_active_session_created_idx");
    expect(migration).toContain("where removed_at is null");
    expect(migration).toContain("create or replace function public.player_matches_participant");
    expect(migration).toContain("and p.removed_at is null");
    expect(migration).toContain("create policy participants_player_select_own");
    expect(migration).toContain("create policy participants_player_update_own");
    expect(migration).toContain("create policy answers_player_select_own");
    expect(migration).toContain("create policy answers_player_update_own");
    expect(migration).toContain("revoke delete on public.participants from anon, authenticated");
    expect(migration).toContain("revoke delete on public.answers from anon, authenticated");
    expect(migration).not.toMatch(/create policy\s+\S*delete/iu);
  });

  test("migration covers direct SQL/RPC paths that can otherwise outlive a removal", () => {
    expect(migration).toContain("require_active_answer_participant");
    expect(migration).toContain("before insert or update on public.answers");
    expect(migration).not.toContain(
      "before insert or update of participant_id, session_id on public.answers"
    );
    expect(migration).toMatch(
      /from public\.participants as p[\s\S]*?and p\.removed_at is null[\s\S]*?for update;/u
    );
    expect(migration).toContain("or new.removed_at is not null");
    expect(migration).toContain("or p.removed_at is not null");
    expect(migration).toContain("and p.removed_at is null\n      and coalesce(ls.status");
    expect(migration).toContain("set_focus_participant_excluded");
    expect(migration).toContain("record_focus_return");
    expect(migration).toContain("participants_quarantine_removed_game_state");
    expect(migration).toContain("and p.removed_at is null;");
    expect(migration).toContain("and participant.removed_at is null;");
    expect(migration).toContain("and p.removed_at is null\n  for update;");
    expect(migration).toContain("p_participant_id uuid");
    expect(migration).toContain("p.zone_krig_team_id = p_team_id");
    expect(migration).toContain(
      "capture_zone_krig(uuid, integer, uuid, timestamptz, integer, uuid)"
    );
    expect(migration).toMatch(
      /Lock the active roster[\s\S]*?from public\.participants as p[\s\S]*?order by p\.created_at, p\.id[\s\S]*?for update;/u
    );
  });

  test("active-participant helper matches the established UUID session schema", () => {
    expect(strictRlsMigration).toContain(
      "perform public._align_fk_column_type('public.participants', 'session_id', 'public.live_sessions', 'id');"
    );
    expect(strictRlsMigration).toContain(
      "perform public._align_fk_column_type('public.answers', 'session_id', 'public.live_sessions', 'id');"
    );
    expect(migration).toContain("target_session_id uuid");
    expect(migration).toContain("and p.session_id = target_session_id");
    expect(migration).toContain(
      "active_participant_exists(uuid, uuid)"
    );
  });

  test("teacher removal stays server-authorized and idempotent", () => {
    const route = source(
      "app",
      "api",
      "dashboard",
      "live",
      "participants",
      "remove",
      "route.ts"
    );

    expect(route).toContain("await createClient()");
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("session.teacher_id !== user.id");
    expect(route).toContain(".is(\"removed_at\", null)");
    expect(route).toContain("removed_at: removedAt");
    expect(route).toContain("alreadyRemoved: true");
    expect(route).not.toMatch(/from\("participants"\)[\s\S]{0,300}\.delete\(/u);
  });

  test("removed identity receives a terminal 410 rather than a fresh join or resume", () => {
    const joinRoute = source("app", "api", "join", "route.ts");
    const resolver = source("utils", "supabase", "participantServer.ts");
    const dashboard = source("app", "dashboard", "page.tsx");
    const gameState = source("components", "play", "GameState.tsx");

    expect(joinRoute).toContain("includeRemoved?: boolean");
    expect(joinRoute).toContain("PARTICIPANT_REMOVED_CODE");
    expect(joinRoute).toContain("status: 410");
    expect(resolver).toContain("status: 410");
    expect(resolver).toContain("PARTICIPANT_REMOVED_MESSAGE");
    expect(dashboard).toContain('.is("removed_at", null)');
    expect(gameState).toContain("markParticipantRemoved");
    expect(gameState).toContain("realtime_removed");
  });

  test("late play writes preserve PARTICIPANT_REMOVED and reach the terminal UI without realtime", () => {
    const gameState = source("components", "play", "GameState.tsx");
    const routePaths = [
      ["app", "api", "play", "location", "route.ts"],
      ["app", "api", "play", "skip-post", "route.ts"],
      ["app", "api", "play", "submit-answer", "route.ts"],
      ["app", "api", "play", "submit-photo", "route.ts"],
      ["app", "api", "play", "validate-answer", "route.ts"],
      ["app", "api", "play", "placements", "route.ts"],
      ["app", "api", "stratego", "player", "me", "route.ts"],
    ];

    for (const routePath of routePaths) {
      const route = source(...routePath);
      expect(route).toContain(
        "...(participantContext.code ? { code: participantContext.code } : {})"
      );
    }

    const focusRoute = source(
      "app",
      "api",
      "focus-mode",
      "participant",
      "route.ts"
    );
    expect(focusRoute).toContain("code: identity.code");
    expect(gameState).toContain("function isParticipantRemovedResponse");
    expect(gameState).toContain("answer_replay_410");
    expect(gameState).toContain("answer_submit_410");
    expect(gameState).toContain("answer_submit_legacy_410");
    expect(gameState).toContain("photo_submit_410");
    expect(gameState).toContain("skip_post_410");
    expect(gameState).toContain("validate_answer_410");
    expect(gameState).toContain("location_sync_410");
  });

  test("Zone Krig capture is bound to an active, locked participant", () => {
    const submitAnswer = source("app", "api", "play", "submit-answer", "route.ts");
    const validateAnswer = source("app", "api", "play", "validate-answer", "route.ts");

    expect(submitAnswer).toContain("p_participant_id: participantId");
    expect(validateAnswer).toContain("p_participant_id: participantId");
    expect(migration).toMatch(
      /capture_zone_krig\([\s\S]*?p_participant_id uuid[\s\S]*?from public\.participants as p[\s\S]*?p\.removed_at is null[\s\S]*?for update;/u
    );
  });

  test("Stratego respawn cannot reactivate a removed participant", () => {
    expect(migration).toMatch(
      /create or replace function public\.respawn_stratego_player\([\s\S]*?p\.removed_at is null[\s\S]*?for update of sp, p;/u
    );
    expect(migration).toMatch(
      /update public\.stratego_players[\s\S]*?and exists \([\s\S]*?p\.removed_at is null/u
    );
    expect(migration).toMatch(
      /update public\.participants[\s\S]*?spawn_shield_until[\s\S]*?and removed_at is null;/u
    );
  });

  test("Stratego ally view preserves the established accuracy column", () => {
    expect(migration).toMatch(
      /create or replace view public\.stratego_ally_view as[\s\S]*?p\.updated_at,[\s\S]*?p\.accuracy[\s\S]*?from public\.participants as p/u
    );
  });

  test("teacher projections and focus summary exclude preserved removed rows", () => {
    const roster = source("hooks", "useTeacherLiveData.ts");
    const results = source("app", "dashboard", "resultater", "[runId]", "page.tsx");
    const focus = source("lib", "focusModeServer.ts");
    const stratego = source("components", "live", "StrategoTeacherDashboard.tsx");

    expect(roster).toContain('.is("removed_at", null)');
    expect(roster).toContain("participantRow.removed_at");
    expect(results).toContain("activeParticipantIds.has(answer.participant_id)");
    expect(focus).toContain('.is("removed_at", null)');
    expect(stratego).toContain("participant.removed_at");
  });
});
