begin;

-- Ensure RLS is enabled
alter table if exists public.live_sessions enable row level security;
alter table if exists public.participants enable row level security;

-- Drop any existing policies that referenced public.teacher_owns_session
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'live_sessions' and policyname like 'live_sessions_owner_%'
  ) then
    execute 'drop policy if exists live_sessions_owner_select on public.live_sessions';
    execute 'drop policy if exists live_sessions_owner_update on public.live_sessions';
  end if;

  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'participants' and policyname like 'participants_teacher_%'
  ) then
    execute 'drop policy if exists participants_teacher_select on public.participants';
    execute 'drop policy if exists participants_teacher_update on public.participants';
    execute 'drop policy if exists participants_teacher_delete on public.participants';
  end if;
end
$$;

-- Create owner policies using direct joins: gps_runs.user_id must equal auth.uid()
-- Teacher can SELECT participants for sessions whose run is owned by them
create policy if not exists participants_teacher_select
on public.participants
for select
to authenticated
using (
  exists (
    select 1
    from public.live_sessions ls
    join public.gps_runs gr on gr.id = ls.run_id
    where ls.id = public.participants.session_id
      and gr.user_id = auth.uid()
  )
);

create policy if not exists participants_teacher_update
on public.participants
for update
to authenticated
using (
  exists (
    select 1
    from public.live_sessions ls
    join public.gps_runs gr on gr.id = ls.run_id
    where ls.id = public.participants.session_id
      and gr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.live_sessions ls
    join public.gps_runs gr on gr.id = ls.run_id
    where ls.id = public.participants.session_id
      and gr.user_id = auth.uid()
  )
);

create policy if not exists participants_teacher_delete
on public.participants
for delete
to authenticated
using (
  exists (
    select 1
    from public.live_sessions ls
    join public.gps_runs gr on gr.id = ls.run_id
    where ls.id = public.participants.session_id
      and gr.user_id = auth.uid()
  )
);

-- Keep existing player policies (assume helper functions like request_participant_id exist)
-- If you prefer, replace these with direct checks against request headers/jwt claims.

commit;
