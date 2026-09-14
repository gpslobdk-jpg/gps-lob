begin;

-- This helper is used by teacher policies on participants and answers. It also
-- reads live_sessions, so it must bypass the policies on that same table.
-- Without SECURITY DEFINER, Postgres can re-enter the participant policy via
-- live_sessions_participant_select until it reaches max_stack_depth.
create or replace function public.teacher_owns_session(target_session_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.live_sessions as ls
      join public.gps_runs as gr
        on gr.id = ls.run_id
      where ls.id::text = target_session_id
        and gr.user_id = auth.uid()
    );
$$;

revoke all on function public.teacher_owns_session(text) from public;
grant execute on function public.teacher_owns_session(text)
  to authenticated, service_role;

commit;
