alter table public.gps_runs
  add column if not exists game_config jsonb;

update public.gps_runs
set game_config = '{}'::jsonb
where game_config is null;

alter table public.gps_runs
  alter column game_config set default '{}'::jsonb;

alter table public.gps_runs
  alter column game_config set not null;

alter table public.gps_runs
  drop constraint if exists gps_runs_game_config_object_check;

alter table public.gps_runs
  add constraint gps_runs_game_config_object_check
  check (jsonb_typeof(game_config) = 'object');

comment on column public.gps_runs.game_config is
  'Gemmer spil-specifik run-konfiguration, f.eks. Stratego base-presets.';
