begin;

alter table public.participants
  add column if not exists run_started_at timestamptz;

commit;