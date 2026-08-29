begin;

-- One capability acknowledgement per authenticated teacher and copy version.
-- This is not a student consent register and stores no student, parent or run data.
create table if not exists public.pilen_realtime_teacher_acknowledgements (
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted boolean not null default true check (accepted = true),
  copy_version text not null check (
    char_length(copy_version) between 1 and 64
    and copy_version ~ '^[a-zA-Z0-9._-]+$'
  ),
  accepted_at timestamptz not null default now(),
  primary key (user_id, copy_version)
);

create index if not exists pilen_realtime_teacher_ack_accepted_at_idx
  on public.pilen_realtime_teacher_acknowledgements(accepted_at);

alter table public.pilen_realtime_teacher_acknowledgements enable row level security;
revoke all privileges on table public.pilen_realtime_teacher_acknowledgements
from public, anon, authenticated;
grant all privileges on table public.pilen_realtime_teacher_acknowledgements
to postgres, service_role;

-- Short-lived technical metadata used only to prevent repeated paid realtime
-- session starts. No audio, transcript, prompt, location or identity text is stored.
create table if not exists public.character_realtime_start_limits (
  post_index integer not null check (post_index >= 0),
  request_fingerprint text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null default 1,
  primary key (
    post_index,
    request_fingerprint,
    window_started_at
  ),
  constraint character_realtime_start_limits_fingerprint_check
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint character_realtime_start_limits_count_check
    check (attempt_count between 1 and 4)
);

create index if not exists character_realtime_start_limits_window_idx
  on public.character_realtime_start_limits(window_started_at);

alter table public.character_realtime_start_limits enable row level security;
revoke all privileges on table public.character_realtime_start_limits
from public, anon, authenticated;
grant all privileges on table public.character_realtime_start_limits
to postgres, service_role;

create or replace function public.consume_character_realtime_start_limit(
  p_session_id uuid,
  p_participant_id uuid,
  p_post_index integer,
  p_request_fingerprint text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
  window_start timestamptz := to_timestamp(
    floor(extract(epoch from p_now) / 300) * 300
  );
begin
  if p_post_index < 0 or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  if not exists (
    select 1
    from public.participants p
    join public.live_sessions ls on ls.id = p.session_id
    where p.id = p_participant_id
      and p.session_id = p_session_id
      and p.finished_at is null
      and coalesce(ls.status, '') in ('running', 'active', 'paused')
  ) then
    return false;
  end if;

  delete from public.character_realtime_start_limits
  where window_started_at < p_now - interval '1 hour';

  insert into public.character_realtime_start_limits (
    post_index,
    request_fingerprint,
    window_started_at,
    attempt_count
  ) values (
    p_post_index,
    p_request_fingerprint,
    window_start,
    1
  )
  on conflict (
    post_index,
    request_fingerprint,
    window_started_at
  )
  do update
    set attempt_count = character_realtime_start_limits.attempt_count + 1
    where character_realtime_start_limits.attempt_count < 4
  returning attempt_count into next_count;

  return coalesce(next_count, 5) <= 4;
end;
$$;

revoke all on function public.consume_character_realtime_start_limit(
  uuid,
  uuid,
  integer,
  text,
  timestamptz
)
from public, anon, authenticated;
grant execute on function public.consume_character_realtime_start_limit(
  uuid,
  uuid,
  integer,
  text,
  timestamptz
)
to postgres, service_role;

commit;
