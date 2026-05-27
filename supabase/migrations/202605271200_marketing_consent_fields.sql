alter table public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_text text,
  add column if not exists marketing_consent_source text;

-- Ensure authenticated users can insert and update their own profiles row.
-- Uses DO blocks for idempotency since PostgreSQL lacks CREATE POLICY IF NOT EXISTS.
-- SELECT policy is intentionally left untouched (already configured in dashboard).
-- RLS enable/disable is intentionally left to the Supabase dashboard (not managed here).

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own
      on public.profiles
      for insert
      to authenticated
      with check (auth.uid() = id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;
