alter table if exists public.live_sessions
  add column if not exists ends_at timestamptz;

update public.live_sessions
set ends_at = coalesce(ends_at, finished_at)
where coalesce(status, '') = 'finished'
  and finished_at is not null;
