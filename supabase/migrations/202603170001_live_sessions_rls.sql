begin;

alter table public.live_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_sessions'
      and policyname = 'live_sessions_owner_select'
  ) then
    create policy live_sessions_owner_select
    on public.live_sessions
    for select
    to authenticated
    using (public.teacher_owns_session(id::text));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_sessions'
      and policyname = 'live_sessions_owner_update'
  ) then
    create policy live_sessions_owner_update
    on public.live_sessions
    for update
    to authenticated
    using (public.teacher_owns_session(id::text))
    with check (public.teacher_owns_session(id::text));
  end if;
end
$$;

commit;
