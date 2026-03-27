alter table public.live_sessions
  add column if not exists gps_override boolean;

update public.live_sessions
set gps_override = false
where gps_override is null;

alter table public.live_sessions
  alter column gps_override set default false;

alter table public.live_sessions
  alter column gps_override set not null;