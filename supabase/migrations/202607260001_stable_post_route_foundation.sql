begin;

alter table public.participants
  add column if not exists start_offset integer;

alter table public.participants
  drop constraint if exists participants_start_offset_nonnegative_check;

alter table public.participants
  add constraint participants_start_offset_nonnegative_check
  check (start_offset is null or start_offset >= 0);

comment on column public.participants.start_offset is
  'Zero-based start offset in the session post order. NULL means no route has been assigned.';

alter table public.gps_runs
  add column if not exists post_order_mode text;

alter table public.gps_runs
  alter column post_order_mode set default 'fixed';

alter table public.gps_runs
  drop constraint if exists gps_runs_post_order_mode_check;

alter table public.gps_runs
  add constraint gps_runs_post_order_mode_check
  check (
    post_order_mode in (
      'fixed',
      'distributed_circular',
      'random_per_assignment'
    )
  );

comment on column public.gps_runs.post_order_mode is
  'Post-order policy for new sessions. Legacy NULL values execute as fixed.';

alter table public.live_sessions
  add column if not exists post_order_mode text;

alter table public.live_sessions
  alter column post_order_mode set default 'fixed';

alter table public.live_sessions
  drop constraint if exists live_sessions_post_order_mode_check;

alter table public.live_sessions
  add constraint live_sessions_post_order_mode_check
  check (
    post_order_mode in (
      'fixed',
      'distributed_circular',
      'random_per_assignment'
    )
  );

comment on column public.live_sessions.post_order_mode is
  'Snapshot of the post-order policy used by this live session. Legacy NULL values execute as fixed.';

alter table public.live_sessions
  add column if not exists route_version integer;

alter table public.live_sessions
  alter column route_version set default 1;

alter table public.live_sessions
  drop constraint if exists live_sessions_route_version_positive_check;

alter table public.live_sessions
  add constraint live_sessions_route_version_positive_check
  check (route_version >= 1);

comment on column public.live_sessions.route_version is
  'Version of the deterministic route-assignment contract. Legacy NULL values fail closed to fixed order.';

commit;
