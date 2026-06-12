begin;

create extension if not exists pgcrypto;

-- Allow the new non-GPS game type in archived runs.
alter table public.gps_runs
  drop constraint if exists gps_runs_race_type_check;

alter table public.gps_runs
  add constraint gps_runs_race_type_check
  check (
    race_type in (
      'manuel',
      'dansk',
      'engelsk',
      'matematik',
      'foto',
      'scanner',
      'selfie',
      'escape',
      'rollespil',
      'podcast',
      'zone_krig',
      'stratego',
      'musikquiz',
      'find_bedrageren'
    )
  );

create table if not exists public.find_bedrageren_games (
  id uuid primary key default gen_random_uuid(),
  gps_run_id uuid not null
    references public.gps_runs(id)
    on delete cascade,
  secret_word text not null,
  impostor_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint find_bedrageren_games_gps_run_unique
    unique (gps_run_id),

  constraint find_bedrageren_games_secret_word_not_empty
    check (btrim(secret_word) <> ''),

  constraint find_bedrageren_games_secret_word_length_check
    check (char_length(btrim(secret_word)) <= 120),

  constraint find_bedrageren_games_impostor_count_check
    check (impostor_count between 1 and 50)
);

create table if not exists public.find_bedrageren_sessions (
  live_session_id uuid primary key
    references public.live_sessions(id)
    on delete cascade,
  gps_run_id uuid not null
    references public.gps_runs(id)
    on delete cascade,
  game_id uuid not null
    references public.find_bedrageren_games(id)
    on delete cascade,
  phase text not null default 'lobby',
  secret_word_snapshot text not null,
  impostor_count_snapshot integer not null,
  roles_assigned_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint find_bedrageren_sessions_phase_check
    check (phase in ('lobby', 'reveal', 'discussion', 'voting', 'results', 'finished')),

  constraint find_bedrageren_sessions_secret_word_snapshot_not_empty
    check (btrim(secret_word_snapshot) <> ''),

  constraint find_bedrageren_sessions_secret_word_snapshot_length_check
    check (char_length(btrim(secret_word_snapshot)) <= 120),

  constraint find_bedrageren_sessions_impostor_count_snapshot_check
    check (impostor_count_snapshot between 1 and 50),

  constraint find_bedrageren_sessions_finished_phase_check
    check (
      (phase = 'finished' and finished_at is not null)
      or (phase <> 'finished')
    )
);

create table if not exists public.find_bedrageren_players (
  participant_id uuid primary key
    references public.participants(id)
    on delete cascade,
  live_session_id uuid not null
    references public.live_sessions(id)
    on delete cascade,
  student_name text not null,
  player_role text not null,
  has_seen_role boolean not null default false,
  role_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint find_bedrageren_players_session_participant_unique
    unique (live_session_id, participant_id),

  constraint find_bedrageren_players_student_name_not_empty
    check (btrim(student_name) <> ''),

  constraint find_bedrageren_players_role_check
    check (player_role in ('civilian', 'impostor')),

  constraint find_bedrageren_players_seen_role_consistency_check
    check (
      (has_seen_role = false and role_seen_at is null)
      or (has_seen_role = true and role_seen_at is not null)
    )
);

create table if not exists public.find_bedrageren_votes (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null
    references public.live_sessions(id)
    on delete cascade,
  voter_participant_id uuid not null
    references public.participants(id)
    on delete cascade,
  suspect_participant_id uuid not null
    references public.participants(id)
    on delete cascade,
  created_at timestamptz not null default now(),

  constraint find_bedrageren_votes_one_vote_per_participant
    unique (live_session_id, voter_participant_id),

  constraint find_bedrageren_votes_no_self_vote_check
    check (voter_participant_id <> suspect_participant_id)
);

create index if not exists find_bedrageren_sessions_gps_run_id_idx
  on public.find_bedrageren_sessions (gps_run_id);

create index if not exists find_bedrageren_sessions_game_id_idx
  on public.find_bedrageren_sessions (game_id);

create index if not exists find_bedrageren_players_live_session_id_idx
  on public.find_bedrageren_players (live_session_id);

create index if not exists find_bedrageren_players_session_role_idx
  on public.find_bedrageren_players (live_session_id, player_role);

create index if not exists find_bedrageren_votes_live_session_id_idx
  on public.find_bedrageren_votes (live_session_id);

create index if not exists find_bedrageren_votes_suspect_participant_id_idx
  on public.find_bedrageren_votes (suspect_participant_id);

create or replace function public.set_find_bedrageren_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists find_bedrageren_games_set_updated_at on public.find_bedrageren_games;
create trigger find_bedrageren_games_set_updated_at
before update on public.find_bedrageren_games
for each row
execute function public.set_find_bedrageren_updated_at();

drop trigger if exists find_bedrageren_sessions_set_updated_at on public.find_bedrageren_sessions;
create trigger find_bedrageren_sessions_set_updated_at
before update on public.find_bedrageren_sessions
for each row
execute function public.set_find_bedrageren_updated_at();

drop trigger if exists find_bedrageren_players_set_updated_at on public.find_bedrageren_players;
create trigger find_bedrageren_players_set_updated_at
before update on public.find_bedrageren_players
for each row
execute function public.set_find_bedrageren_updated_at();

alter table public.find_bedrageren_games enable row level security;
alter table public.find_bedrageren_sessions enable row level security;
alter table public.find_bedrageren_players enable row level security;
alter table public.find_bedrageren_votes enable row level security;

revoke all on public.find_bedrageren_games from anon, authenticated;
revoke all on public.find_bedrageren_sessions from anon, authenticated;
revoke all on public.find_bedrageren_players from anon, authenticated;
revoke all on public.find_bedrageren_votes from anon, authenticated;

comment on table public.find_bedrageren_games is
  'Find Bedrageren game config. Stores the secret word outside generic gps_runs fields.';

comment on column public.find_bedrageren_games.secret_word is
  'Secret word. Must never be copied into gps_runs.questions or returned to impostors.';

comment on table public.find_bedrageren_sessions is
  'Per-live-session Find Bedrageren state, including phase and immutable game snapshots.';

comment on column public.find_bedrageren_sessions.secret_word_snapshot is
  'Session snapshot of the secret word. Kept in game-specific service-only table.';

comment on table public.find_bedrageren_players is
  'Per-participant role state for Find Bedrageren.';

comment on table public.find_bedrageren_votes is
  'Voting state. Unique constraint allows one vote per participant per live session.';

commit;
