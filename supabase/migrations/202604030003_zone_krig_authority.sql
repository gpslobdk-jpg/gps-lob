begin;

alter table public.participants
  add column if not exists zone_krig_team_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'participants_zone_krig_team_id_fkey'
  ) then
    alter table public.participants
      add constraint participants_zone_krig_team_id_fkey
      foreign key (zone_krig_team_id)
      references public.game_teams (id)
      on delete set null;
  end if;
end
$$;

create index if not exists participants_session_zone_krig_team_idx
  on public.participants (session_id, zone_krig_team_id);

drop policy if exists "participants can shield zones" on public.game_zones;

drop function if exists public.lock_zone_krig_zone(uuid, uuid, uuid, timestamptz);

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
    return jsonb_build_object(
      'locked', false,
      'reason', 'invalid_request'
    );
  end if;

  if not (
    public.player_matches_participant(p_participant_id::text, p_session_id::text)
    or public.teacher_owns_session(p_session_id::text)
  ) then
    return jsonb_build_object(
      'locked', false,
      'reason', 'unauthorized'
    );
  end if;

  perform 1
  from public.participants
  where id = p_participant_id
    and session_id = p_session_id::text
  for update;

  if not found then
    return jsonb_build_object(
      'locked', false,
      'reason', 'participant_missing'
    );
  end if;

  select *
  into v_zone
  from public.game_zones
  where id = p_zone_id
    and session_id = p_session_id
  for update;

  if not found then
    return jsonb_build_object(
      'locked', false,
      'reason', 'zone_missing'
    );
  end if;

  if v_zone.shield_until is null or v_zone.shield_until < v_next_shield_until then
    update public.game_zones
    set shield_until = v_next_shield_until
    where id = v_zone.id;
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

revoke all on function public.lock_zone_krig_zone(uuid, uuid, uuid, timestamptz) from public;
revoke all on function public.lock_zone_krig_zone(uuid, uuid, uuid, timestamptz) from anon;
revoke all on function public.lock_zone_krig_zone(uuid, uuid, uuid, timestamptz) from authenticated;
grant execute on function public.lock_zone_krig_zone(uuid, uuid, uuid, timestamptz) to anon, authenticated, service_role;

commit;
