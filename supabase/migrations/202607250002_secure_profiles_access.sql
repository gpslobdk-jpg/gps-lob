begin;

alter table public.profiles enable row level security;

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_select_own on public.profiles;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

revoke all privileges on table public.profiles
from public, anon, authenticated;

grant select (
  id,
  plan_type,
  access_expires_at,
  has_used_free_trial,
  stripe_customer_id,
  stripe_current_period_end,
  cancel_at_period_end,
  marketing_consent
)
on table public.profiles
to authenticated;

grant all privileges on table public.profiles to service_role;

commit;
