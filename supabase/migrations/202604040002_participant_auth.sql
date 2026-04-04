begin;

alter table public.participants
  add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'participants_auth_user_id_fkey'
  ) then
    alter table public.participants
      add constraint participants_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users (id)
      on delete set null;
  end if;
end
$$;

create unique index if not exists participants_auth_user_id_idx
  on public.participants (auth_user_id)
  where auth_user_id is not null;

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
as $$
  select
    public.request_participant_id() = target_participant_id
    and public.request_session_id() = target_session_id;
$$;

revoke all on function public.request_participant_id() from public;
revoke all on function public.request_session_id() from public;
grant execute on function public.request_participant_id() to anon, authenticated, service_role;
grant execute on function public.request_session_id() to anon, authenticated, service_role;

commit;
