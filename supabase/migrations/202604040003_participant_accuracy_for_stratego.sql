begin;

alter table public.participants
  add column if not exists accuracy double precision;

comment on column public.participants.accuracy is
  'Seneste accepterede GPS-usikkerhed i meter fra klientens Geolocation API.';

create or replace view public.stratego_presence_view as
select
  p.id as participant_id,
  p.session_id,
  sp.team_code,
  sp.state,
  p.lat,
  p.lng,
  p.updated_at,
  p.accuracy
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
  p.accuracy
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
    join public.stratego_players as self_sp
      on self_sp.participant_id = self.id
     and self_sp.session_id = self.session_id
    where self.id::text = public.request_participant_id()
      and self.session_id = p.session_id
      and self_sp.team_code = sp.team_code
  )
) or public.teacher_owns_session(p.session_id::text);

revoke all on public.stratego_ally_view from public;
revoke all on public.stratego_ally_view from anon, authenticated;
grant select on public.stratego_ally_view to anon, authenticated;

commit;
