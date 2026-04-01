begin;

create table if not exists public.stratego_games (
  session_id uuid primary key references public.live_sessions(id) on delete cascade,
  red_base_lat double precision not null,
  red_base_lng double precision not null,
  blue_base_lat double precision not null,
  blue_base_lng double precision not null,
  winner_team text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stratego_games_winner_team_check
    check (winner_team is null or winner_team in ('red', 'blue'))
);

create table if not exists public.stratego_role_definitions (
  rank_key text primary key,
  display_name text not null unique,
  strength integer not null,
  sort_order integer not null unique,
  is_flag boolean not null default false,
  is_bomb boolean not null default false,
  can_move boolean not null default true,
  can_move_multiple boolean not null default false,
  can_defuse_bomb boolean not null default false,
  kills_marshal_when_attacking boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stratego_role_definitions_strength_check
    check (strength between 0 and 10),
  constraint stratego_role_definitions_flag_bomb_check
    check (not (is_flag and is_bomb)),
  constraint stratego_role_definitions_multi_move_requires_move_check
    check (not can_move_multiple or can_move)
);

create table if not exists public.stratego_players (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  team_code text not null,
  rank_key text not null references public.stratego_role_definitions(rank_key),
  state text not null default 'alive',
  last_duel_at timestamptz,
  eliminated_by_participant_id uuid references public.participants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stratego_players_team_code_check
    check (team_code in ('red', 'blue')),
  constraint stratego_players_state_check
    check (state in ('alive', 'returning_to_base'))
);

create index if not exists stratego_players_session_id_idx
  on public.stratego_players (session_id);

create index if not exists stratego_players_session_team_idx
  on public.stratego_players (session_id, team_code);

create index if not exists stratego_players_session_state_idx
  on public.stratego_players (session_id, state);

create index if not exists stratego_players_session_rank_idx
  on public.stratego_players (session_id, rank_key);

create index if not exists stratego_players_eliminated_by_participant_id_idx
  on public.stratego_players (eliminated_by_participant_id);

create or replace function public.set_stratego_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stratego_games_set_updated_at on public.stratego_games;
create trigger stratego_games_set_updated_at
before update on public.stratego_games
for each row
execute function public.set_stratego_updated_at();

drop trigger if exists stratego_role_definitions_set_updated_at on public.stratego_role_definitions;
create trigger stratego_role_definitions_set_updated_at
before update on public.stratego_role_definitions
for each row
execute function public.set_stratego_updated_at();

drop trigger if exists stratego_players_set_updated_at on public.stratego_players;
create trigger stratego_players_set_updated_at
before update on public.stratego_players
for each row
execute function public.set_stratego_updated_at();

alter table public.stratego_games enable row level security;
alter table public.stratego_role_definitions enable row level security;
alter table public.stratego_players enable row level security;

revoke all on public.stratego_games from anon, authenticated;
revoke all on public.stratego_role_definitions from anon, authenticated;
revoke all on public.stratego_players from anon, authenticated;

grant select on public.stratego_games to authenticated;
grant select on public.stratego_role_definitions to anon, authenticated;
grant select on public.stratego_players to anon, authenticated;

drop policy if exists stratego_games_teacher_select on public.stratego_games;
create policy stratego_games_teacher_select
on public.stratego_games
for select
to authenticated
using (public.teacher_owns_session(session_id::text));

drop policy if exists stratego_role_definitions_public_select on public.stratego_role_definitions;
create policy stratego_role_definitions_public_select
on public.stratego_role_definitions
for select
to anon, authenticated
using (true);

drop policy if exists stratego_players_teacher_select on public.stratego_players;
create policy stratego_players_teacher_select
on public.stratego_players
for select
to authenticated
using (public.teacher_owns_session(session_id::text));

drop policy if exists stratego_players_player_select_own on public.stratego_players;
create policy stratego_players_player_select_own
on public.stratego_players
for select
to anon, authenticated
using (public.player_matches_participant(participant_id::text, session_id::text));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'stratego_games'
    ) then
      alter publication supabase_realtime add table public.stratego_games;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'stratego_players'
    ) then
      alter publication supabase_realtime add table public.stratego_players;
    end if;
  end if;
end
$$;

insert into public.stratego_role_definitions (
  rank_key,
  display_name,
  strength,
  sort_order,
  is_flag,
  is_bomb,
  can_move,
  can_move_multiple,
  can_defuse_bomb,
  kills_marshal_when_attacking
)
values
  ('flag', 'Fane', 0, 1, true, false, false, false, false, false),
  ('bomb', 'Bombe', 0, 2, false, true, false, false, false, false),
  ('spy', 'Spion', 1, 3, false, false, true, false, false, true),
  ('scout', 'Spejder', 2, 4, false, false, true, true, false, false),
  ('miner', 'Minør', 3, 5, false, false, true, false, true, false),
  ('sergeant', 'Sergent', 4, 6, false, false, true, false, false, false),
  ('lieutenant', 'Løjtnant', 5, 7, false, false, true, false, false, false),
  ('captain', 'Kaptajn', 6, 8, false, false, true, false, false, false),
  ('major', 'Major', 7, 9, false, false, true, false, false, false),
  ('colonel', 'Oberst', 8, 10, false, false, true, false, false, false),
  ('general', 'General', 9, 11, false, false, true, false, false, false),
  ('marshal', 'Feltmarskal', 10, 12, false, false, true, false, false, false)
on conflict (rank_key) do update
set
  display_name = excluded.display_name,
  strength = excluded.strength,
  sort_order = excluded.sort_order,
  is_flag = excluded.is_flag,
  is_bomb = excluded.is_bomb,
  can_move = excluded.can_move,
  can_move_multiple = excluded.can_move_multiple,
  can_defuse_bomb = excluded.can_defuse_bomb,
  kills_marshal_when_attacking = excluded.kills_marshal_when_attacking,
  updated_at = now();

commit;
