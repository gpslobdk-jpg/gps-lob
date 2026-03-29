alter table public.gps_runs
  add column if not exists grade_levels text[];
