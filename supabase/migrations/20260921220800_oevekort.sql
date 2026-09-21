begin;

create extension if not exists pgcrypto;

create table public.oevekort_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references auth.users(id)
    on delete cascade,
  title text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint oevekort_sets_title_check
    check (char_length(title) between 1 and 120)
);

create table public.oevekort_cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null
    references public.oevekort_sets(id)
    on delete cascade,
  sort_order integer not null,
  front_text text not null,
  back_text text not null,
  accepted_answers text[] not null default '{}'::text[],
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint oevekort_cards_sort_order_check
    check (sort_order >= 0),
  constraint oevekort_cards_front_text_check
    check (char_length(front_text) between 1 and 1000),
  constraint oevekort_cards_back_text_check
    check (char_length(back_text) between 1 and 1000),
  constraint oevekort_cards_accepted_answers_count_check
    check (cardinality(accepted_answers) <= 12),
  constraint oevekort_cards_set_sort_order_unique
    unique (set_id, sort_order)
);

create table public.oevekort_shares (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null
    references public.oevekort_sets(id)
    on delete cascade,
  owner_id uuid not null
    references auth.users(id)
    on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint oevekort_shares_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint oevekort_shares_expires_after_creation_check
    check (expires_at is null or expires_at > created_at)
);

create index oevekort_sets_owner_updated_idx
  on public.oevekort_sets (owner_id, updated_at desc);

create index oevekort_cards_set_sort_order_idx
  on public.oevekort_cards (set_id, sort_order);

create index oevekort_shares_owner_created_idx
  on public.oevekort_shares (owner_id, created_at desc);

create unique index oevekort_shares_one_unrevoked_per_set_idx
  on public.oevekort_shares (set_id)
  where revoked_at is null;

alter table public.oevekort_sets enable row level security;
alter table public.oevekort_sets force row level security;
alter table public.oevekort_cards enable row level security;
alter table public.oevekort_cards force row level security;
alter table public.oevekort_shares enable row level security;
alter table public.oevekort_shares force row level security;

-- Browser roles do not receive direct table grants. All application access is
-- mediated by authenticated Next.js routes and service-role-only RPCs below.
revoke all privileges on table public.oevekort_sets
  from public, anon, authenticated, service_role;
revoke all privileges on table public.oevekort_cards
  from public, anon, authenticated, service_role;
revoke all privileges on table public.oevekort_shares
  from public, anon, authenticated, service_role;

create or replace function public.oevekort_replace_cards(
  p_set_id uuid,
  p_cards jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card jsonb;
  v_answer jsonb;
  v_front text;
  v_back text;
  v_alternatives jsonb;
  v_answers text[];
  v_card_count integer;
  v_sort_order integer := 0;
begin
  if p_set_id is null
    or p_cards is null
    or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'oevekort_invalid_payload' using errcode = '22023';
  end if;

  v_card_count := jsonb_array_length(p_cards);
  if v_card_count < 1 or v_card_count > 200 then
    raise exception 'oevekort_invalid_payload' using errcode = '22023';
  end if;

  delete from public.oevekort_cards
  where set_id = p_set_id;

  for v_card in
    select value from jsonb_array_elements(p_cards)
  loop
    if jsonb_typeof(v_card) <> 'object'
      or jsonb_typeof(v_card -> 'front') is distinct from 'string'
      or jsonb_typeof(v_card -> 'back') is distinct from 'string' then
      raise exception 'oevekort_invalid_payload' using errcode = '22023';
    end if;

    v_front := btrim(v_card ->> 'front');
    v_back := btrim(v_card ->> 'back');
    if v_front = ''
      or v_back = ''
      or char_length(v_front) > 1000
      or char_length(v_back) > 1000 then
      raise exception 'oevekort_invalid_payload' using errcode = '22023';
    end if;

    v_alternatives := coalesce(v_card -> 'acceptedAnswers', '[]'::jsonb);
    if jsonb_typeof(v_alternatives) <> 'array'
      or jsonb_array_length(v_alternatives) > 12 then
      raise exception 'oevekort_invalid_payload' using errcode = '22023';
    end if;

    v_answers := '{}'::text[];
    for v_answer in
      select value from jsonb_array_elements(v_alternatives)
    loop
      if jsonb_typeof(v_answer) <> 'string' then
        raise exception 'oevekort_invalid_payload' using errcode = '22023';
      end if;

      v_answers := array_append(v_answers, btrim(v_answer #>> '{}'));
      if v_answers[array_length(v_answers, 1)] = ''
        or char_length(v_answers[array_length(v_answers, 1)]) > 250 then
        raise exception 'oevekort_invalid_payload' using errcode = '22023';
      end if;
    end loop;

    insert into public.oevekort_cards (
      set_id,
      sort_order,
      front_text,
      back_text,
      accepted_answers
    )
    values (
      p_set_id,
      v_sort_order,
      v_front,
      v_back,
      v_answers
    );

    v_sort_order := v_sort_order + 1;
  end loop;
end;
$$;

create or replace function public.create_oevekort_set(
  p_owner_id uuid,
  p_title text,
  p_cards jsonb
)
returns table (
  set_id uuid,
  set_created_at timestamptz,
  set_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_set_id uuid;
  v_created_at timestamptz;
  v_updated_at timestamptz;
begin
  if p_owner_id is null then
    raise exception 'oevekort_auth_required' using errcode = '28000';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' or char_length(v_title) > 120 then
    raise exception 'oevekort_invalid_payload' using errcode = '22023';
  end if;

  insert into public.oevekort_sets (owner_id, title)
  values (p_owner_id, v_title)
  returning id, created_at, updated_at
    into v_set_id, v_created_at, v_updated_at;

  perform public.oevekort_replace_cards(v_set_id, p_cards);

  return query
  select v_set_id, v_created_at, v_updated_at;
end;
$$;

create or replace function public.get_oevekort_set(
  p_set_id uuid,
  p_owner_id uuid
)
returns table (
  set_id uuid,
  set_title text,
  set_created_at timestamptz,
  set_updated_at timestamptz,
  set_cards jsonb
)
language sql
security definer
set search_path = ''
as $$
  select
    s.id,
    s.title,
    s.created_at,
    s.updated_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'front', c.front_text,
          'back', c.back_text,
          'acceptedAnswers', c.accepted_answers
        )
        order by c.sort_order
      ) filter (where c.id is not null),
      '[]'::jsonb
    )
  from public.oevekort_sets s
  left join public.oevekort_cards c
    on c.set_id = s.id
  where s.id = p_set_id
    and s.owner_id = p_owner_id
  group by s.id, s.title, s.created_at, s.updated_at;
$$;

create or replace function public.list_oevekort_sets(
  p_owner_id uuid
)
returns table (
  set_id uuid,
  set_title text,
  card_count integer,
  set_created_at timestamptz,
  set_updated_at timestamptz,
  sharing_active boolean,
  share_created_at timestamptz,
  share_expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    s.id,
    s.title,
    count(c.id)::integer,
    s.created_at,
    s.updated_at,
    coalesce(
      sh.id is not null
      and (sh.expires_at is null or sh.expires_at > clock_timestamp()),
      false
    ),
    sh.created_at,
    sh.expires_at
  from public.oevekort_sets s
  left join public.oevekort_cards c
    on c.set_id = s.id
  left join lateral (
    select shares.id, shares.created_at, shares.expires_at
    from public.oevekort_shares shares
    where shares.set_id = s.id
      and shares.owner_id = p_owner_id
      and shares.revoked_at is null
    order by shares.created_at desc
    limit 1
  ) sh on true
  where s.owner_id = p_owner_id
  group by
    s.id,
    s.title,
    s.created_at,
    s.updated_at,
    sh.id,
    sh.created_at,
    sh.expires_at
  order by s.updated_at desc, s.id;
$$;

create or replace function public.update_oevekort_set(
  p_set_id uuid,
  p_owner_id uuid,
  p_title text,
  p_cards jsonb
)
returns table (
  set_id uuid,
  set_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_updated_at timestamptz;
begin
  if p_set_id is null or p_owner_id is null then
    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' or char_length(v_title) > 120 then
    raise exception 'oevekort_invalid_payload' using errcode = '22023';
  end if;

  update public.oevekort_sets
  set title = v_title,
      updated_at = clock_timestamp()
  where id = p_set_id
    and owner_id = p_owner_id
  returning updated_at into v_updated_at;

  if not found then
    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  perform public.oevekort_replace_cards(p_set_id, p_cards);

  return query
  select p_set_id, v_updated_at;
end;
$$;

create or replace function public.copy_oevekort_set(
  p_source_set_id uuid,
  p_owner_id uuid
)
returns table (
  copied_set_id uuid,
  copied_set_created_at timestamptz,
  copied_set_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_title text;
  v_copy_title text;
  v_copy_id uuid;
  v_created_at timestamptz;
  v_updated_at timestamptz;
begin
  if p_source_set_id is null or p_owner_id is null then
    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  select s.title
    into v_source_title
  from public.oevekort_sets s
  where s.id = p_source_set_id
    and s.owner_id = p_owner_id
  for share;

  if not found then
    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  v_copy_title :=
    case
      when char_length(v_source_title) <= 113 then v_source_title || ' (kopi)'
      else substring(v_source_title from 1 for 113) || ' (kopi)'
    end;

  insert into public.oevekort_sets (owner_id, title)
  values (p_owner_id, v_copy_title)
  returning id, created_at, updated_at
    into v_copy_id, v_created_at, v_updated_at;

  insert into public.oevekort_cards (
    set_id,
    sort_order,
    front_text,
    back_text,
    accepted_answers
  )
  select
    v_copy_id,
    c.sort_order,
    c.front_text,
    c.back_text,
    c.accepted_answers
  from public.oevekort_cards c
  where c.set_id = p_source_set_id
  order by c.sort_order;

  return query
  select v_copy_id, v_created_at, v_updated_at;
end;
$$;

create or replace function public.delete_oevekort_set(
  p_set_id uuid,
  p_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.oevekort_sets
  where id = p_set_id
    and owner_id = p_owner_id;

  if not found then
    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function public.get_oevekort_share_status(
  p_set_id uuid,
  p_owner_id uuid
)
returns table (
  share_id uuid,
  share_created_at timestamptz,
  share_expires_at timestamptz,
  sharing_active boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.oevekort_sets s
    where s.id = p_set_id
      and s.owner_id = p_owner_id
  ) then
    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  return query
  select
    shares.id,
    shares.created_at,
    shares.expires_at,
    shares.expires_at is null or shares.expires_at > clock_timestamp()
  from public.oevekort_shares shares
  where shares.set_id = p_set_id
    and shares.owner_id = p_owner_id
    and shares.revoked_at is null
  order by shares.created_at desc
  limit 1;
end;
$$;

create or replace function public.create_oevekort_share(
  p_set_id uuid,
  p_owner_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default null
)
returns table (
  share_id uuid,
  share_created_at timestamptz,
  share_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share_id uuid;
  v_created_at timestamptz;
  v_expires_at timestamptz;
begin
  if p_set_id is null or p_owner_id is null then
    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'oevekort_share_token_invalid' using errcode = '22023';
  end if;

  if p_expires_at is not null and p_expires_at <= clock_timestamp() then
    raise exception 'oevekort_share_expiry_invalid' using errcode = '22023';
  end if;

  perform 1
  from public.oevekort_sets s
  where s.id = p_set_id
    and s.owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  update public.oevekort_shares
  set revoked_at = clock_timestamp()
  where set_id = p_set_id
    and owner_id = p_owner_id
    and revoked_at is null;

  insert into public.oevekort_shares (
    set_id,
    owner_id,
    token_hash,
    expires_at
  )
  values (
    p_set_id,
    p_owner_id,
    p_token_hash,
    p_expires_at
  )
  returning id, created_at, expires_at
    into v_share_id, v_created_at, v_expires_at;

  return query
  select v_share_id, v_created_at, v_expires_at;
end;
$$;

create or replace function public.update_oevekort_share_expiry(
  p_set_id uuid,
  p_owner_id uuid,
  p_expires_at timestamptz default null
)
returns table (
  share_id uuid,
  share_created_at timestamptz,
  share_expires_at timestamptz,
  sharing_active boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_expires_at is not null and p_expires_at <= clock_timestamp() then
    raise exception 'oevekort_share_expiry_invalid' using errcode = '22023';
  end if;

  update public.oevekort_shares
  set expires_at = p_expires_at
  where set_id = p_set_id
    and owner_id = p_owner_id
    and revoked_at is null
  returning
    id,
    created_at,
    expires_at,
    expires_at is null or expires_at > clock_timestamp()
  into
    share_id,
    share_created_at,
    share_expires_at,
    sharing_active;

  if not found then
    if exists (
      select 1
      from public.oevekort_sets s
      where s.id = p_set_id
        and s.owner_id = p_owner_id
    ) then
      raise exception 'oevekort_share_unavailable' using errcode = 'P0002';
    end if;

    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  return next;
end;
$$;

create or replace function public.revoke_oevekort_share(
  p_set_id uuid,
  p_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.oevekort_shares
  set revoked_at = clock_timestamp()
  where set_id = p_set_id
    and owner_id = p_owner_id
    and revoked_at is null;

  if not found then
    if exists (
      select 1
      from public.oevekort_sets s
      where s.id = p_set_id
        and s.owner_id = p_owner_id
    ) then
      raise exception 'oevekort_share_unavailable' using errcode = 'P0002';
    end if;

    raise exception 'oevekort_set_unavailable' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function public.read_oevekort_public_share(
  p_token_hash text
)
returns table (
  public_set_title text,
  public_set_cards jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set_id uuid;
  v_share_owner_id uuid;
  v_set_owner_id uuid;
  v_title text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'oevekort_share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  select shares.set_id, shares.owner_id
    into v_set_id, v_share_owner_id
  from public.oevekort_shares shares
  where shares.token_hash = p_token_hash
    and shares.revoked_at is null
    and (shares.expires_at is null or shares.expires_at > clock_timestamp())
  for share;

  if not found then
    raise exception 'oevekort_share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  select s.owner_id, s.title
    into v_set_owner_id, v_title
  from public.oevekort_sets s
  where s.id = v_set_id
  for share;

  if not found or v_set_owner_id is distinct from v_share_owner_id then
    raise exception 'oevekort_share_invalid_or_inactive' using errcode = 'P0002';
  end if;

  return query
  select
    v_title,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'front', c.front_text,
          'back', c.back_text,
          'acceptedAnswers', c.accepted_answers
        )
        order by c.sort_order
      ),
      '[]'::jsonb
    )
  from public.oevekort_cards c
  where c.set_id = v_set_id;
end;
$$;

revoke execute on function public.oevekort_replace_cards(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.create_oevekort_set(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.get_oevekort_set(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.list_oevekort_sets(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.update_oevekort_set(uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.copy_oevekort_set(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.delete_oevekort_set(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.get_oevekort_share_status(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.create_oevekort_share(uuid, uuid, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function public.update_oevekort_share_expiry(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke execute on function public.revoke_oevekort_share(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.read_oevekort_public_share(text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_oevekort_set(uuid, text, jsonb) to service_role;
grant execute on function public.get_oevekort_set(uuid, uuid) to service_role;
grant execute on function public.list_oevekort_sets(uuid) to service_role;
grant execute on function public.update_oevekort_set(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.copy_oevekort_set(uuid, uuid) to service_role;
grant execute on function public.delete_oevekort_set(uuid, uuid) to service_role;
grant execute on function public.get_oevekort_share_status(uuid, uuid) to service_role;
grant execute on function public.create_oevekort_share(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.update_oevekort_share_expiry(uuid, uuid, timestamptz) to service_role;
grant execute on function public.revoke_oevekort_share(uuid, uuid) to service_role;
grant execute on function public.read_oevekort_public_share(text) to service_role;

comment on table public.oevekort_sets is
  'Private teacher-owned Øvekort sets. Access only through server-side RPCs.';
comment on table public.oevekort_cards is
  'Ordered text cards for a private Øvekort set. Access only through server-side RPCs.';
comment on table public.oevekort_shares is
  'Revocable, hashed Øvekort bearer links. Raw bearer tokens are never stored.';

commit;
