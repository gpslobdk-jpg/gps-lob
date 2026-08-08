create table if not exists public.family_sso_requests (
  id uuid primary key default gen_random_uuid(),
  request_hash text not null unique,
  nonce_hash text not null,
  destination_origin text not null,
  return_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'consumed', 'cancelled')),
  user_id uuid references auth.users(id) on delete cascade,
  verified_email text,
  display_name text,
  identity_provider text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  authorized_at timestamptz,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  constraint family_sso_request_hash_format
    check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint family_sso_nonce_hash_format
    check (nonce_hash ~ '^[a-f0-9]{64}$'),
  constraint family_sso_destination_origin_format
    check (destination_origin ~ '^https?://[^/]+$'),
  constraint family_sso_return_path_format
    check (return_path ~ '^/[^\\]*$'),
  constraint family_sso_expiry_window
    check (expires_at > created_at and expires_at <= created_at + interval '2 minutes')
);

create index if not exists family_sso_requests_expiry_idx
  on public.family_sso_requests (status, expires_at);

create index if not exists family_sso_requests_user_idx
  on public.family_sso_requests (user_id, status)
  where user_id is not null;

alter table public.family_sso_requests enable row level security;
revoke all on table public.family_sso_requests from public, anon, authenticated;
grant all privileges on table public.family_sso_requests to service_role;

create table if not exists public.dagenstavle_family_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text,
  terms_accepted_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  last_sso_at timestamptz
);

alter table public.dagenstavle_family_profiles enable row level security;
revoke all on table public.dagenstavle_family_profiles from public, anon, authenticated;
grant all privileges on table public.dagenstavle_family_profiles to service_role;

create or replace function public.authorize_family_sso_request(
  p_request_hash text,
  p_user_id uuid,
  p_verified_email text,
  p_display_name text,
  p_identity_provider text,
  p_destination_origin text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  update public.family_sso_requests
  set
    status = 'authorized',
    user_id = p_user_id,
    verified_email = lower(nullif(btrim(p_verified_email), '')),
    display_name = left(nullif(btrim(p_display_name), ''), 160),
    identity_provider = left(nullif(btrim(p_identity_provider), ''), 80),
    authorized_at = now()
  where request_hash = p_request_hash
    and destination_origin = p_destination_origin
    and status = 'pending'
    and expires_at > now()
    and user_id is null
  returning status into v_status;

  if v_status = 'authorized' then
    return 'authorized';
  end if;

  select case
    when r.expires_at <= now() then 'expired'
    else r.status
  end
  into v_status
  from public.family_sso_requests r
  where r.request_hash = p_request_hash
    and r.destination_origin = p_destination_origin;

  return coalesce(v_status, 'invalid');
end;
$$;

create or replace function public.consume_family_sso_request(
  p_request_hash text,
  p_nonce_hash text,
  p_destination_origin text
)
returns table (
  user_id uuid,
  verified_email text,
  return_path text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.family_sso_requests r
  set
    status = 'consumed',
    consumed_at = now()
  where r.request_hash = p_request_hash
    and r.nonce_hash = p_nonce_hash
    and r.destination_origin = p_destination_origin
    and r.status = 'authorized'
    and r.expires_at > now()
    and r.user_id is not null
    and r.verified_email is not null
  returning r.user_id, r.verified_email, r.return_path;
end;
$$;

create or replace function public.invalidate_family_sso_request(
  p_request_hash text,
  p_nonce_hash text,
  p_destination_origin text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.family_sso_requests r
  set status = 'cancelled', cancelled_at = now()
  where r.request_hash = p_request_hash
    and r.nonce_hash = p_nonce_hash
    and r.destination_origin = p_destination_origin
    and r.status in ('pending', 'authorized')
  returning r.id into v_id;

  return v_id is not null;
end;
$$;

create or replace function public.revoke_family_sso_requests_for_user(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.family_sso_requests
  set status = 'cancelled', cancelled_at = now()
  where user_id = p_user_id
    and status = 'authorized'
    and expires_at > now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.delete_expired_family_sso_requests(
  p_cutoff timestamptz default now() - interval '1 day'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.family_sso_requests
  where expires_at < least(p_cutoff, now() - interval '2 minutes');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.authorize_family_sso_request(text, uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.consume_family_sso_request(text, text, text)
  from public, anon, authenticated;
revoke all on function public.invalidate_family_sso_request(text, text, text)
  from public, anon, authenticated;
revoke all on function public.revoke_family_sso_requests_for_user(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_expired_family_sso_requests(timestamptz)
  from public, anon, authenticated;

grant execute on function public.authorize_family_sso_request(text, uuid, text, text, text, text)
  to service_role;
grant execute on function public.consume_family_sso_request(text, text, text)
  to service_role;
grant execute on function public.invalidate_family_sso_request(text, text, text)
  to service_role;
grant execute on function public.revoke_family_sso_requests_for_user(uuid)
  to service_role;
grant execute on function public.delete_expired_family_sso_requests(timestamptz)
  to service_role;

comment on table public.family_sso_requests is
  'Kortlivede, hash-baserede og single-use login-overdragelser fra SkoleGPS til DagensTavle.';
comment on table public.dagenstavle_family_profiles is
  'Minimal DagensTavle-kontostatus og særskilt accept af DagensTavles vilkår.';
