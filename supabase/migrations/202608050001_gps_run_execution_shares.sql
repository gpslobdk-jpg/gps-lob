begin;

create extension if not exists pgcrypto;

create table public.gps_run_execution_shares (
  id uuid primary key default gen_random_uuid(),
  source_run_id uuid not null
    references public.gps_runs(id)
    on delete cascade,
  owner_id uuid not null
    references auth.users(id)
    on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint gps_run_execution_shares_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$')
);

create unique index gps_run_execution_shares_one_active_per_run_idx
  on public.gps_run_execution_shares (source_run_id)
  where revoked_at is null;

create index gps_run_execution_shares_owner_idx
  on public.gps_run_execution_shares (owner_id, created_at desc);

create table public.gps_run_execution_share_claims (
  share_id uuid not null
    references public.gps_run_execution_shares(id)
    on delete cascade,
  teacher_id uuid not null
    references auth.users(id)
    on delete cascade,
  copied_run_id uuid unique
    references public.gps_runs(id)
    on delete set null,
  claimed_at timestamptz not null default now(),
  primary key (share_id, teacher_id)
);

create index gps_run_execution_share_claims_teacher_idx
  on public.gps_run_execution_share_claims (teacher_id, claimed_at desc);

alter table public.gps_run_execution_shares enable row level security;
alter table public.gps_run_execution_shares force row level security;
alter table public.gps_run_execution_share_claims enable row level security;
alter table public.gps_run_execution_share_claims force row level security;

revoke all privileges on table public.gps_run_execution_shares
  from public, anon, authenticated, service_role;
revoke all privileges on table public.gps_run_execution_share_claims
  from public, anon, authenticated, service_role;

grant select on table public.gps_run_execution_shares to service_role;

create or replace function public.strip_gps_run_execution_schedule(
  p_description text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_json jsonb;
  v_clean jsonb;
  v_schedule_candidate jsonb;
  v_marker_payload text;
  v_without_marker text;
  v_has_valid_schedule boolean;
  v_start_is_valid boolean;
  v_end_is_valid boolean;
begin
  if p_description is null then
    return null;
  end if;

  v_marker_payload := substring(
    p_description from E'\\[gpslob_schedule\\](\\{[^\\r\\n]*\\})\\s*$'
  );

  if v_marker_payload is not null then
    begin
      v_schedule_candidate := v_marker_payload::jsonb;
    exception
      when others then
        return p_description;
    end;

    v_start_is_valid := coalesce(
      jsonb_typeof(v_schedule_candidate -> 'startAt') = 'string'
      and (v_schedule_candidate ->> 'startAt') ~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$',
      false
    );
    v_end_is_valid := coalesce(
      jsonb_typeof(v_schedule_candidate -> 'endAt') = 'string'
      and (v_schedule_candidate ->> 'endAt') ~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$',
      false
    );
    if v_start_is_valid then
      begin
        perform (v_schedule_candidate ->> 'startAt')::timestamptz;
      exception
        when others then
          v_start_is_valid := false;
      end;
    end if;
    if v_end_is_valid then
      begin
        perform (v_schedule_candidate ->> 'endAt')::timestamptz;
      exception
        when others then
          v_end_is_valid := false;
      end;
    end if;
    v_has_valid_schedule :=
      jsonb_typeof(v_schedule_candidate) = 'object'
      and (v_start_is_valid or v_end_is_valid)
      and (
        not (v_schedule_candidate ? 'startAt')
        or v_schedule_candidate -> 'startAt' = 'null'::jsonb
        or v_start_is_valid
      )
      and (
        not (v_schedule_candidate ? 'endAt')
        or v_schedule_candidate -> 'endAt' = 'null'::jsonb
        or v_end_is_valid
      );

    if not v_has_valid_schedule then
      return p_description;
    end if;

    v_without_marker := regexp_replace(
      p_description,
      E'\\s*\\[gpslob_schedule\\]\\{[^\\r\\n]*\\}\\s*$',
      '',
      'n'
    );

    return rtrim(v_without_marker);
  end if;

  begin
    v_json := p_description::jsonb;
  exception
    when others then
      return p_description;
  end;

  if jsonb_typeof(v_json) <> 'object' then
    return p_description;
  end if;

  if v_json ? 'schedule' then
    v_schedule_candidate := v_json -> 'schedule';
  elsif v_json ? 'gpslobSchedule' then
    v_schedule_candidate := v_json -> 'gpslobSchedule';
  elsif v_json ? 'startAt' or v_json ? 'endAt' then
    v_schedule_candidate := v_json;
  else
    return p_description;
  end if;

  v_start_is_valid := coalesce(
    jsonb_typeof(v_schedule_candidate -> 'startAt') = 'string'
    and (v_schedule_candidate ->> 'startAt') ~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$',
    false
  );
  v_end_is_valid := coalesce(
    jsonb_typeof(v_schedule_candidate -> 'endAt') = 'string'
    and (v_schedule_candidate ->> 'endAt') ~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$',
    false
  );
  if v_start_is_valid then
    begin
      perform (v_schedule_candidate ->> 'startAt')::timestamptz;
    exception
      when others then
        v_start_is_valid := false;
    end;
  end if;
  if v_end_is_valid then
    begin
      perform (v_schedule_candidate ->> 'endAt')::timestamptz;
    exception
      when others then
        v_end_is_valid := false;
    end;
  end if;
  v_has_valid_schedule :=
    jsonb_typeof(v_schedule_candidate) = 'object'
    and (v_start_is_valid or v_end_is_valid)
    and (
      not (v_schedule_candidate ? 'startAt')
      or v_schedule_candidate -> 'startAt' = 'null'::jsonb
      or v_start_is_valid
    )
    and (
      not (v_schedule_candidate ? 'endAt')
      or v_schedule_candidate -> 'endAt' = 'null'::jsonb
      or v_end_is_valid
    );

  if not v_has_valid_schedule then
    return p_description;
  end if;

  if v_json ? 'schedule' or v_json ? 'gpslobSchedule' then
    v_clean := v_json - 'schedule' - 'gpslobSchedule';
  else
    v_clean := v_json - 'startAt' - 'endAt';
  end if;

  if v_clean = '{}'::jsonb then
    return '';
  end if;

  return v_clean::text;
end;
$$;

create or replace function public.create_gps_run_execution_share(
  p_source_run_id uuid,
  p_owner_id uuid,
  p_token_hash text
)
returns table (
  share_id uuid,
  share_created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race_type text;
  v_share_id uuid;
  v_created_at timestamptz;
begin
  if p_source_run_id is null or p_owner_id is null then
    raise exception 'share_source_unavailable' using errcode = 'P0002';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'share_token_invalid' using errcode = '22023';
  end if;

  select gr.race_type
    into v_race_type
  from public.gps_runs gr
  where gr.id = p_source_run_id
    and gr.user_id = p_owner_id
  for update;

  if not found then
    raise exception 'share_source_unavailable' using errcode = 'P0002';
  end if;

  if v_race_type is null or v_race_type not in (
    'manuel',
    'dansk',
    'engelsk',
    'matematik',
    'foto'
  ) then
    raise exception 'share_unsupported_run_type' using errcode = '0A000';
  end if;

  update public.gps_run_execution_shares
  set revoked_at = clock_timestamp()
  where source_run_id = p_source_run_id
    and revoked_at is null;

  insert into public.gps_run_execution_shares (
    source_run_id,
    owner_id,
    token_hash
  )
  values (
    p_source_run_id,
    p_owner_id,
    p_token_hash
  )
  returning id, created_at
    into v_share_id, v_created_at;

  return query
  select v_share_id, v_created_at;
end;
$$;

create or replace function public.revoke_gps_run_execution_share(
  p_share_id uuid,
  p_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gps_run_execution_shares
  set revoked_at = coalesce(revoked_at, clock_timestamp())
  where id = p_share_id
    and owner_id = p_owner_id
    and revoked_at is null;

  if not found then
    raise exception 'share_unavailable' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function public.preview_gps_run_execution_share(
  p_token_hash text
)
returns table (
  share_title text,
  share_subject text,
  share_grade_levels text[],
  share_race_type text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share_id uuid;
  v_source_run_id uuid;
  v_share_owner_id uuid;
  v_source_owner_id uuid;
  v_title text;
  v_subject text;
  v_grade_levels text[];
  v_race_type text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  select s.id, s.source_run_id, s.owner_id
    into v_share_id, v_source_run_id, v_share_owner_id
  from public.gps_run_execution_shares s
  where s.token_hash = p_token_hash
    and s.revoked_at is null;

  if not found then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  select gr.user_id, gr.title, gr.subject, gr.grade_levels, gr.race_type
    into v_source_owner_id, v_title, v_subject, v_grade_levels, v_race_type
  from public.gps_runs gr
  where gr.id = v_source_run_id
  for share;

  if not found then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  select s.owner_id
    into v_share_owner_id
  from public.gps_run_execution_shares s
  where s.id = v_share_id
    and s.token_hash = p_token_hash
    and s.revoked_at is null
  for share;

  if not found or v_source_owner_id is distinct from v_share_owner_id then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  if v_race_type is null or v_race_type not in (
    'manuel',
    'dansk',
    'engelsk',
    'matematik',
    'foto'
  ) then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  return query
  select v_title, v_subject, v_grade_levels, v_race_type;
end;
$$;

create or replace function public.claim_gps_run_execution_share(
  p_token_hash text,
  p_teacher_id uuid
)
returns table (
  copied_run_id uuid,
  already_claimed boolean,
  copied_race_type text,
  copy_deleted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share_id uuid;
  v_source_run_id uuid;
  v_share_owner_id uuid;
  v_source_owner_id uuid;
  v_race_type text;
  v_existing_copy_id uuid;
  v_copy_id uuid;
begin
  if p_teacher_id is null then
    raise exception 'share_auth_required' using errcode = '28000';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  select s.id, s.source_run_id, s.owner_id
    into v_share_id, v_source_run_id, v_share_owner_id
  from public.gps_run_execution_shares s
  where s.token_hash = p_token_hash
    and s.revoked_at is null;

  if not found then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  select gr.user_id, gr.race_type
    into v_source_owner_id, v_race_type
  from public.gps_runs gr
  where gr.id = v_source_run_id
  for share;

  if not found then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  select s.id, s.owner_id
    into v_share_id, v_share_owner_id
  from public.gps_run_execution_shares s
  where s.id = v_share_id
    and s.token_hash = p_token_hash
    and s.revoked_at is null
  for update;

  if not found or v_source_owner_id is distinct from v_share_owner_id then
    raise exception 'share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  if v_race_type is null or v_race_type not in (
    'manuel',
    'dansk',
    'engelsk',
    'matematik',
    'foto'
  ) then
    raise exception 'share_unsupported_run_type' using errcode = '0A000';
  end if;

  select c.copied_run_id
    into v_existing_copy_id
  from public.gps_run_execution_share_claims c
  where c.share_id = v_share_id
    and c.teacher_id = p_teacher_id
  for update;

  if found then
    return query
    select
      v_existing_copy_id,
      true,
      v_race_type,
      v_existing_copy_id is null;
    return;
  end if;

  insert into public.gps_runs (
    user_id,
    title,
    subject,
    description,
    topic,
    questions,
    grade_levels,
    radius,
    race_type,
    game_config,
    bonus_enabled,
    post_order_mode
  )
  select
    p_teacher_id,
    gr.title,
    gr.subject,
    public.strip_gps_run_execution_schedule(gr.description),
    public.strip_gps_run_execution_schedule(gr.topic),
    gr.questions,
    gr.grade_levels,
    gr.radius,
    gr.race_type,
    gr.game_config,
    gr.bonus_enabled,
    gr.post_order_mode
  from public.gps_runs gr
  where gr.id = v_source_run_id
    and gr.user_id = v_share_owner_id
  returning id into v_copy_id;

  if v_copy_id is null then
    raise exception 'share_copy_failed' using errcode = 'P0001';
  end if;

  insert into public.gps_run_execution_share_claims (
    share_id,
    teacher_id,
    copied_run_id
  )
  values (
    v_share_id,
    p_teacher_id,
    v_copy_id
  );

  return query
  select v_copy_id, false, v_race_type, false;
end;
$$;

comment on table public.gps_run_execution_shares is
  'Revocable teacher-owned links for creating independent execution copies of standard GPS runs.';
comment on table public.gps_run_execution_share_claims is
  'Persistent idempotency tombstone from a run share and teacher to at most one independent copied run.';
comment on column public.gps_run_execution_shares.token_hash is
  'SHA-256 hex digest. The raw link token is never stored.';

revoke all on function public.strip_gps_run_execution_schedule(text)
  from public, anon, authenticated;
revoke all on function public.create_gps_run_execution_share(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.revoke_gps_run_execution_share(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.preview_gps_run_execution_share(text)
  from public, anon, authenticated;
revoke all on function public.claim_gps_run_execution_share(text, uuid)
  from public, anon, authenticated;

grant execute on function public.create_gps_run_execution_share(uuid, uuid, text)
  to service_role;
grant execute on function public.revoke_gps_run_execution_share(uuid, uuid)
  to service_role;
grant execute on function public.preview_gps_run_execution_share(text)
  to service_role;
grant execute on function public.claim_gps_run_execution_share(text, uuid)
  to service_role;

commit;
