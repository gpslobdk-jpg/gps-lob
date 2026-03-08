begin;

alter table public.answers
  add column if not exists image_url text,
  add column if not exists analysis_message text;

commit;
