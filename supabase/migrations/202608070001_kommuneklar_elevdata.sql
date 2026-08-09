begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

-- A participant may read only the live-session row bound to the participant's
-- anonymous auth user. Zone Krig needs status/ends_at, while teacher ownership
-- remains covered by the existing owner policy.
grant select on table public.live_sessions to authenticated;
drop policy if exists live_sessions_participant_select on public.live_sessions;
create policy live_sessions_participant_select
on public.live_sessions
for select
to authenticated
using (id::text = public.request_session_id());

-- ---------------------------------------------------------------------------
-- Additive compatibility preparation. The bucket remains in its current
-- state until 202608070002 performs the private-Storage cutover atomically.
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  type
)
values (
  'participant-uploads',
  'participant-uploads',
  true,
  12582912,
  array['image/jpeg'],
  'STANDARD'
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.participant_photo_objects (
  answer_id uuid primary key references public.answers(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  object_path text not null unique,
  created_at timestamptz not null default now(),
  constraint participant_photo_objects_path_is_relative
    check (
      object_path <> ''
      and object_path not like '/%'
      and object_path not like '%://%'
      and object_path not like '%..%'
    )
);

create index if not exists participant_photo_objects_session_idx
  on public.participant_photo_objects(session_id);
create index if not exists participant_photo_objects_participant_idx
  on public.participant_photo_objects(participant_id);
create index if not exists participant_photo_objects_created_idx
  on public.participant_photo_objects(created_at);

alter table public.participant_photo_objects enable row level security;
revoke all privileges on table public.participant_photo_objects from public, anon, authenticated;
grant all privileges on table public.participant_photo_objects to postgres, service_role;

create table if not exists public.participant_photo_upload_limits (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  request_fingerprint text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null default 1,
  primary key (
    session_id,
    participant_id,
    request_fingerprint,
    window_started_at
  ),
  constraint participant_photo_upload_limits_fingerprint_check
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint participant_photo_upload_limits_count_check
    check (attempt_count between 1 and 6)
);

create index if not exists participant_photo_upload_limits_window_idx
  on public.participant_photo_upload_limits(window_started_at);

alter table public.participant_photo_upload_limits enable row level security;
revoke all privileges on table public.participant_photo_upload_limits
from public, anon, authenticated;
grant all privileges on table public.participant_photo_upload_limits
to postgres, service_role;

create or replace function public.consume_participant_photo_upload_limit(
  p_session_id uuid,
  p_participant_id uuid,
  p_request_fingerprint text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
  window_start timestamptz := date_trunc('minute', p_now);
begin
  if p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  if not exists (
    select 1
    from public.participants p
    join public.live_sessions ls on ls.id = p.session_id
    where p.id = p_participant_id
      and p.session_id = p_session_id
      and p.finished_at is null
      and coalesce(ls.status, '') in ('waiting', 'running', 'active', 'paused')
  ) then
    return false;
  end if;

  insert into public.participant_photo_upload_limits (
    session_id,
    participant_id,
    request_fingerprint,
    window_started_at,
    attempt_count
  ) values (
    p_session_id,
    p_participant_id,
    p_request_fingerprint,
    window_start,
    1
  )
  on conflict (session_id, participant_id, request_fingerprint, window_started_at)
  do update
    set attempt_count = participant_photo_upload_limits.attempt_count + 1
    where participant_photo_upload_limits.attempt_count < 6
  returning attempt_count into next_count;

  return coalesce(next_count, 7) <= 6;
end;
$$;

revoke all on function public.consume_participant_photo_upload_limit(uuid, uuid, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.consume_participant_photo_upload_limit(uuid, uuid, text, timestamptz)
to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Temporary GPS: 15 minutes, and immediate clearing at finish/close.
-- ---------------------------------------------------------------------------

create or replace function public.clear_finished_participant_location()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.finished_at is not null then
    new.lat := null;
    new.lng := null;
    new.accuracy := null;
  end if;
  return new;
end;
$$;

drop trigger if exists participants_clear_location_on_finish on public.participants;
create trigger participants_clear_location_on_finish
before insert or update on public.participants
for each row
execute function public.clear_finished_participant_location();

create or replace function public.clear_session_participant_locations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, '') not in ('waiting', 'running', 'active', 'paused')
    and coalesce(old.status, '') is distinct from coalesce(new.status, '') then
    update public.participants
    set
      lat = null,
      lng = null,
      accuracy = null,
      last_updated = now()
    where session_id = new.id
      and (lat is not null or lng is not null or accuracy is not null);
  end if;
  return new;
end;
$$;

drop trigger if exists live_sessions_clear_locations_on_close on public.live_sessions;
create trigger live_sessions_clear_locations_on_close
after update of status on public.live_sessions
for each row
execute function public.clear_session_participant_locations();

create or replace function public.clear_expired_participant_locations(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cleared_count integer := 0;
begin
  update public.participants as p
  set
    lat = null,
    lng = null,
    accuracy = null,
    last_updated = greatest(p.last_updated, p_now)
  where (p.lat is not null or p.lng is not null or p.accuracy is not null)
    and (
      p.finished_at is not null
      or p.last_updated is null
      or p.last_updated < p_now - interval '15 minutes'
      or not exists (
        select 1
        from public.live_sessions as ls
        where ls.id = p.session_id
          and coalesce(ls.status, '') in ('waiting', 'running', 'active', 'paused')
      )
    );

  get diagnostics cleared_count = row_count;
  return cleared_count;
end;
$$;

revoke all on function public.clear_expired_participant_locations(timestamptz) from public, anon, authenticated;
grant execute on function public.clear_expired_participant_locations(timestamptz) to postgres, service_role;

select public.clear_expired_participant_locations(now());

-- Closed-session retention is anchored to close/inactivity time, never to the
-- original creation time. Active sessions deliberately have no anchor.
alter table public.live_sessions
  add column if not exists student_data_retention_anchor_at timestamptz;

update public.live_sessions ls
set student_data_retention_anchor_at = greatest(
  ls.created_at,
  coalesce((
    select max(coalesce(p.finished_at, p.last_updated, p.created_at))
    from public.participants p
    where p.session_id = ls.id
  ), ls.created_at),
  coalesce((
    select max(coalesce(a.answered_at, a.created_at))
    from public.answers a
    where a.session_id = ls.id
  ), ls.created_at)
)
where coalesce(ls.status, '') not in ('waiting', 'running', 'active', 'paused')
  and ls.student_data_retention_anchor_at is null;

create index if not exists live_sessions_retention_anchor_idx
  on public.live_sessions(student_data_retention_anchor_at, id)
  where student_data_retention_anchor_at is not null;

create or replace function public.set_session_retention_anchor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.status, '') in ('waiting', 'running', 'active', 'paused') then
    new.student_data_retention_anchor_at := null;
  elsif new.student_data_retention_anchor_at is null
    or coalesce(old.status, '') in ('waiting', 'running', 'active', 'paused') then
    new.student_data_retention_anchor_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists live_sessions_set_retention_anchor on public.live_sessions;
create trigger live_sessions_set_retention_anchor
before insert or update of status on public.live_sessions
for each row execute function public.set_session_retention_anchor();

-- ---------------------------------------------------------------------------
-- Unified, idempotent retention. Storage deletion is coordinated by the Edge
-- function; database finalization only follows successful/missing-object delete.
-- ---------------------------------------------------------------------------

create table if not exists public.student_data_retention_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  gps_rows_cleared integer not null default 0,
  photo_objects_deleted integer not null default 0,
  sessions_deleted integer not null default 0,
  error_code text,
  constraint student_data_retention_runs_error_code_safe
    check (error_code is null or error_code ~ '^[A-Z0-9_]{1,64}$')
);

alter table public.student_data_retention_runs enable row level security;
revoke all privileges on table public.student_data_retention_runs from public, anon, authenticated;
grant all privileges on table public.student_data_retention_runs to postgres, service_role;

create unique index if not exists student_data_retention_one_running_idx
  on public.student_data_retention_runs ((1))
  where status = 'running';

create or replace function public.start_student_data_retention_run()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid;
begin
  update public.student_data_retention_runs
  set
    completed_at = now(),
    status = 'failed',
    error_code = 'STALE_RUN_RECOVERED'
  where status = 'running'
    and started_at < now() - interval '2 hours';

  begin
    insert into public.student_data_retention_runs default values
    returning id into run_id;
  exception
    when unique_violation then
      return null;
  end;

  return run_id;
end;
$$;

create or replace function public.finish_student_data_retention_run(
  p_run_id uuid,
  p_status text,
  p_gps_rows_cleared integer default 0,
  p_photo_objects_deleted integer default 0,
  p_sessions_deleted integer default 0,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid retention status';
  end if;

  update public.student_data_retention_runs
  set
    completed_at = now(),
    status = p_status,
    gps_rows_cleared = greatest(0, coalesce(p_gps_rows_cleared, 0)),
    photo_objects_deleted = greatest(0, coalesce(p_photo_objects_deleted, 0)),
    sessions_deleted = greatest(0, coalesce(p_sessions_deleted, 0)),
    error_code = case when p_status = 'failed' then p_error_code else null end
  where id = p_run_id
    and status = 'running';
end;
$$;

create or replace function public.list_student_photo_retention_candidates(
  p_now timestamptz default now(),
  p_limit integer default 200
)
returns table (
  answer_id uuid,
  object_path text
)
language sql
security definer
set search_path = public
as $$
  select ppo.answer_id, ppo.object_path
  from public.participant_photo_objects as ppo
  join public.answers as a on a.id = ppo.answer_id
  join public.live_sessions as ls on ls.id = ppo.session_id
  where coalesce(a.answered_at, a.created_at, ppo.created_at)
      < p_now - interval '30 days'
    or (
      coalesce(ls.status, '') not in ('waiting', 'running', 'active', 'paused')
      and ls.student_data_retention_anchor_at < p_now - interval '90 days'
    )
  order by ppo.created_at, ppo.answer_id
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

create or replace function public.list_student_photo_orphan_candidates(
  p_now timestamptz default now(),
  p_limit integer default 200
)
returns table (object_path text)
language sql
security definer
set search_path = public, storage
as $$
  select o.name::text
  from storage.objects o
  where o.bucket_id = 'participant-uploads'
    and coalesce(o.created_at, p_now) < p_now - interval '24 hours'
    and not exists (
      select 1
      from public.participant_photo_objects ppo
      where ppo.object_path = o.name
    )
  order by o.created_at, o.name
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

create or replace function public.finalize_student_photo_retention(
  p_answer_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cleared_count integer := 0;
begin
  if coalesce(array_length(p_answer_ids, 1), 0) = 0 then
    return 0;
  end if;

  delete from public.participant_photo_objects
  where answer_id = any(p_answer_ids);

  update public.answers
  set image_url = null
  where id = any(p_answer_ids)
    and image_url is not null;

  get diagnostics cleared_count = row_count;
  return cleared_count;
end;
$$;

create or replace function public.delete_expired_student_sessions(
  p_now timestamptz default now(),
  p_limit integer default 200
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
  expired_session_ids uuid[] := '{}';
  child_table text;
begin
  select coalesce(array_agg(expired.id), '{}')
  into expired_session_ids
  from (
      select ls.id
      from public.live_sessions as ls
      where coalesce(ls.status, '') not in ('waiting', 'running', 'active', 'paused')
        and ls.student_data_retention_anchor_at < p_now - interval '90 days'
        and not exists (
          select 1
          from public.participant_photo_objects as ppo
          where ppo.session_id = ls.id
        )
      order by ls.created_at, ls.id
      limit greatest(1, least(coalesce(p_limit, 200), 1000))
  ) as expired;

  if coalesce(array_length(expired_session_ids, 1), 0) = 0 then
    return 0;
  end if;

  foreach child_table in array array[
    'answers',
    'participants',
    'session_students',
    'session_messages',
    'messages'
  ]
  loop
    if to_regclass('public.' || child_table) is not null then
      execute format(
        'delete from public.%I where session_id::text = any ($1)',
        child_table
      ) using expired_session_ids::text[];
    end if;
  end loop;

  delete from public.live_sessions
  where id = any(expired_session_ids);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.delete_expired_retention_job_logs(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.student_data_retention_runs
  where started_at < p_now - interval '30 days';
  get diagnostics deleted_count = row_count;

  delete from public.participant_photo_upload_limits
  where window_started_at < p_now - interval '1 day';

  if to_regclass('public.telemetry_logs') is not null then
    execute 'delete from public.telemetry_logs where created_at < $1 - interval ''30 days'''
      using p_now;
  end if;

  return deleted_count;
end;
$$;

revoke all on function public.start_student_data_retention_run() from public, anon, authenticated;
revoke all on function public.finish_student_data_retention_run(uuid, text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.list_student_photo_retention_candidates(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.list_student_photo_orphan_candidates(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.finalize_student_photo_retention(uuid[]) from public, anon, authenticated;
revoke all on function public.delete_expired_student_sessions(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.delete_expired_retention_job_logs(timestamptz) from public, anon, authenticated;

grant execute on function public.start_student_data_retention_run() to postgres, service_role;
grant execute on function public.finish_student_data_retention_run(uuid, text, integer, integer, integer, text) to postgres, service_role;
grant execute on function public.list_student_photo_retention_candidates(timestamptz, integer) to postgres, service_role;
grant execute on function public.list_student_photo_orphan_candidates(timestamptz, integer) to postgres, service_role;
grant execute on function public.finalize_student_photo_retention(uuid[]) to postgres, service_role;
grant execute on function public.delete_expired_student_sessions(timestamptz, integer) to postgres, service_role;
grant execute on function public.delete_expired_retention_job_logs(timestamptz) to postgres, service_role;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'student_data_retention_cron_secret'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'student_data_retention_cron_secret',
      'Shared secret for the unified student-data retention Edge function'
    );
  end if;
end
$$;

create or replace function public.get_student_data_retention_cron_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_value text;
begin
  select decrypted_secret
  into secret_value
  from vault.decrypted_secrets
  where name = 'student_data_retention_cron_secret'
  limit 1;

  if secret_value is null then
    raise exception 'student_data_retention_cron_secret is not configured';
  end if;
  return secret_value;
end;
$$;

revoke all on function public.get_student_data_retention_cron_secret() from public, anon, authenticated;
grant execute on function public.get_student_data_retention_cron_secret() to postgres, service_role;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'participant-uploads-retention-daily',
      'student-gps-retention-every-five-minutes',
      'student-data-retention-daily'
    )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end
$$;

create or replace function public.configure_student_data_retention_cron(
  p_edge_function_url text
)
returns void
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  existing_job record;
  normalized_url text := btrim(coalesce(p_edge_function_url, ''));
begin
  if normalized_url !~ '^https://[^[:space:]]+/functions/v1/student-data-retention$' then
    raise exception 'A valid HTTPS student-data-retention function URL is required';
  end if;

  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'student-gps-retention-every-five-minutes',
      'student-data-retention-daily'
    )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'student-gps-retention-every-five-minutes',
    '*/5 * * * *',
    'select public.clear_expired_participant_locations(now());'
  );

  perform cron.schedule(
    'student-data-retention-daily',
    '17 3 * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-student-data-retention-secret', public.get_student_data_retention_cron_secret()
        ),
        body := jsonb_build_object('source', 'pg_cron'),
        timeout_milliseconds := 30000
      ) as request_id;
      $job$,
      normalized_url
    )
  );
end;
$$;

revoke all on function public.configure_student_data_retention_cron(text) from public, anon, authenticated, service_role;
grant execute on function public.configure_student_data_retention_cron(text) to postgres;

commit;
