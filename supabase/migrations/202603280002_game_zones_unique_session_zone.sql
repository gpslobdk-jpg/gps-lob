with ranked_zones as (
  select
    id,
    row_number() over (
      partition by session_id, zone_index
      order by
        (owner_team_id is not null) desc,
        shield_until desc nulls last,
        created_at desc,
        id desc
    ) as row_rank
  from public.game_zones
)
delete from public.game_zones
where id in (
  select id
  from ranked_zones
  where row_rank > 1
);

create unique index if not exists game_zones_session_zone_index_uidx
  on public.game_zones (session_id, zone_index);