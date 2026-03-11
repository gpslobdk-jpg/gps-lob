alter table public.profiles
  add column if not exists plan_type text;

alter table public.profiles
  alter column plan_type set default 'free';

update public.profiles
set plan_type = 'free'
where plan_type is null;

alter table public.profiles
  add column if not exists access_expires_at timestamptz;
