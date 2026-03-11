begin;

alter table public.participants
  drop constraint if exists participants_session_id_student_name_key;

create index if not exists participants_session_id_student_name_idx
  on public.participants (session_id, student_name);

alter table public.answers
  add column if not exists participant_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'answers_participant_id_fkey'
  ) then
    alter table public.answers
      add constraint answers_participant_id_fkey
      foreign key (participant_id)
      references public.participants (id)
      on delete cascade;
  end if;
end
$$;

create index if not exists answers_participant_id_idx
  on public.answers (participant_id);

update public.answers as a
set participant_id = p.id
from public.participants as p
where a.participant_id is null
  and a.session_id = p.session_id
  and a.student_name = p.student_name;

commit;
