-- The public, teacher-facing assistant has a small shared daily request budget.
-- Only the server's service role may consume it. No message, address or user ID
-- is stored: the caller supplies a rotating HMAC fingerprint.

create table public.assistant_request_limits (
  request_fingerprint text not null
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  minute_started_at timestamptz not null,
  request_count integer not null default 1
    check (request_count between 1 and 4),
  primary key (request_fingerprint, minute_started_at)
);

create index assistant_request_limits_minute_idx
  on public.assistant_request_limits (minute_started_at);

alter table public.assistant_request_limits enable row level security;
revoke all on table public.assistant_request_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.assistant_request_limits
  to service_role;

create table public.assistant_daily_budget (
  budget_day date primary key,
  request_count integer not null default 1
    check (request_count between 1 and 500)
);

alter table public.assistant_daily_budget enable row level security;
revoke all on table public.assistant_daily_budget from public, anon, authenticated;
grant select, insert, update, delete on table public.assistant_daily_budget
  to service_role;

create or replace function public.consume_assistant_request_limit(
  p_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_minute timestamptz := pg_catalog.date_trunc('minute', v_now);
  v_day date := (v_now at time zone 'UTC')::date;
  v_count integer;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  -- Fast reject after the daily cap. The later upsert remains the atomic check.
  select request_count into v_count
  from public.assistant_daily_budget
  where budget_day = v_day;
  if coalesce(v_count, 0) >= 500 then
    return false;
  end if;

  -- Bounded cleanup keeps the short-lived abuse signal short-lived.
  delete from public.assistant_request_limits
  where minute_started_at < v_minute - interval '2 days';

  delete from public.assistant_daily_budget
  where budget_day < v_day - 30;

  insert into public.assistant_request_limits (
    request_fingerprint, minute_started_at, request_count
  ) values (p_fingerprint, v_minute, 1)
  on conflict (request_fingerprint, minute_started_at)
  do update set request_count = public.assistant_request_limits.request_count + 1
    where public.assistant_request_limits.request_count < 4
  returning request_count into v_count;

  if v_count is null then
    return false;
  end if;

  -- Only accepted per-IP attempts spend the shared daily budget.
  insert into public.assistant_daily_budget (budget_day, request_count)
  values (v_day, 1)
  on conflict (budget_day)
  do update set request_count = public.assistant_daily_budget.request_count + 1
    where public.assistant_daily_budget.request_count < 500
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_assistant_request_limit(text)
  from public, anon, authenticated;
grant execute on function public.consume_assistant_request_limit(text)
  to service_role;
