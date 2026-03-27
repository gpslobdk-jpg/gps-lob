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