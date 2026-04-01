begin;

do $$
declare
  constraint_record record;
begin
  if to_regclass('public.live_sessions') is null then
    return;
  end if;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.live_sessions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format(
      'alter table public.live_sessions drop constraint %I',
      constraint_record.conname
    );
  end loop;

  alter table public.live_sessions
    add constraint live_sessions_status_check
    check (
      status is null
      or status in ('waiting', 'scheduled', 'running', 'active', 'paused', 'finished')
    );
end
$$;

create or replace function public.active_session_exists(target_session_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.live_sessions as ls
    where ls.id::text = target_session_id
      and coalesce(ls.status, '') <> 'finished'
  );
$$;

commit;
