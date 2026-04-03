alter table if exists public.live_sessions
  add column if not exists ends_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'live_sessions'
      and column_name = 'finished_at'
  ) then
    execute $sql$
      update public.live_sessions
      set ends_at = coalesce(ends_at, finished_at)
      where coalesce(status, '') = 'finished'
        and finished_at is not null
    $sql$;
  end if;
end
$$;
