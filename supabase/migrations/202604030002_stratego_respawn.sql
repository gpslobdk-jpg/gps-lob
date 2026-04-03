begin;

drop function if exists public.respawn_stratego_player(uuid, uuid);

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
    p.lng as live_lng
  into v_player
  from public.stratego_players as sp
  join public.participants as p
    on p.id = sp.participant_id
   and p.session_id = sp.session_id
  where sp.participant_id = p_player_id
    and sp.session_id = p_session_id
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
      'respawned', false
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
    and session_id = p_session_id;

  return jsonb_build_object(
    'participant_id', p_player_id,
    'session_id', p_session_id,
    'team_code', v_player.team_code,
    'state', 'alive',
    'respawned', true,
    'distance_to_base_meters', round(v_distance_to_base::numeric, 2),
    'respawned_at', v_now
  );
end;
$$;

revoke all on function public.respawn_stratego_player(uuid, uuid) from public;
revoke all on function public.respawn_stratego_player(uuid, uuid) from anon;
revoke all on function public.respawn_stratego_player(uuid, uuid) from authenticated;
grant execute on function public.respawn_stratego_player(uuid, uuid) to anon, authenticated, service_role;

commit;
