import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202609140001_live_lobby_rls_recursion_fix.sql"),
  "utf8"
);

test("teacher lobby ownership check cannot recurse through live-session RLS", () => {
  expect(migration).toContain("create or replace function public.teacher_owns_session");
  expect(migration).toContain("security definer");
  expect(migration).toContain("set row_security = off");
  expect(migration).toContain("set search_path = public, pg_temp");
  expect(migration).toContain("auth.uid() is not null");
  expect(migration).toContain("gr.user_id = auth.uid()");
  expect(migration).toContain("revoke all on function public.teacher_owns_session(text) from public");
  expect(migration).toContain("to authenticated, service_role");
});
