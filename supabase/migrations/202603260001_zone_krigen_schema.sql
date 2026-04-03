-- Zone-Krigen: live team & zone state tables
-- game_teams: teams registered in a live Zone-Krig session
create table if not exists public.game_teams (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  team_name text not null,
  color text not null default '#6366f1',
  score int not null default 0,
  created_at timestamptz not null default now()
);

-- game_zones: live zone capture state during a session
create table if not exists public.game_zones (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  zone_index int not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int not null default 30,
  owner_team_id uuid references public.game_teams(id) on delete set null,
  shield_until timestamptz,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.game_teams enable row level security;
alter table public.game_zones enable row level security;

-- Participants (anon) can read teams and zones for any session
drop policy if exists "public read game_teams" on public.game_teams;
create policy "public read game_teams"
  on public.game_teams for select using (true);

drop policy if exists "public read game_zones" on public.game_zones;
create policy "public read game_zones"
  on public.game_zones for select using (true);

-- Only service role (server-side) may insert/update teams
drop policy if exists "service only insert game_teams" on public.game_teams;
create policy "service only insert game_teams"
  on public.game_teams for insert with check (false);

drop policy if exists "service only update game_teams" on public.game_teams;
create policy "service only update game_teams"
  on public.game_teams for update using (false);

-- Participants may set shield_until (anti-cheat lock) on a zone (anon update)
-- Service role bypasses RLS for all other writes
drop policy if exists "participants can shield zones" on public.game_zones;
create policy "participants can shield zones"
  on public.game_zones for update
  using (true)
  with check (shield_until is not null);

drop policy if exists "service only insert game_zones" on public.game_zones;
create policy "service only insert game_zones"
  on public.game_zones for insert with check (false);

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'game_teams'
    ) then
      alter publication supabase_realtime add table public.game_teams;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'game_zones'
    ) then
      alter publication supabase_realtime add table public.game_zones;
    end if;
  end if;
end
$$;
