begin;

create or replace function public.request_header(header_name text)
returns text
language sql
stable
as $$
  select nullif(
    coalesce(
      (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> lower(header_name)),
      (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> header_name)
    ),
    ''
  );
$$;

create or replace function public.request_participant_id()
returns text
language sql
stable
as $$
  select public.request_header('x-participant-id');
$$;

create or replace function public.request_session_id()
returns text
language sql
stable
as $$
  select public.request_header('x-session-id');
$$;

create or replace function public.teacher_owns_session(target_session_id text)
returns boolean
language sql
stable
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.live_sessions as ls
      join public.gps_runs as gr
        on gr.id = ls.run_id
      where ls.id::text = target_session_id
        and gr.user_id = auth.uid()
    );
$$;

create or replace function public.active_session_exists(target_session_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.live_sessions as ls
    where ls.id::text = target_session_id
      and coalesce(ls.status, '') in ('waiting', 'running')
  );
$$;

create or replace function public.player_matches_participant(target_participant_id text, target_session_id text)
returns boolean
language sql
stable
as $$
  select
    public.request_participant_id() = target_participant_id
    and public.request_session_id() = target_session_id;
$$;

create or replace function public._align_fk_column_type(
  child_table regclass,
  child_column text,
  parent_table regclass,
  parent_column text
)
returns void
language plpgsql
as $$
declare
  child_type text;
  parent_type text;
  cast_expression text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into child_type
  from pg_attribute as a
  where a.attrelid = child_table
    and a.attname = child_column
    and a.attnum > 0
    and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod)
  into parent_type
  from pg_attribute as a
  where a.attrelid = parent_table
    and a.attname = parent_column
    and a.attnum > 0
    and not a.attisdropped;

  if child_type is null or parent_type is null or child_type = parent_type then
    return;
  end if;

  cast_expression :=
    case
      when parent_type = 'uuid' then format('nullif(%1$I::text, '''')::uuid', child_column)
      else format('%1$I::%2$s', child_column, parent_type)
    end;

  execute format(
    'alter table %s alter column %I type %s using %s',
    child_table,
    child_column,
    parent_type,
    cast_expression
  );
end;
$$;

create or replace function public._drop_fk_constraints(
  child_table regclass,
  child_column text,
  parent_table regclass
)
returns void
language plpgsql
as $$
declare
  existing_constraint record;
begin
  for existing_constraint in
    select con.conname
    from pg_constraint as con
    where con.contype = 'f'
      and con.conrelid = child_table
      and con.confrelid = parent_table
      and array_length(con.conkey, 1) = 1
      and exists (
        select 1
        from pg_attribute as a
        where a.attrelid = con.conrelid
          and a.attnum = con.conkey[1]
          and a.attname = child_column
      )
  loop
    execute format('alter table %s drop constraint %I', child_table, existing_constraint.conname);
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.questions') is not null and to_regclass('public.gps_runs') is not null then
    perform public._align_fk_column_type('public.questions', 'run_id', 'public.gps_runs', 'id');
    perform public._drop_fk_constraints('public.questions', 'run_id', 'public.gps_runs');
    alter table public.questions
      add constraint questions_run_id_fkey
      foreign key (run_id)
      references public.gps_runs (id)
      on delete cascade;
  end if;

  if to_regclass('public.live_sessions') is not null and to_regclass('public.gps_runs') is not null then
    perform public._align_fk_column_type('public.live_sessions', 'run_id', 'public.gps_runs', 'id');
    perform public._drop_fk_constraints('public.live_sessions', 'run_id', 'public.gps_runs');
    alter table public.live_sessions
      add constraint live_sessions_run_id_fkey
      foreign key (run_id)
      references public.gps_runs (id)
      on delete cascade;
  end if;

  if to_regclass('public.participants') is not null and to_regclass('public.live_sessions') is not null then
    perform public._align_fk_column_type('public.participants', 'session_id', 'public.live_sessions', 'id');
    perform public._drop_fk_constraints('public.participants', 'session_id', 'public.live_sessions');
    alter table public.participants
      add constraint participants_session_id_fkey
      foreign key (session_id)
      references public.live_sessions (id)
      on delete cascade;
  end if;

  if to_regclass('public.answers') is not null and to_regclass('public.live_sessions') is not null then
    perform public._align_fk_column_type('public.answers', 'session_id', 'public.live_sessions', 'id');
    perform public._drop_fk_constraints('public.answers', 'session_id', 'public.live_sessions');
    alter table public.answers
      add constraint answers_session_id_fkey
      foreign key (session_id)
      references public.live_sessions (id)
      on delete cascade;
  end if;
end
$$;

drop function if exists public._drop_fk_constraints(regclass, text, regclass);
drop function if exists public._align_fk_column_type(regclass, text, regclass, text);

alter table public.participants enable row level security;
alter table public.answers enable row level security;

do $$
declare
  participant_policy record;
begin
  for participant_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'participants'
  loop
    execute format('drop policy if exists %I on public.participants', participant_policy.policyname);
  end loop;
end
$$;

do $$
declare
  answer_policy record;
begin
  for answer_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'answers'
  loop
    execute format('drop policy if exists %I on public.answers', answer_policy.policyname);
  end loop;
end
$$;

revoke all on public.participants from anon, authenticated;
revoke all on public.answers from anon, authenticated;

grant select, insert, update, delete on public.participants to anon, authenticated;
grant select, insert, update, delete on public.answers to anon, authenticated;

create policy participants_teacher_select
on public.participants
for select
to authenticated
using (public.teacher_owns_session(session_id::text));

create policy participants_teacher_update
on public.participants
for update
to authenticated
using (public.teacher_owns_session(session_id::text))
with check (public.teacher_owns_session(session_id::text));

create policy participants_teacher_delete
on public.participants
for delete
to authenticated
using (public.teacher_owns_session(session_id::text));

create policy participants_player_select_own
on public.participants
for select
to anon, authenticated
using (public.player_matches_participant(id::text, session_id::text));

create policy participants_player_insert_own
on public.participants
for insert
to anon, authenticated
with check (
  public.player_matches_participant(id::text, session_id::text)
  and public.active_session_exists(session_id::text)
  and char_length(btrim(student_name)) > 0
);

create policy participants_player_update_own
on public.participants
for update
to anon, authenticated
using (public.player_matches_participant(id::text, session_id::text))
with check (
  public.player_matches_participant(id::text, session_id::text)
  and public.active_session_exists(session_id::text)
  and char_length(btrim(student_name)) > 0
);

create policy answers_teacher_select
on public.answers
for select
to authenticated
using (public.teacher_owns_session(session_id::text));

create policy answers_teacher_update
on public.answers
for update
to authenticated
using (public.teacher_owns_session(session_id::text))
with check (public.teacher_owns_session(session_id::text));

create policy answers_teacher_delete
on public.answers
for delete
to authenticated
using (public.teacher_owns_session(session_id::text));

create policy answers_player_select_own
on public.answers
for select
to anon, authenticated
using (
  participant_id is not null
  and public.player_matches_participant(participant_id::text, session_id::text)
);

create policy answers_player_insert_own
on public.answers
for insert
to anon, authenticated
with check (
  participant_id is not null
  and public.player_matches_participant(participant_id::text, session_id::text)
  and exists (
    select 1
    from public.participants as p
    where p.id = answers.participant_id
      and p.session_id = answers.session_id
      and public.player_matches_participant(p.id::text, p.session_id::text)
      and public.active_session_exists(p.session_id::text)
  )
);

create policy answers_player_update_own
on public.answers
for update
to anon, authenticated
using (
  participant_id is not null
  and public.player_matches_participant(participant_id::text, session_id::text)
)
with check (
  participant_id is not null
  and public.player_matches_participant(participant_id::text, session_id::text)
  and exists (
    select 1
    from public.participants as p
    where p.id = answers.participant_id
      and p.session_id = answers.session_id
      and public.player_matches_participant(p.id::text, p.session_id::text)
      and public.active_session_exists(p.session_id::text)
  )
);

commit;
