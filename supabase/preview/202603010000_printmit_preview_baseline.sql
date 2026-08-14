-- Minimal, isolated baseline for the PrintMit/SkoleGPS preview environment.
-- This file is intentionally outside supabase/migrations and must never be
-- applied to the existing SkoleGPS production database.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan_type text,
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon;
grant select, insert, update on table public.profiles to authenticated;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create table if not exists public.gps_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.gps_runs enable row level security;
revoke all on table public.gps_runs from public, anon;
grant select on table public.gps_runs to authenticated;

create policy gps_runs_select_own on public.gps_runs
for select to authenticated using (user_id = (select auth.uid()));
