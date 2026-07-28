begin;

alter table public.answers
  add column if not exists client_operation_id uuid;

do $$
begin
  if exists (
    select 1
    from public.answers
    where participant_id is not null
      and question_index is not null
    group by session_id, participant_id, question_index
    having count(*) > 1
  ) then
    raise exception
      'Cannot add participant answer uniqueness: duplicate participant/question rows exist.';
  end if;
end
$$;

create unique index if not exists answers_session_participant_question_uidx
  on public.answers (session_id, participant_id, question_index)
  where participant_id is not null
    and question_index is not null;

create unique index if not exists answers_participant_operation_uidx
  on public.answers (participant_id, client_operation_id)
  where participant_id is not null
    and client_operation_id is not null;

create unique index if not exists answers_legacy_student_question_uidx
  on public.answers (session_id, student_name, question_index)
  where participant_id is null
    and question_index is not null;

drop index if exists public.answers_participant_question_index_uidx;

comment on column public.answers.client_operation_id is
  'Opaque client operation UUID used only for idempotent answer deduplication; never an authorization credential.';

commit;
