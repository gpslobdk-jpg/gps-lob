alter table public.profiles
add column if not exists has_used_free_trial boolean not null default false;
