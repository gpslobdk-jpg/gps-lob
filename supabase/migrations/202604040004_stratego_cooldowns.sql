begin;

alter table public.participants
  add column if not exists spawn_shield_until timestamptz;

comment on column public.participants.spawn_shield_until is
  'Hvis sat i fremtiden, er deltageren midlertidigt fredet efter respawn i Stratego.';

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
where (
  public.request_session_id() is not null
  and p.session_id::text = public.request_session_id()
  and exists (
    select 1
    from public.participants as self
    where self.id::text = public.request_participant_id()
      and self.session_id = p.session_id
  )
) or public.teacher_owns_session(p.session_id::text);

revoke all on public.stratego_presence_view from public;
revoke all on public.stratego_presence_view from anon, authenticated;
grant select on public.stratego_presence_view to anon, authenticated;

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
    and session_id = p_session_id;

  update public.participants
  set spawn_shield_until = v_spawn_shield_until
  where id = p_player_id
    and session_id = p_session_id;

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
grant execute on function public.respawn_stratego_player(uuid, uuid) to anon, authenticated, service_role;

create or replace function public.resolve_stratego_duel(
  p_attacker_id uuid,
  p_defender_id uuid,
  p_session_id uuid,
  p_attacker_lat double precision,
  p_attacker_lng double precision,
  p_defender_lat double precision,
  p_defender_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_id uuid;
  v_second_id uuid;
  v_first_player record;
  v_second_player record;
  v_attacker record;
  v_defender record;
  v_game record;
  v_attacker_live_lat double precision;
  v_attacker_live_lng double precision;
  v_defender_live_lat double precision;
  v_defender_live_lng double precision;
  v_attacker_base_lat double precision;
  v_attacker_base_lng double precision;
  v_defender_base_lat double precision;
  v_defender_base_lng double precision;
  v_distance_between_players double precision;
  v_distance_defender_to_base double precision;
  v_distance_attacker_to_base double precision;
  v_now timestamptz := now();
  v_winner_id uuid;
  v_loser_id uuid;
  v_winner_team text := null;
  v_attacker_state_after text := 'alive';
  v_defender_state_after text := 'alive';
  v_is_draw boolean := false;
  v_resolution text;
  v_attacker_duel_cooldown_until timestamptz;
  v_attacker_duel_cooldown_remaining_seconds integer;
  v_defender_spawn_shield_remaining_seconds integer;
begin
  if p_attacker_id is null or p_defender_id is null or p_session_id is null then
    return null;
  end if;

  if p_attacker_id = p_defender_id then
    return null;
  end if;

  if not (
    public.player_matches_participant(p_attacker_id::text, p_session_id::text)
    or public.player_matches_participant(p_defender_id::text, p_session_id::text)
    or public.teacher_owns_session(p_session_id::text)
  ) then
    return null;
  end if;

  v_first_id := least(p_attacker_id, p_defender_id);
  v_second_id := greatest(p_attacker_id, p_defender_id);

  select
    sp.participant_id,
    sp.session_id,
    sp.team_code,
    sp.rank_key,
    sp.state,
    sp.last_duel_at,
    sp.eliminated_by_participant_id,
    rd.display_name,
    rd.strength,
    rd.is_flag,
    rd.is_bomb,
    rd.can_defuse_bomb,
    rd.kills_marshal_when_attacking,
    p.lat as live_lat,
    p.lng as live_lng,
    p.spawn_shield_until
  into v_first_player
  from public.stratego_players as sp
  join public.stratego_role_definitions as rd
    on rd.rank_key = sp.rank_key
  join public.participants as p
    on p.id = sp.participant_id
   and p.session_id = sp.session_id
  where sp.participant_id = v_first_id
    and sp.session_id = p_session_id
  for update of sp, p;

  if not found then
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
    rd.display_name,
    rd.strength,
    rd.is_flag,
    rd.is_bomb,
    rd.can_defuse_bomb,
    rd.kills_marshal_when_attacking,
    p.lat as live_lat,
    p.lng as live_lng,
    p.spawn_shield_until
  into v_second_player
  from public.stratego_players as sp
  join public.stratego_role_definitions as rd
    on rd.rank_key = sp.rank_key
  join public.participants as p
    on p.id = sp.participant_id
   and p.session_id = sp.session_id
  where sp.participant_id = v_second_id
    and sp.session_id = p_session_id
  for update of sp, p;

  if not found then
    return null;
  end if;

  if v_first_player.participant_id = p_attacker_id then
    v_attacker := v_first_player;
    v_defender := v_second_player;
  else
    v_attacker := v_second_player;
    v_defender := v_first_player;
  end if;

  if v_attacker.state <> 'alive' or v_defender.state <> 'alive' then
    return null;
  end if;

  if v_attacker.team_code = v_defender.team_code then
    return null;
  end if;

  if v_attacker.last_duel_at is not null then
    v_attacker_duel_cooldown_until := v_attacker.last_duel_at + interval '5 seconds';

    if v_attacker_duel_cooldown_until > v_now then
      v_attacker_duel_cooldown_remaining_seconds := greatest(
        1,
        ceil(extract(epoch from (v_attacker_duel_cooldown_until - v_now)))
      )::integer;

      raise exception 'Du er i duel-cooldown i % sekunder endnu.',
        v_attacker_duel_cooldown_remaining_seconds;
    end if;
  end if;

  if v_defender.spawn_shield_until is not null and v_defender.spawn_shield_until > v_now then
    v_defender_spawn_shield_remaining_seconds := greatest(
      1,
      ceil(extract(epoch from (v_defender.spawn_shield_until - v_now)))
    )::integer;

    raise exception 'Forsvareren er fredet i % sekunder endnu.',
      v_defender_spawn_shield_remaining_seconds;
  end if;

  select
    sg.red_base_lat,
    sg.red_base_lng,
    sg.blue_base_lat,
    sg.blue_base_lng,
    sg.winner_team
  into v_game
  from public.stratego_games as sg
  where sg.session_id = p_session_id;

  if not found then
    raise exception 'Stratego-baserne mangler for denne session.';
  end if;

  if v_game.winner_team is not null then
    return null;
  end if;

  v_attacker_live_lat := v_attacker.live_lat;
  v_attacker_live_lng := v_attacker.live_lng;
  v_defender_live_lat := v_defender.live_lat;
  v_defender_live_lng := v_defender.live_lng;

  if v_attacker_live_lat is null
    or v_attacker_live_lng is null
    or v_defender_live_lat is null
    or v_defender_live_lng is null then
    raise exception 'Kunne ikke validere spillerpositionerne.';
  end if;

  if v_attacker.team_code = 'blue' then
    v_attacker_base_lat := v_game.blue_base_lat;
    v_attacker_base_lng := v_game.blue_base_lng;
  else
    v_attacker_base_lat := v_game.red_base_lat;
    v_attacker_base_lng := v_game.red_base_lng;
  end if;

  if v_defender.team_code = 'blue' then
    v_defender_base_lat := v_game.blue_base_lat;
    v_defender_base_lng := v_game.blue_base_lng;
  else
    v_defender_base_lat := v_game.red_base_lat;
    v_defender_base_lng := v_game.red_base_lng;
  end if;

  if v_attacker_base_lat is null
    or v_attacker_base_lng is null
    or v_defender_base_lat is null
    or v_defender_base_lng is null then
    raise exception 'Stratego-baserne mangler for denne session.';
  end if;

  v_distance_between_players := public.stratego_haversine_meters(
    v_attacker_live_lat,
    v_attacker_live_lng,
    v_defender_live_lat,
    v_defender_live_lng
  );

  if v_distance_between_players > 20 then
    raise exception 'Maalet er for langt vaek (over 20m).';
  end if;

  v_distance_attacker_to_base := public.stratego_haversine_meters(
    v_attacker_live_lat,
    v_attacker_live_lng,
    v_attacker_base_lat,
    v_attacker_base_lng
  );

  if v_distance_attacker_to_base <= 30 then
    raise exception 'Du befinder dig i din egen fredszone.';
  end if;

  v_distance_defender_to_base := public.stratego_haversine_meters(
    v_defender_live_lat,
    v_defender_live_lng,
    v_defender_base_lat,
    v_defender_base_lng
  );

  if v_distance_defender_to_base <= 30 then
    raise exception 'Maalet befinder sig i en fredszone.';
  end if;

  if v_defender.is_flag then
    v_winner_id := p_attacker_id;
    v_loser_id := p_defender_id;
    v_winner_team := v_attacker.team_code;
    v_resolution := 'flag_captured';
  elsif v_attacker.is_flag then
    v_winner_id := p_defender_id;
    v_loser_id := p_attacker_id;
    v_winner_team := v_defender.team_code;
    v_resolution := 'flag_lost';
  elsif v_defender.is_bomb then
    if v_attacker.can_defuse_bomb then
      v_winner_id := p_attacker_id;
      v_loser_id := p_defender_id;
      v_resolution := 'miner_defused_bomb';
    else
      v_winner_id := p_defender_id;
      v_loser_id := p_attacker_id;
      v_resolution := 'bomb_holds';
    end if;
  elsif v_attacker.rank_key = 'spy'
    and v_defender.rank_key = 'marshal'
    and v_attacker.kills_marshal_when_attacking then
    v_winner_id := p_attacker_id;
    v_loser_id := p_defender_id;
    v_resolution := 'spy_assassination';
  elsif v_attacker.strength > v_defender.strength then
    v_winner_id := p_attacker_id;
    v_loser_id := p_defender_id;
    v_resolution := 'attacker_wins';
  elsif v_defender.strength > v_attacker.strength then
    v_winner_id := p_defender_id;
    v_loser_id := p_attacker_id;
    v_resolution := 'defender_wins';
  else
    v_is_draw := true;
    v_resolution := 'draw';
  end if;

  if v_is_draw then
    update public.stratego_players
    set
      state = 'returning_to_base',
      eliminated_by_participant_id = case
        when participant_id = p_attacker_id then p_defender_id
        when participant_id = p_defender_id then p_attacker_id
        else eliminated_by_participant_id
      end,
      last_duel_at = v_now
    where participant_id in (p_attacker_id, p_defender_id)
      and session_id = p_session_id;

    v_attacker_state_after := 'returning_to_base';
    v_defender_state_after := 'returning_to_base';
  else
    update public.stratego_players
    set
      state = case
        when participant_id = v_loser_id then 'returning_to_base'
        else state
      end,
      eliminated_by_participant_id = case
        when participant_id = v_loser_id then v_winner_id
        when participant_id = v_winner_id then null
        else eliminated_by_participant_id
      end,
      last_duel_at = v_now
    where participant_id in (v_winner_id, v_loser_id)
      and session_id = p_session_id;

    if v_winner_id = p_attacker_id then
      v_attacker_state_after := 'alive';
      v_defender_state_after := 'returning_to_base';
    else
      v_attacker_state_after := 'returning_to_base';
      v_defender_state_after := 'alive';
    end if;
  end if;

  insert into public.stratego_duel_events (
    session_id,
    winner_id,
    loser_id,
    attacker_id,
    defender_id,
    attacker_role_key,
    defender_role_key,
    is_draw,
    created_at
  )
  values (
    p_session_id,
    v_winner_id,
    v_loser_id,
    p_attacker_id,
    p_defender_id,
    v_attacker.rank_key,
    v_defender.rank_key,
    v_is_draw,
    v_now
  );

  if v_winner_team is not null then
    update public.stratego_games
    set winner_team = v_winner_team
    where session_id = p_session_id
      and winner_team is distinct from v_winner_team;

    update public.live_sessions
    set status = 'finished'
    where id = p_session_id
      and coalesce(status, '') <> 'finished';

    update public.participants
    set finished_at = coalesce(finished_at, v_now)
    where session_id = p_session_id::text
      and finished_at is null;
  end if;

  return jsonb_build_object(
    'winner_id', v_winner_id,
    'loser_id', v_loser_id,
    'winner_team', v_winner_team,
    'attacker_id', p_attacker_id,
    'defender_id', p_defender_id,
    'attacker_role', v_attacker.display_name,
    'attacker_role_key', v_attacker.rank_key,
    'defender_role', v_defender.display_name,
    'defender_role_key', v_defender.rank_key,
    'attacker_state_after', v_attacker_state_after,
    'defender_state_after', v_defender_state_after,
    'is_draw', v_is_draw,
    'resolution', v_resolution,
    'resolved_at', v_now,
    'attacker_server_lat', v_attacker_live_lat,
    'attacker_server_lng', v_attacker_live_lng,
    'defender_server_lat', v_defender_live_lat,
    'defender_server_lng', v_defender_live_lng,
    'client_attacker_lat', p_attacker_lat,
    'client_attacker_lng', p_attacker_lng,
    'client_defender_lat', p_defender_lat,
    'client_defender_lng', p_defender_lng,
    'distance_meters', round(v_distance_between_players::numeric, 2),
    'defender_base_distance_meters', round(v_distance_defender_to_base::numeric, 2)
  );
end;
$$;

revoke all on function public.resolve_stratego_duel(
  uuid,
  uuid,
  uuid,
  double precision,
  double precision,
  double precision,
  double precision
) from public;
revoke all on function public.resolve_stratego_duel(
  uuid,
  uuid,
  uuid,
  double precision,
  double precision,
  double precision,
  double precision
) from anon;
revoke all on function public.resolve_stratego_duel(
  uuid,
  uuid,
  uuid,
  double precision,
  double precision,
  double precision,
  double precision
) from authenticated;
grant execute on function public.resolve_stratego_duel(
  uuid,
  uuid,
  uuid,
  double precision,
  double precision,
  double precision,
  double precision
) to anon, authenticated, service_role;

commit;
