create table if not exists public.worksheet_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  title text not null,
  subject text not null,
  grade text not null,
  brief jsonb not null,
  document jsonb not null,
  schema_version integer not null default 2,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (user_id, project_id),
  constraint worksheet_projects_project_id_length check (char_length(project_id) between 1 and 80),
  constraint worksheet_projects_title_length check (char_length(title) between 1 and 120),
  constraint worksheet_projects_subject_length check (char_length(subject) between 1 and 80),
  constraint worksheet_projects_grade_length check (char_length(grade) between 1 and 40),
  constraint worksheet_projects_schema_version check (schema_version = 2),
  constraint worksheet_projects_version_positive check (version > 0),
  constraint worksheet_projects_brief_object check (jsonb_typeof(brief) = 'object'),
  constraint worksheet_projects_document_object check (jsonb_typeof(document) = 'object')
);

create index if not exists worksheet_projects_user_updated_idx
  on public.worksheet_projects (user_id, updated_at desc)
  where archived_at is null;

create or replace function public.touch_worksheet_project()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.user_id := old.user_id;
  new.project_id := old.project_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists worksheet_projects_touch on public.worksheet_projects;
create trigger worksheet_projects_touch
before update on public.worksheet_projects
for each row execute function public.touch_worksheet_project();

alter table public.worksheet_projects enable row level security;
revoke all on table public.worksheet_projects from public, anon;
grant select, insert, update, delete on table public.worksheet_projects to authenticated;

drop policy if exists worksheet_projects_select_own on public.worksheet_projects;
create policy worksheet_projects_select_own on public.worksheet_projects
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists worksheet_projects_insert_own on public.worksheet_projects;
create policy worksheet_projects_insert_own on public.worksheet_projects
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists worksheet_projects_update_own on public.worksheet_projects;
create policy worksheet_projects_update_own on public.worksheet_projects
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists worksheet_projects_delete_own on public.worksheet_projects;
create policy worksheet_projects_delete_own on public.worksheet_projects
for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.worksheet_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  project_id text,
  provider text not null,
  model text not null,
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed')),
  duration_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, request_id),
  constraint worksheet_generation_project_id_length check (project_id is null or char_length(project_id) between 1 and 80),
  constraint worksheet_generation_provider_length check (char_length(provider) between 1 and 40),
  constraint worksheet_generation_model_length check (char_length(model) between 1 and 100),
  constraint worksheet_generation_duration check (duration_ms is null or duration_ms >= 0)
);

create index if not exists worksheet_generation_events_user_created_idx
  on public.worksheet_generation_events (user_id, created_at desc);

alter table public.worksheet_generation_events enable row level security;
revoke all on table public.worksheet_generation_events from public, anon, authenticated;
grant all privileges on table public.worksheet_generation_events to service_role;

create or replace function public.reserve_worksheet_generation(
  p_request_id uuid,
  p_provider text,
  p_model text,
  p_hourly_limit integer default 20
)
returns table (decision text, current_status text, project_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.worksheet_generation_events%rowtype;
  v_recent_count integer;
  v_limit integer := greatest(1, least(coalesce(p_hourly_limit, 20), 100));
  v_provider text;
  v_model text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_request_id is null or nullif(btrim(p_provider), '') is null or nullif(btrim(p_model), '') is null then
    raise exception 'invalid generation reservation' using errcode = '22023';
  end if;

  v_provider := left(btrim(p_provider), 40);
  v_model := left(btrim(p_model), 100);
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  update public.worksheet_generation_events
  set status = 'failed', completed_at = now()
  where user_id = v_user_id
    and status = 'reserved'
    and created_at < now() - interval '2 minutes';

  select * into v_existing
  from public.worksheet_generation_events e
  where e.user_id = v_user_id and e.request_id = p_request_id;
  if found then
    return query select 'duplicate'::text, v_existing.status, v_existing.project_id;
    return;
  end if;

  if exists (
    select 1 from public.worksheet_generation_events e
    where e.user_id = v_user_id and e.status = 'reserved'
  ) then
    return query select 'rate_limited'::text, null::text, null::text;
    return;
  end if;

  select count(*)::integer into v_recent_count
  from public.worksheet_generation_events e
  where e.user_id = v_user_id
    and e.provider = v_provider
    and e.created_at >= now() - interval '1 hour';
  if v_recent_count >= v_limit then
    return query select 'rate_limited'::text, null::text, null::text;
    return;
  end if;

  insert into public.worksheet_generation_events (user_id, request_id, provider, model)
  values (v_user_id, p_request_id, v_provider, v_model);
  return query select 'reserved'::text, 'reserved'::text, null::text;
end;
$$;

create or replace function public.complete_worksheet_generation(
  p_request_id uuid,
  p_status text,
  p_project_id text default null,
  p_duration_ms integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid completion status' using errcode = '22023';
  end if;

  update public.worksheet_generation_events e
  set status = p_status,
      project_id = left(nullif(btrim(p_project_id), ''), 80),
      duration_ms = case when p_duration_ms is null then null else greatest(p_duration_ms, 0) end,
      completed_at = now()
  where e.user_id = v_user_id
    and e.request_id = p_request_id
    and e.status = 'reserved'
  returning e.id into v_event_id;
  return v_event_id is not null;
end;
$$;

revoke all on function public.touch_worksheet_project() from public, anon, authenticated;
revoke all on function public.reserve_worksheet_generation(uuid, text, text, integer) from public, anon;
revoke all on function public.complete_worksheet_generation(uuid, text, text, integer) from public, anon;
grant execute on function public.reserve_worksheet_generation(uuid, text, text, integer) to authenticated, service_role;
grant execute on function public.complete_worksheet_generation(uuid, text, text, integer) to authenticated, service_role;

comment on table public.worksheet_projects is
  'Private PrintMitArbejdsark projects scoped to the authenticated teacher identity.';
comment on table public.worksheet_generation_events is
  'Minimal generation metadata for distributed idempotency, quota and active-request locking; no prompts or documents.';
