begin;

-- Focus Mode is an optional sidecar. No new columns, policies or triggers on
-- gameplay tables; old clients and sessions require no changes.
create table public.focus_run_settings (
  run_id uuid primary key references public.gps_runs(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.focus_session_settings (
  session_id uuid primary key references public.live_sessions(id) on delete cascade,
  enabled boolean not null default false,
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table public.focus_participant_state (
  session_id uuid not null references public.focus_session_settings(session_id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  excluded boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  event_count integer not null default 0 check (event_count between 0 and 1000),
  latest_event_id uuid,
  latest_event_at timestamptz,
  latest_duration_ms integer check (latest_duration_ms between 3000 and 1800000),
  primary key (session_id, participant_id)
);
create index focus_participant_state_participant_idx on public.focus_participant_state(participant_id);
create index focus_session_settings_expiry_idx on public.focus_session_settings(expires_at);

alter table public.focus_run_settings enable row level security;
alter table public.focus_session_settings enable row level security;
alter table public.focus_participant_state enable row level security;
revoke all on public.focus_run_settings, public.focus_session_settings, public.focus_participant_state
  from public, anon, authenticated;
grant select, insert, update, delete on public.focus_run_settings, public.focus_session_settings, public.focus_participant_state
  to service_role;

-- Only the authenticated, ownership-checked server route calls this function.
-- Lock the focus policy before the participant so an exclusion and an event
-- cannot race into counting under an old policy.
create function public.set_focus_participant_excluded(
  p_session_id uuid, p_participant_id uuid, p_excluded boolean
) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from public.focus_session_settings
  where session_id = p_session_id and expires_at > now() for update;
  if not found or p_excluded is null then return false; end if;
  if not exists (
    select 1 from public.participants p join public.live_sessions s on s.id = p.session_id
    where p.id = p_participant_id and p.session_id = p_session_id
      and s.status in ('waiting', 'scheduled', 'running', 'active', 'paused')
  ) then return false; end if;
  insert into public.focus_participant_state(session_id, participant_id, excluded, revision)
  values (p_session_id, p_participant_id, p_excluded, 1)
  on conflict (session_id, participant_id) do update
    set excluded = excluded.excluded,
        revision = focus_participant_state.revision + 1;
  return true;
end;
$$;

-- Return intervals are reduced to a count and one latest duration. The latest
-- return watermark makes duplicate/retried and out-of-order events harmless;
-- there is no detailed event log or persistent queue.
create function public.record_focus_return(
  p_session_id uuid, p_participant_id uuid, p_event_id uuid,
  p_hidden_at timestamptz, p_returned_at timestamptz,
  p_session_revision uuid, p_participant_revision integer
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  settings public.focus_session_settings%rowtype;
  participant_state public.focus_participant_state%rowtype;
  duration_ms numeric;
begin
  if p_event_id is null or p_hidden_at is null or p_returned_at is null
    or p_session_revision is null or p_participant_revision is null then return false; end if;
  duration_ms := extract(epoch from (p_returned_at - p_hidden_at)) * 1000;
  if duration_ms < 3000 or duration_ms > 1800000
    or p_returned_at > now() + interval '5 seconds'
    or p_returned_at < now() - interval '1 minute' then return false; end if;

  select * into settings from public.focus_session_settings
    where session_id = p_session_id for update;
  if not found or not settings.enabled or settings.expires_at <= now()
    or settings.revision <> p_session_revision then return false; end if;
  if not exists (
    select 1 from public.participants p join public.live_sessions s on s.id = p.session_id
    where p.id = p_participant_id and p.session_id = p_session_id
      and p.finished_at is null and s.status in ('running', 'active')
      and p_hidden_at >= s.created_at and p_hidden_at >= p.created_at
  ) then return false; end if;

  insert into public.focus_participant_state(session_id, participant_id)
    values (p_session_id, p_participant_id) on conflict do nothing;
  select * into participant_state from public.focus_participant_state
    where session_id = p_session_id and participant_id = p_participant_id for update;
  if participant_state.excluded or participant_state.revision <> p_participant_revision
    or participant_state.event_count >= 1000
    or participant_state.latest_event_id = p_event_id
    or p_hidden_at < participant_state.latest_event_at
    or p_returned_at <= participant_state.latest_event_at then return false; end if;

  update public.focus_participant_state
    set event_count = event_count + 1,
        latest_event_id = p_event_id,
        latest_event_at = p_returned_at,
        latest_duration_ms = round(duration_ms)::integer
    where session_id = p_session_id and participant_id = p_participant_id;
  return true;
end;
$$;

-- Delete only sidecar data: within 24h15m of session end, with a seven-day
-- absolute session lifetime cap. Session/run/participant deletion also cascades.
create function public.purge_expired_focus_data() returns integer
language plpgsql security definer set search_path = public
as $$
declare deleted_count integer;
begin
  delete from public.focus_session_settings f
  where f.expires_at <= now() or exists (
    select 1 from public.live_sessions s where s.id = f.session_id
      and s.status not in ('waiting', 'scheduled', 'running', 'active', 'paused')
      and s.student_data_retention_anchor_at < now() - interval '24 hours'
  );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.set_focus_participant_excluded(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.record_focus_return(uuid, uuid, uuid, timestamptz, timestamptz, uuid, integer) from public, anon, authenticated;
revoke all on function public.purge_expired_focus_data() from public, anon, authenticated;
grant execute on function public.set_focus_participant_excluded(uuid, uuid, boolean) to service_role;
grant execute on function public.record_focus_return(uuid, uuid, uuid, timestamptz, timestamptz, uuid, integer) to service_role;
grant execute on function public.purge_expired_focus_data() to service_role;

-- pg_cron is already a dependency of the existing student-data retention
-- migration. This task touches only Focus Mode's own three tables.
select cron.schedule('focus-mode-retention', '*/15 * * * *', 'select public.purge_expired_focus_data();');

comment on table public.focus_participant_state is
  'Temporary visibility aggregates only. No app/website identity, browsing history, input or device fingerprint.';

commit;
