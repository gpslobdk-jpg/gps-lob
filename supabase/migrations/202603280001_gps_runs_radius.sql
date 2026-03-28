alter table public.gps_runs
  add column if not exists radius int not null default 15;