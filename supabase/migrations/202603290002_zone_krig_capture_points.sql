drop function if exists public.capture_zone_krig(uuid, integer, uuid, timestamptz);

create or replace function public.capture_zone_krig(
  p_session_id uuid,
  p_zone_index integer,
  p_team_id uuid,
  p_shield_until timestamptz,
  p_points integer
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

revoke all on function public.capture_zone_krig(uuid, integer, uuid, timestamptz, integer) from public;
revoke all on function public.capture_zone_krig(uuid, integer, uuid, timestamptz, integer) from anon;
revoke all on function public.capture_zone_krig(uuid, integer, uuid, timestamptz, integer) from authenticated;
grant execute on function public.capture_zone_krig(uuid, integer, uuid, timestamptz, integer) to service_role;