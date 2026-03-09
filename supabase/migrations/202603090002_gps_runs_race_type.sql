begin;

alter table public.gps_runs
  add column if not exists race_type text;

update public.gps_runs
set race_type = case
  when lower(btrim(coalesce(race_type, ''))) in ('manuel', 'manual', 'quiz') then 'manuel'
  when lower(btrim(coalesce(race_type, ''))) in ('foto', 'photo') then 'foto'
  when lower(btrim(coalesce(race_type, ''))) = 'selfie' then 'selfie'
  when lower(btrim(coalesce(race_type, ''))) in ('escape', 'escape_room', 'escaperoom') then 'escape'
  when lower(btrim(coalesce(race_type, ''))) in ('rollespil', 'roleplay', 'role_play', 'tidsmaskinen') then 'rollespil'
  when btrim(coalesce(description, '')) like '{%'
    and coalesce(description::jsonb ? 'masterCode', false) then 'escape'
  when jsonb_typeof(coalesce(questions::jsonb, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(questions::jsonb, '[]'::jsonb)) > 0
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(public.gps_runs.questions::jsonb, '[]'::jsonb)) as question
      where coalesce(question->>'type', '') <> 'ai_image'
    )
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(public.gps_runs.questions::jsonb, '[]'::jsonb)) as question
      where lower(coalesce(question->>'isSelfie', question->>'is_selfie', 'false')) <> 'true'
    ) then 'selfie'
  when jsonb_typeof(coalesce(questions::jsonb, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(questions::jsonb, '[]'::jsonb)) > 0
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(public.gps_runs.questions::jsonb, '[]'::jsonb)) as question
      where coalesce(question->>'type', '') <> 'ai_image'
    ) then 'foto'
  when jsonb_typeof(coalesce(questions::jsonb, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(questions::jsonb, '[]'::jsonb)) > 0
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(public.gps_runs.questions::jsonb, '[]'::jsonb)) as question
      where coalesce(question->'answers'->>2, '') = ''
        or coalesce(question->'answers'->>3, '') <> ''
    ) then 'rollespil'
  else 'manuel'
end
where race_type is null
   or btrim(race_type) = ''
   or lower(btrim(race_type)) not in ('manuel', 'manual', 'quiz', 'foto', 'photo', 'selfie', 'escape', 'escape_room', 'escaperoom', 'rollespil', 'roleplay', 'role_play', 'tidsmaskinen');

alter table public.gps_runs
  alter column race_type set default 'manuel';

commit;
