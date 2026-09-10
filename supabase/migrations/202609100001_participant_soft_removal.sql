begin;

-- A removal is a terminal, auditable participant state. Keep the participant,
-- answers and related rows for retention, but remove every browser/RPC path
-- that could let the identity continue to act or reappear in an active run.
alter table public.participants
  add column if not exists removed_at timestamptz;

create index if not exists participants_active_session_created_idx
  on public.participants (session_id, created_at, id)
  where removed_at is null;

comment on column public.participants.removed_at is
  'Terminal soft-removal timestamp. Removed participants remain retained but cannot read, write, resume or rejoin.';

-- Keep this existence check SECURITY DEFINER so it is safe to use from RLS
-- predicates without recursively depending on participant visibility.
create or replace function public.active_participant_exists(
  target_participant_id uuid,
  target_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants as p
    where p.id = target_participant_id
      and p.session_id = target_session_id
      and p.removed_at is null
  );
$$;

revoke all on function public.active_participant_exists(uuid, uuid) from public;
grant execute on function public.active_participant_exists(uuid, uuid)
  to anon, authenticated, service_role;

-- A stale anonymous-auth identity must not be able to fall back to client
-- supplied headers after removal. The direct auth-user relation is the only
-- player authorization source for active participant rows.
create or replace function public.request_participant_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.id::text
      from public.participants as p
      where auth.uid() is not null
        and p.auth_user_id = auth.uid()
        and p.removed_at is null
      limit 1
    ),
    public.request_header('x-participant-id')
  );
$$;

create or replace function public.request_session_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.session_id::text
      from public.participants as p
      where auth.uid() is not null
        and p.auth_user_id = auth.uid()
        and p.removed_at is null
      limit 1
    ),
    public.request_header('x-session-id')
  );
$$;

create or replace function public.player_matches_participant(
  target_participant_id text,
  target_session_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.participants as p
      where p.id::text = target_participant_id
        and p.session_id::text = target_session_id
        and p.auth_user_id = auth.uid()
        and p.removed_at is null
    );
$$;

revoke all on function public.request_participant_id() from public;
revoke all on function public.request_session_id() from public;
revoke all on function public.player_matches_participant(text, text) from public;
grant execute on function public.request_participant_id() to anon, authenticated, service_role;
grant execute on function public.request_session_id() to anon, authenticated, service_role;
grant execute on function public.player_matches_participant(text, text)
  to anon, authenticated, service_role;

-- A participant may only read the session that contains their active identity.
drop policy if exists live_sessions_participant_select on public.live_sessions;
create policy live_sessions_participant_select
on public.live_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.participants as p
    where p.session_id = live_sessions.id
      and p.auth_user_id = auth.uid()
      and p.removed_at is null
  )
);

-- Do not let a browser update a removed row, clear removed_at, or use a
-- removed participant's answers. The server-only removal route bypasses RLS.
drop policy if exists participants_teacher_select on public.participants;
drop policy if exists participants_teacher_update on public.participants;
drop policy if exists participants_teacher_delete on public.participants;
drop policy if exists participants_player_select_own on public.participants;
drop policy if exists participants_player_insert_own on public.participants;
drop policy if exists participants_player_update_own on public.participants;

create policy participants_teacher_select
on public.participants
for select
to authenticated
using (
  public.teacher_owns_session(session_id::text)
  and removed_at is null
);

create policy participants_teacher_update
on public.participants
for update
to authenticated
using (
  public.teacher_owns_session(session_id::text)
  and removed_at is null
)
with check (
  public.teacher_owns_session(session_id::text)
  and removed_at is null
);

create policy participants_player_select_own
on public.participants
for select
to anon, authenticated
using (
  removed_at is null
  and public.player_matches_participant(id::text, session_id::text)
);

create policy participants_player_insert_own
on public.participants
for insert
to anon, authenticated
with check (
  removed_at is null
  and auth_user_id = auth.uid()
  and public.active_session_exists(session_id::text)
  and char_length(btrim(student_name)) > 0
);

create policy participants_player_update_own
on public.participants
for update
to anon, authenticated
using (
  removed_at is null
  and public.player_matches_participant(id::text, session_id::text)
)
with check (
  removed_at is null
  and public.player_matches_participant(id::text, session_id::text)
  and public.active_session_exists(session_id::text)
  and char_length(btrim(student_name)) > 0
);

drop policy if exists answers_teacher_select on public.answers;
drop policy if exists answers_teacher_update on public.answers;
drop policy if exists answers_teacher_delete on public.answers;
drop policy if exists answers_player_select_own on public.answers;
drop policy if exists answers_player_insert_own on public.answers;
drop policy if exists answers_player_update_own on public.answers;

create policy answers_teacher_select
on public.answers
for select
to authenticated
using (
  exists (
    select 1
    from public.live_sessions as ls
    join public.gps_runs as gr on gr.id = ls.run_id
    where ls.id = answers.session_id
      and gr.user_id = auth.uid()
  )
  and participant_id is not null
  and public.active_participant_exists(participant_id, session_id)
);

create policy answers_teacher_update
on public.answers
for update
to authenticated
using (
  exists (
    select 1
    from public.live_sessions as ls
    join public.gps_runs as gr on gr.id = ls.run_id
    where ls.id = answers.session_id
      and gr.user_id = auth.uid()
  )
  and participant_id is not null
  and public.active_participant_exists(participant_id, session_id)
)
with check (
  exists (
    select 1
    from public.live_sessions as ls
    join public.gps_runs as gr on gr.id = ls.run_id
    where ls.id = answers.session_id
      and gr.user_id = auth.uid()
  )
  and participant_id is not null
  and public.active_participant_exists(participant_id, session_id)
);

create policy answers_player_select_own
on public.answers
for select
to anon, authenticated
using (
  participant_id is not null
  and public.player_matches_participant(participant_id::text, session_id::text)
  and public.active_participant_exists(participant_id, session_id)
);

create policy answers_player_insert_own
on public.answers
for insert
to anon, authenticated
with check (
  participant_id is not null
  and public.player_matches_participant(participant_id::text, session_id::text)
  and public.active_participant_exists(participant_id, session_id)
  and public.active_session_exists(session_id::text)
);

create policy answers_player_update_own
on public.answers
for update
to anon, authenticated
using (
  participant_id is not null
  and public.player_matches_participant(participant_id::text, session_id::text)
  and public.active_participant_exists(participant_id, session_id)
)
with check (
  participant_id is not null
  and public.player_matches_participant(participant_id::text, session_id::text)
  and public.active_participant_exists(participant_id, session_id)
  and public.active_session_exists(session_id::text)
);

-- The privacy cutover intentionally removed browser-side deletes. Keep it
-- that way while refreshing the policies above.
revoke delete on public.participants from anon, authenticated;
revoke delete on public.answers from anon, authenticated;

-- Defense in depth for service-role writers: no answer can be inserted or
-- reassigned to a removed participant, while legacy rows without a participant
-- remain readable only to server-side retention tooling.
create or replace function public.require_active_answer_participant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.participant_id is null then
    return new;
  end if;

  -- Serialize answer writes with the removal update. If the answer gets this
  -- row lock first it commits before the terminal removal; if removal commits
  -- first this active-row lookup returns no row and the write is rejected.
  perform 1
  from public.participants as p
  where p.id = new.participant_id
    and p.session_id = new.session_id
    and p.removed_at is null
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PARTICIPANT_REMOVED';
  end if;
  return new;
end;
$$;

drop trigger if exists answers_require_active_participant on public.answers;
create trigger answers_require_active_participant
before insert or update on public.answers
for each row
execute function public.require_active_answer_participant();

create or replace function public.clear_finished_participant_location()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.finished_at is not null or new.removed_at is not null then
    new.lat := null;
    new.lng := null;
    new.accuracy := null;
  end if;
  return new;
end;
$$;

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
      or p.removed_at is not null
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
      and p.removed_at is null
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

-- Focus is optional, but a removed participant must not be rendered in teacher
-- summaries or contribute return events through the security-definer RPCs.
create or replace function public.set_focus_participant_excluded(
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
      and p.removed_at is null
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

create or replace function public.record_focus_return(
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
      and p.finished_at is null and p.removed_at is null
      and s.status in ('running', 'active')
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

-- New server callers bind every capture to the active participant that earned
-- it. Keep the legacy five-argument service-role RPC in place for the brief
-- migration-before-code window; it cannot be invoked by browsers and no
-- removal UI exists until the new server route is deployed. Once code is
-- deployed, all captures use this six-argument overload.
create or replace function public.capture_zone_krig(
  p_session_id uuid,
  p_zone_index integer,
  p_team_id uuid,
  p_shield_until timestamptz,
  p_points integer,
  p_participant_id uuid
)
returns table (
  zone_id uuid,
  owner_team_id uuid,
  previous_owner_team_id uuid,
  captured boolean,
  owner_changed boolean,
  blocked_by_shield boolean,
  zone_missing boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone public.game_zones%rowtype;
  v_points integer := greatest(coalesce(p_points, 0), 0);
begin
  -- This lock serializes removal and capture: a capture either completes
  -- before removal takes the row lock, or it observes removed_at and returns
  -- without changing a zone or team score.
  perform 1
  from public.participants as p
  where p.id = p_participant_id
    and p.session_id = p_session_id
    and p.zone_krig_team_id = p_team_id
    and p.removed_at is null
  for update;

  if not found then
    return;
  end if;

  select *
  into v_zone
  from public.game_zones
  where session_id = p_session_id
    and zone_index = p_zone_index
  for update;

  if not found then
    return query
    select
      null::uuid,
      null::uuid,
      null::uuid,
      false,
      false,
      false,
      true;
    return;
  end if;

  if v_zone.shield_until is not null
     and v_zone.shield_until > now()
     and v_zone.owner_team_id is distinct from p_team_id then
    return query
    select
      v_zone.id,
      v_zone.owner_team_id,
      v_zone.owner_team_id,
      false,
      false,
      true,
      false;
    return;
  end if;

  update public.game_zones
  set owner_team_id = p_team_id,
      shield_until = p_shield_until
  where id = v_zone.id;

  if v_zone.owner_team_id is distinct from p_team_id then
    update public.game_teams
    set score = score + v_points
    where id = p_team_id
      and session_id = p_session_id;

    return query
    select
      v_zone.id,
      p_team_id,
      v_zone.owner_team_id,
      true,
      true,
      false,
      false;
    return;
  end if;

  return query
  select
    v_zone.id,
    p_team_id,
    v_zone.owner_team_id,
    true,
    false,
    false,
    false;
end;
$$;

revoke all on function public.capture_zone_krig(uuid, integer, uuid, timestamptz, integer, uuid) from public;
revoke all on function public.capture_zone_krig(uuid, integer, uuid, timestamptz, integer, uuid) from anon;
revoke all on function public.capture_zone_krig(uuid, integer, uuid, timestamptz, integer, uuid) from authenticated;
grant execute on function public.capture_zone_krig(uuid, integer, uuid, timestamptz, integer, uuid) to service_role;

-- Zone lock must also reject a removed participant when a teacher is otherwise
-- authorized to inspect the session.
create or replace function public.lock_zone_krig_zone(
  p_session_id uuid,
  p_zone_id uuid,
  p_participant_id uuid,
  p_shield_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone public.game_zones%rowtype;
  v_next_shield_until timestamptz := greatest(
    coalesce(p_shield_until, now() + interval '60 seconds'),
    now()
  );
begin
  if p_session_id is null or p_zone_id is null or p_participant_id is null then
    return jsonb_build_object('locked', false, 'reason', 'invalid_request');
  end if;

  if not (
    public.player_matches_participant(p_participant_id::text, p_session_id::text)
    or public.teacher_owns_session(p_session_id::text)
  ) then
    return jsonb_build_object('locked', false, 'reason', 'unauthorized');
  end if;

  perform 1
  from public.participants
  where id = p_participant_id
    and session_id = p_session_id
    and removed_at is null
  for update;

  if not found then
    return jsonb_build_object('locked', false, 'reason', 'participant_missing');
  end if;

  select * into v_zone
  from public.game_zones
  where id = p_zone_id and session_id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('locked', false, 'reason', 'zone_missing');
  end if;

  if v_zone.shield_until is null or v_zone.shield_until < v_next_shield_until then
    update public.game_zones set shield_until = v_next_shield_until where id = v_zone.id;
  else
    v_next_shield_until := v_zone.shield_until;
  end if;

  return jsonb_build_object(
    'locked', true,
    'zone_id', v_zone.id,
    'shield_until', v_next_shield_until
  );
end;
$$;

-- The post-order assignment functions are replaced below so removed rows do
-- not influence counts, offsets, or late-join allocation.

create or replace function public.start_live_session_with_post_assignments(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_teacher_id public.live_sessions.teacher_id%type;
  v_session_status public.live_sessions.status%type;
  v_session_post_order_mode public.live_sessions.post_order_mode%type;
  v_session_route_version public.live_sessions.route_version%type;
  v_race_type text;
  v_questions jsonb;
  v_mode text;
  v_post_count integer;
  v_participant_count integer;
  v_offsets jsonb;
begin
  select
    ls.teacher_id,
    ls.status,
    ls.post_order_mode,
    ls.route_version,
    lower(btrim(coalesce(gr.race_type, ''))),
    to_jsonb(gr.questions)
  into
    v_teacher_id,
    v_session_status,
    v_session_post_order_mode,
    v_session_route_version,
    v_race_type,
    v_questions
  from public.live_sessions as ls
  join public.gps_runs as gr on gr.id = ls.run_id
  where ls.id = p_session_id
  for update of ls;

  if not found then
    raise exception 'Live session not found' using errcode = 'P0002';
  end if;

  if auth.uid() is null or v_teacher_id is distinct from auth.uid() then
    raise exception 'Not allowed to start this live session' using errcode = '42501';
  end if;

  -- Lock the active roster in a stable order before taking any count or
  -- assigning offsets. A concurrent soft removal locks the same row, so it
  -- either finishes before this snapshot or waits until this assignment is
  -- complete; it cannot leave an active roster with offsets based on a
  -- removed participant.
  perform p.id
  from public.participants as p
  where p.session_id = p_session_id
    and p.removed_at is null
  order by p.created_at, p.id
  for update;

  v_mode := case
    when v_session_route_version = 1
      and v_session_post_order_mode = 'distributed_circular'
      and v_race_type in (
        'manuel', 'dansk', 'engelsk', 'matematik', 'foto', 'standard',
        'standardloeb', 'standardløb', 'standard race', 'standard run',
        'generel', 'general', 'blandet', 'mixed'
      )
    then 'distributed_circular'
    else 'fixed'
  end;

  v_post_count := case
    when jsonb_typeof(v_questions) = 'array' then jsonb_array_length(v_questions)
    else 0
  end;

  if v_session_status = 'running' then
    select count(*), coalesce(jsonb_agg(p.start_offset order by p.created_at, p.id), '[]'::jsonb)
    into v_participant_count, v_offsets
    from public.participants as p
    where p.session_id = p_session_id
      and p.removed_at is null;

    return jsonb_build_object(
      'status', 'running',
      'idempotent', true,
      'postOrderMode', v_mode,
      'routeVersion', coalesce(v_session_route_version, 1),
      'postCount', v_post_count,
      'participantCount', v_participant_count,
      'startOffsets', v_offsets
    );
  end if;

  if v_session_status is distinct from 'waiting' then
    raise exception 'Only a waiting live session can be started' using errcode = '55000';
  end if;

  select count(*) into v_participant_count
  from public.participants as p
  where p.session_id = p_session_id
    and p.removed_at is null;

  if v_mode = 'distributed_circular' and v_post_count = 0 then
    raise exception 'A distributed live session needs at least one post' using errcode = '22023';
  end if;

  update public.live_sessions
  set post_order_mode = v_mode,
      route_version = 1
  where id = p_session_id;

  with ordered_participants as (
    select
      p.id,
      row_number() over (order by p.created_at, p.id) - 1 as participant_index,
      count(*) over () as participant_count
    from public.participants as p
    where p.session_id = p_session_id
      and p.removed_at is null
  )
  update public.participants as participant
  set start_offset = case
    when v_mode = 'fixed' then 0
    else floor(
      (ordered.participant_index * v_post_count)::numeric
      / ordered.participant_count
    )::integer
  end
  from ordered_participants as ordered
  where participant.id = ordered.id
    and participant.removed_at is null;

  update public.live_sessions set status = 'running' where id = p_session_id;

  select coalesce(jsonb_agg(p.start_offset order by p.created_at, p.id), '[]'::jsonb)
  into v_offsets
  from public.participants as p
  where p.session_id = p_session_id
    and p.removed_at is null;

  return jsonb_build_object(
    'status', 'running',
    'idempotent', false,
    'postOrderMode', v_mode,
    'routeVersion', 1,
    'postCount', v_post_count,
    'participantCount', v_participant_count,
    'startOffsets', v_offsets
  );
end;
$$;

create or replace function public.assign_live_participant_start_offset(
  p_session_id uuid,
  p_participant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_status public.live_sessions.status%type;
  v_session_post_order_mode public.live_sessions.post_order_mode%type;
  v_session_route_version public.live_sessions.route_version%type;
  v_race_type text;
  v_questions jsonb;
  v_participant public.participants%rowtype;
  v_mode text;
  v_post_count integer;
  v_start_offset integer;
begin
  select
    ls.status,
    ls.post_order_mode,
    ls.route_version,
    lower(btrim(coalesce(gr.race_type, ''))),
    to_jsonb(gr.questions)
  into
    v_session_status,
    v_session_post_order_mode,
    v_session_route_version,
    v_race_type,
    v_questions
  from public.live_sessions as ls
  join public.gps_runs as gr on gr.id = ls.run_id
  where ls.id = p_session_id
  for update of ls;

  if not found then
    raise exception 'Live session not found' using errcode = 'P0002';
  end if;

  select p.* into v_participant
  from public.participants as p
  where p.id = p_participant_id
    and p.session_id = p_session_id
    and p.removed_at is null
  for update;

  if not found then
    raise exception 'Participant not found in live session' using errcode = 'P0002';
  end if;

  if v_participant.start_offset is not null then
    return jsonb_build_object('startOffset', v_participant.start_offset, 'assigned', false);
  end if;

  if v_session_status is null or v_session_status not in ('waiting', 'running') then
    raise exception 'The live session is not open for assignment' using errcode = '55000';
  end if;

  v_mode := case
    when v_session_route_version = 1
      and v_session_post_order_mode = 'distributed_circular'
      and v_race_type in (
        'manuel', 'dansk', 'engelsk', 'matematik', 'foto', 'standard',
        'standardloeb', 'standardløb', 'standard race', 'standard run',
        'generel', 'general', 'blandet', 'mixed'
      )
    then 'distributed_circular'
    else 'fixed'
  end;

  if v_mode = 'fixed' then
    v_start_offset := 0;
  elsif v_session_status = 'waiting' then
    return jsonb_build_object('startOffset', null, 'assigned', false);
  else
    v_post_count := case
      when jsonb_typeof(v_questions) = 'array' then jsonb_array_length(v_questions)
      else 0
    end;

    if v_post_count = 0 then
      raise exception 'A distributed live session needs at least one post' using errcode = '22023';
    end if;

    with candidates as (
      select candidate from generate_series(0, v_post_count - 1) as candidate
    ),
    used_offsets as (
      select mod(p.start_offset, v_post_count) as start_offset
      from public.participants as p
      where p.session_id = p_session_id
        and p.start_offset is not null
        and p.removed_at is null
    ),
    scored_candidates as (
      select
        candidates.candidate,
        (select count(*) from used_offsets where used_offsets.start_offset = candidates.candidate)
          as participant_load,
        coalesce(
          (
            select min(
              least(
                abs(candidates.candidate - used_offsets.start_offset),
                v_post_count - abs(candidates.candidate - used_offsets.start_offset)
              )
            )
            from used_offsets
          ),
          v_post_count
        ) as nearest_used_distance
      from candidates
    )
    select candidate into v_start_offset
    from scored_candidates
    order by participant_load, nearest_used_distance desc, candidate
    limit 1;
  end if;

  update public.participants
  set start_offset = v_start_offset
  where id = p_participant_id
    and session_id = p_session_id
    and start_offset is null
    and removed_at is null
  returning start_offset into v_start_offset;

  return jsonb_build_object('startOffset', v_start_offset, 'assigned', true);
end;
$$;

revoke all on function public.start_live_session_with_post_assignments(uuid) from public, anon;
grant execute on function public.start_live_session_with_post_assignments(uuid) to authenticated;
revoke all on function public.assign_live_participant_start_offset(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_live_participant_start_offset(uuid, uuid) to service_role;

-- Stratego keeps its historical player rows, but removes them from every
-- active projection and makes a removed player non-targetable in the same
-- transaction as the participant removal.
create or replace function public.player_belongs_to_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.participants as p
      where p.session_id = target_session_id
        and p.auth_user_id = auth.uid()
        and p.removed_at is null
    );
$$;

revoke all on function public.player_belongs_to_session(uuid) from public;
grant execute on function public.player_belongs_to_session(uuid)
  to anon, authenticated, service_role;

-- Respawn locks the participant row before making the Stratego player active.
-- Therefore removal and respawn serialize: whichever acquires the participant
-- lock first completes, and the later operation observes or applies removal.
create or replace function public.respawn_stratego_player(
  p_player_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player record;
  v_game record;
  v_base_lat double precision;
  v_base_lng double precision;
  v_distance_to_base double precision;
  v_now timestamptz := now();
  v_spawn_shield_until timestamptz := v_now + interval '10 seconds';
begin
  if p_player_id is null or p_session_id is null then
    return null;
  end if;

  if not (
    public.player_matches_participant(p_player_id::text, p_session_id::text)
    or public.teacher_owns_session(p_session_id::text)
  ) then
    return null;
  end if;

  select
    sp.participant_id,
    sp.session_id,
    sp.team_code,
    sp.rank_key,
    sp.state,
    sp.last_duel_at,
    sp.eliminated_by_participant_id,
    p.lat as live_lat,
    p.lng as live_lng,
    p.spawn_shield_until
  into v_player
  from public.stratego_players as sp
  join public.participants as p
    on p.id = sp.participant_id
   and p.session_id = sp.session_id
  where sp.participant_id = p_player_id
    and sp.session_id = p_session_id
    and p.removed_at is null
  for update of sp, p;

  if not found then
    return null;
  end if;

  if v_player.state <> 'returning_to_base' then
    return jsonb_build_object(
      'participant_id', v_player.participant_id,
      'session_id', v_player.session_id,
      'team_code', v_player.team_code,
      'state', v_player.state,
      'respawned', false,
      'spawn_shield_until', v_player.spawn_shield_until
    );
  end if;

  if v_player.live_lat is null or v_player.live_lng is null then
    raise exception 'Kunne ikke validere din position i basen.';
  end if;

  select
    sg.red_base_lat,
    sg.red_base_lng,
    sg.blue_base_lat,
    sg.blue_base_lng
  into v_game
  from public.stratego_games as sg
  where sg.session_id = p_session_id;

  if not found then
    raise exception 'Stratego-baserne mangler for denne session.';
  end if;

  if v_player.team_code = 'blue' then
    v_base_lat := v_game.blue_base_lat;
    v_base_lng := v_game.blue_base_lng;
  else
    v_base_lat := v_game.red_base_lat;
    v_base_lng := v_game.red_base_lng;
  end if;

  if v_base_lat is null or v_base_lng is null then
    raise exception 'Stratego-baserne mangler for denne session.';
  end if;

  v_distance_to_base := public.stratego_haversine_meters(
    v_player.live_lat,
    v_player.live_lng,
    v_base_lat,
    v_base_lng
  );

  if v_distance_to_base > 30 then
    raise exception 'Du er ikke tilbage i din base endnu.';
  end if;

  update public.stratego_players
  set
    state = 'alive',
    last_duel_at = null,
    eliminated_by_participant_id = null
  where participant_id = p_player_id
    and session_id = p_session_id
    and exists (
      select 1
      from public.participants as p
      where p.id = p_player_id
        and p.session_id = p_session_id
        and p.removed_at is null
    );

  if not found then
    return null;
  end if;

  update public.participants
  set spawn_shield_until = v_spawn_shield_until
  where id = p_player_id
    and session_id = p_session_id
    and removed_at is null;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'participant_id', p_player_id,
    'session_id', p_session_id,
    'team_code', v_player.team_code,
    'state', 'alive',
    'respawned', true,
    'distance_to_base_meters', round(v_distance_to_base::numeric, 2),
    'respawned_at', v_now,
    'spawn_shield_until', v_spawn_shield_until
  );
end;
$$;

revoke all on function public.respawn_stratego_player(uuid, uuid) from public;
revoke all on function public.respawn_stratego_player(uuid, uuid) from anon;
revoke all on function public.respawn_stratego_player(uuid, uuid) from authenticated;
grant execute on function public.respawn_stratego_player(uuid, uuid)
  to anon, authenticated, service_role;

drop policy if exists stratego_players_teacher_select on public.stratego_players;
create policy stratego_players_teacher_select
on public.stratego_players
for select
to authenticated
using (
  public.teacher_owns_session(session_id::text)
  and public.active_participant_exists(participant_id, session_id)
);

drop policy if exists stratego_players_player_select_own on public.stratego_players;
create policy stratego_players_player_select_own
on public.stratego_players
for select
to anon, authenticated
using (
  public.player_matches_participant(participant_id::text, session_id::text)
  and public.active_participant_exists(participant_id, session_id)
);

create or replace view public.stratego_presence_view as
select
  p.id as participant_id,
  p.session_id,
  sp.team_code,
  sp.state,
  p.lat,
  p.lng,
  p.updated_at,
  p.accuracy,
  p.spawn_shield_until
from public.participants as p
join public.stratego_players as sp
  on sp.participant_id = p.id
 and sp.session_id = p.session_id
where p.removed_at is null
  and (
    public.player_belongs_to_session(p.session_id)
    or public.teacher_owns_session(p.session_id::text)
  );

revoke all on public.stratego_presence_view from public, anon, authenticated;
grant select on public.stratego_presence_view to anon, authenticated;

create or replace view public.stratego_ally_view as
select
  p.id as participant_id,
  p.session_id,
  p.student_name,
  sp.team_code,
  sp.rank_key,
  sp.state,
  p.lat,
  p.lng,
  p.updated_at,
  -- Keep the established view contract append-only: this column was added by
  -- 202604040003 and cannot be removed by CREATE OR REPLACE VIEW.
  p.accuracy
from public.participants as p
join public.stratego_players as sp
  on sp.participant_id = p.id
 and sp.session_id = p.session_id
where p.removed_at is null
  and (
    (
      public.player_belongs_to_session(p.session_id)
      and exists (
        select 1
        from public.participants as self
        join public.stratego_players as self_sp
          on self_sp.participant_id = self.id
         and self_sp.session_id = self.session_id
        where self.session_id = p.session_id
          and self.auth_user_id = auth.uid()
          and self.removed_at is null
          and self_sp.team_code = sp.team_code
      )
    )
    or public.teacher_owns_session(p.session_id::text)
  );

revoke all on public.stratego_ally_view from public, anon, authenticated;
grant select on public.stratego_ally_view to anon, authenticated;

create or replace function public.quarantine_removed_participant_game_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.removed_at is not null and old.removed_at is null then
    update public.stratego_players
    set state = 'returning_to_base',
        last_duel_at = now()
    where participant_id = new.id
      and session_id = new.session_id
      and state = 'alive';
  end if;
  return new;
end;
$$;

drop trigger if exists participants_quarantine_removed_game_state on public.participants;
create trigger participants_quarantine_removed_game_state
after update of removed_at on public.participants
for each row
execute function public.quarantine_removed_participant_game_state();

commit;
