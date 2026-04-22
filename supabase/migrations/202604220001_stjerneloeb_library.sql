begin;

-- Table for uploaded stjerneloeb PDF library
create table if not exists public.stjerneloeb_library (
  id          uuid primary key default gen_random_uuid(),
  file_path   text not null,
  original_name text not null,
  ai_title    text not null default '',
  category    text not null default '',
  created_at  timestamptz not null default now()
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  type
)
values (
  'stjerneloeb_pdfs',
  'stjerneloeb_pdfs',
  true,
  null,
  'application/pdf',
  'STANDARD'
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  type = excluded.type;

commit;
