begin;

create extension if not exists pgcrypto;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  student_name text not null,
  lat double precision,
  lng double precision,
  finished_at timestamptz,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_name)
);

create index if not exists participants_session_id_idx
  on public.participants (session_id);

create index if not exists participants_last_updated_idx
  on public.participants (last_updated desc);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  student_name text not null,
  post_index integer,
  question_index integer,
  selected_index integer,
  answer_index integer,
  is_correct boolean,
  question_text text,
  lat double precision,
  lng double precision,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists answers_session_id_idx
  on public.answers (session_id);

create index if not exists answers_created_at_idx
  on public.answers (created_at desc);

create or replace function public.set_participants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists participants_set_updated_at on public.participants;
create trigger participants_set_updated_at
before update on public.participants
for each row
execute function public.set_participants_updated_at();

alter table public.participants enable row level security;
alter table public.answers enable row level security;

grant select, insert, update on public.participants to anon, authenticated;
grant select, insert on public.answers to anon, authenticated;

drop policy if exists participants_select_all on public.participants;
create policy participants_select_all
on public.participants
for select
to anon, authenticated
using (true);

drop policy if exists participants_insert_open on public.participants;
create policy participants_insert_open
on public.participants
for insert
to anon, authenticated
with check (
  session_id is not null
  and student_name is not null
  and char_length(btrim(student_name)) > 0
);

drop policy if exists participants_update_open on public.participants;
create policy participants_update_open
on public.participants
for update
to anon, authenticated
using (
  session_id is not null
  and student_name is not null
)
with check (
  session_id is not null
  and student_name is not null
  and char_length(btrim(student_name)) > 0
);

drop policy if exists answers_select_all on public.answers;
create policy answers_select_all
on public.answers
for select
to anon, authenticated
using (true);

drop policy if exists answers_insert_open on public.answers;
create policy answers_insert_open
on public.answers
for insert
to anon, authenticated
with check (
  session_id is not null
  and student_name is not null
  and char_length(btrim(student_name)) > 0
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'participants'
    ) then
      alter publication supabase_realtime add table public.participants;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'answers'
    ) then
      alter publication supabase_realtime add table public.answers;
    end if;
  end if;
end
$$;

commit;

