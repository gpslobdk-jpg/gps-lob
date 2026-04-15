begin;

drop index if exists public.answers_participant_question_index_uidx;

with ranked_answers as (
  select
    id,
    row_number() over (
      partition by session_id, student_name, question_index
      order by answered_at asc nulls last, created_at asc nulls last, id asc
    ) as row_num
  from public.answers
    where session_id is not null
      and student_name is not null
      and question_index is not null
)
delete from public.answers
using ranked_answers
where public.answers.id = ranked_answers.id
  and ranked_answers.row_num > 1;

create unique index answers_participant_question_index_uidx
  on public.answers (session_id, student_name, question_index);

commit;
