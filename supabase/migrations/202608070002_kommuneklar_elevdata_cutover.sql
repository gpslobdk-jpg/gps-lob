begin;

-- Atomic private-Storage cutover. Apply only after the additive preparation
-- migration and the compatible application release are both verified.
do $$
declare
  unknown_legacy_count integer;
begin
  if not exists (
    select 1 from storage.buckets where id = 'participant-uploads'
  ) then
    raise exception 'participant-uploads bucket is missing; run preparation first';
  end if;

  select count(*)
  into unknown_legacy_count
  from public.answers a
  where a.image_url is not null
    and a.image_url not like '/api/teacher/answers/%/photo'
    and a.image_url !~ '/storage/v1/object/(public|authenticated|sign)/participant-uploads/'
    and a.image_url like '%://%';

  if unknown_legacy_count > 0 then
    raise exception using
      message = 'Unknown legacy participant photo URLs require manual inventory before migration.',
      detail = format('Unknown URL count: %s', unknown_legacy_count),
      hint = 'Stop deployment and follow the legacy-photo inventory and rekey checklist.';
  end if;
end
$$;

insert into public.participant_photo_objects (
  answer_id,
  session_id,
  participant_id,
  object_path,
  created_at
)
select
  a.id,
  a.session_id,
  a.participant_id,
  case
    when a.image_url ~ '/storage/v1/object/(public|authenticated|sign)/participant-uploads/' then
      regexp_replace(
        split_part(a.image_url, '?', 1),
        '^.*/storage/v1/object/(public|authenticated|sign)/participant-uploads/',
        ''
      )
    when a.image_url not like '%://%'
      and a.image_url not like '/api/teacher/answers/%/photo' then
      regexp_replace(a.image_url, '^/?(participant-uploads/)?', '')
    else null
  end,
  coalesce(a.answered_at, a.created_at, now())
from public.answers as a
where a.image_url is not null
  and (
    a.image_url ~ '/storage/v1/object/(public|authenticated|sign)/participant-uploads/'
    or (
      a.image_url not like '%://%'
      and a.image_url not like '/api/teacher/answers/%/photo'
    )
  )
on conflict do nothing;

update public.answers as a
set image_url = '/api/teacher/answers/' || a.id::text || '/photo'
where exists (
  select 1
  from public.participant_photo_objects as ppo
  where ppo.answer_id = a.id
);

update storage.buckets
set
  public = false,
  file_size_limit = 12582912,
  allowed_mime_types = array['image/jpeg']
where id = 'participant-uploads';

do $$
declare
  storage_policy record;
begin
  for storage_policy in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%participant-uploads%'
        or coalesce(with_check, '') ilike '%participant-uploads%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', storage_policy.policyname);
  end loop;
end
$$;

create or replace function public.protect_student_answer_data()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.lat := null;
  new.lng := null;

  if new.image_url is not null then
    new.image_url := '/api/teacher/answers/' || new.id::text || '/photo';
  end if;

  return new;
end;
$$;

drop trigger if exists answers_protect_student_data on public.answers;
create trigger answers_protect_student_data
before insert or update on public.answers
for each row
execute function public.protect_student_answer_data();

update public.answers
set lat = null, lng = null
where lat is not null or lng is not null;

drop policy if exists answers_teacher_select on public.answers;
create policy answers_teacher_select
on public.answers
for select
to authenticated
using (
  exists (
    select 1
    from public.live_sessions as ls
    join public.gps_runs as gr on gr.id = ls.run_id
    where ls.id = answers.session_id
      and gr.user_id = auth.uid()
  )
);

drop policy if exists answers_teacher_update on public.answers;
create policy answers_teacher_update
on public.answers
for update
to authenticated
using (
  exists (
    select 1
    from public.live_sessions as ls
    join public.gps_runs as gr on gr.id = ls.run_id
    where ls.id = answers.session_id
      and gr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.live_sessions as ls
    join public.gps_runs as gr on gr.id = ls.run_id
    where ls.id = answers.session_id
      and gr.user_id = auth.uid()
  )
);

drop policy if exists answers_teacher_delete on public.answers;
drop policy if exists participants_teacher_delete on public.participants;

-- Browser-side cascading deletes could leave private Storage objects behind.
-- All participant/answer deletion therefore goes through the existing
-- server-side deletion flow, which removes Storage before database rows.
revoke delete on public.answers from anon, authenticated;
revoke delete on public.participants from anon, authenticated;

commit;
