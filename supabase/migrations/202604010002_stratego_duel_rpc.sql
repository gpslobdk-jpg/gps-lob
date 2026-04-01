begin;

drop function if exists public.resolve_stratego_duel(uuid, uuid, uuid);

create or replace function public.resolve_stratego_duel(
  p_attacker_id uuid,
  p_defender_id uuid,
  p_session_id uuid
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
  v_now timestamptz := now();
  v_winner_id uuid;
  v_loser_id uuid;
  v_attacker_state_after text := 'alive';
  v_defender_state_after text := 'alive';
  v_is_draw boolean := false;
  v_resolution text;
begin
  if p_attacker_id is null or p_defender_id is null or p_session_id is null then
    return null;
  end if;

  if p_attacker_id = p_defender_id then
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
    rd.kills_marshal_when_attacking
  into v_first_player
  from public.stratego_players as sp
  join public.stratego_role_definitions as rd
    on rd.rank_key = sp.rank_key
  where sp.participant_id = v_first_id
    and sp.session_id = p_session_id
  for update of sp;

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
    rd.kills_marshal_when_attacking
  into v_second_player
  from public.stratego_players as sp
  join public.stratego_role_definitions as rd
    on rd.rank_key = sp.rank_key
  where sp.participant_id = v_second_id
    and sp.session_id = p_session_id
  for update of sp;

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

  if v_defender.is_flag then
    v_winner_id := p_attacker_id;
    v_loser_id := p_defender_id;
    v_resolution := 'flag_captured';
  elsif v_attacker.is_flag then
    v_winner_id := p_defender_id;
    v_loser_id := p_attacker_id;
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
  elsif v_attacker.rank_key = 'spy' and v_defender.rank_key = 'marshal' and v_attacker.kills_marshal_when_attacking then
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

  return jsonb_build_object(
    'winner_id', v_winner_id,
    'loser_id', v_loser_id,
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
    'resolved_at', v_now
  );
end;
$$;

revoke all on function public.resolve_stratego_duel(uuid, uuid, uuid) from public;
revoke all on function public.resolve_stratego_duel(uuid, uuid, uuid) from anon;
revoke all on function public.resolve_stratego_duel(uuid, uuid, uuid) from authenticated;
grant execute on function public.resolve_stratego_duel(uuid, uuid, uuid) to service_role;

commit;
