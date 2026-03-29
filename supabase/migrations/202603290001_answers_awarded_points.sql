alter table if exists public.answers
  add column if not exists awarded_points integer;

update public.answers
set awarded_points = case when is_correct is true then 10 else 0 end
where awarded_points is null;

alter table if exists public.answers
  alter column awarded_points set default 0;

alter table if exists public.answers
  alter column awarded_points set not null;