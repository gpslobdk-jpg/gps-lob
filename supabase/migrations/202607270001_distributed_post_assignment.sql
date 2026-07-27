begin;

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
    raise exception 'Live session not found'
      using errcode = 'P0002';
  end if;

  if auth.uid() is null
    or v_teacher_id is distinct from auth.uid()
  then
    raise exception 'Not allowed to start this live session'
      using errcode = '42501';
  end if;

  v_mode := case
    when v_session_route_version = 1
      and v_session_post_order_mode = 'distributed_circular'
      and v_race_type in (
        'manuel',
        'dansk',
        'engelsk',
        'matematik',
        'foto',
        'standard',
        'standardloeb',
        'standardløb',
        'standard race',
        'standard run',
        'generel',
        'general',
        'blandet',
        'mixed'
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
    where p.session_id = p_session_id;

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
    raise exception 'Only a waiting live session can be started'
      using errcode = '55000';
  end if;

  select count(*)
  into v_participant_count
  from public.participants as p
  where p.session_id = p_session_id;

  if v_mode = 'distributed_circular'
    and v_post_count = 0
  then
    raise exception 'A distributed live session needs at least one post'
      using errcode = '22023';
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
  where participant.id = ordered.id;

  update public.live_sessions
  set status = 'running'
  where id = p_session_id;

  select coalesce(jsonb_agg(p.start_offset order by p.created_at, p.id), '[]'::jsonb)
  into v_offsets
  from public.participants as p
  where p.session_id = p_session_id;

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

comment on function public.start_live_session_with_post_assignments(uuid) is
  'Locks a teacher-owned waiting session, assigns deterministic start offsets, and marks it running as the final write.';

revoke all on function public.start_live_session_with_post_assignments(uuid) from public;
revoke all on function public.start_live_session_with_post_assignments(uuid) from anon;
grant execute on function public.start_live_session_with_post_assignments(uuid) to authenticated;

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
    raise exception 'Live session not found'
      using errcode = 'P0002';
  end if;

  select p.*
  into v_participant
  from public.participants as p
  where p.id = p_participant_id
    and p.session_id = p_session_id
  for update;

  if not found then
    raise exception 'Participant not found in live session'
      using errcode = 'P0002';
  end if;

  if v_participant.start_offset is not null then
    return jsonb_build_object(
      'startOffset', v_participant.start_offset,
      'assigned', false
    );
  end if;

  if v_session_status is null
    or v_session_status not in ('waiting', 'running')
  then
    raise exception 'The live session is not open for assignment'
      using errcode = '55000';
  end if;

  v_mode := case
    when v_session_route_version = 1
      and v_session_post_order_mode = 'distributed_circular'
      and v_race_type in (
        'manuel',
        'dansk',
        'engelsk',
        'matematik',
        'foto',
        'standard',
        'standardloeb',
        'standardløb',
        'standard race',
        'standard run',
        'generel',
        'general',
        'blandet',
        'mixed'
      )
    then 'distributed_circular'
    else 'fixed'
  end;

  if v_mode = 'fixed' then
    v_start_offset := 0;
  elsif v_session_status = 'waiting' then
    return jsonb_build_object(
      'startOffset', null,
      'assigned', false
    );
  else
    v_post_count := case
      when jsonb_typeof(v_questions) = 'array' then jsonb_array_length(v_questions)
      else 0
    end;

    if v_post_count = 0 then
      raise exception 'A distributed live session needs at least one post'
        using errcode = '22023';
    end if;

    with candidates as (
      select candidate
      from generate_series(0, v_post_count - 1) as candidate
    ),
    used_offsets as (
      select mod(p.start_offset, v_post_count) as start_offset
      from public.participants as p
      where p.session_id = p_session_id
        and p.start_offset is not null
    ),
    scored_candidates as (
      select
        candidates.candidate,
        (
          select count(*)
          from used_offsets
          where used_offsets.start_offset = candidates.candidate
        ) as participant_load,
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
    select candidate
    into v_start_offset
    from scored_candidates
    order by participant_load, nearest_used_distance desc, candidate
    limit 1;
  end if;

  update public.participants
  set start_offset = v_start_offset
  where id = p_participant_id
    and session_id = p_session_id
    and start_offset is null
  returning start_offset into v_start_offset;

  return jsonb_build_object(
    'startOffset', v_start_offset,
    'assigned', true
  );
end;
$$;

comment on function public.assign_live_participant_start_offset(uuid, uuid) is
  'Serializes late-join route assignment behind the live-session row lock. Existing assignments are never moved.';

revoke all on function public.assign_live_participant_start_offset(uuid, uuid) from public;
revoke all on function public.assign_live_participant_start_offset(uuid, uuid) from anon;
revoke all on function public.assign_live_participant_start_offset(uuid, uuid) from authenticated;
grant execute on function public.assign_live_participant_start_offset(uuid, uuid) to service_role;

commit;
