begin;

create table if not exists public.stjerneloeb (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  subject     text not null default '',
  grade_level text not null default '',
  posts       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint stjerneloeb_posts_array_check
    check (jsonb_typeof(posts) = 'array')
);

comment on table public.stjerneloeb is
  'Gemmer AI-genererede analoge stjerneløb til print (A4-ark pr. post).';
comment on column public.stjerneloeb.posts is
  'JSON-array af poster. Hver post: { number, title, body_text, image_url, question, options: [4 strings], correct_index }';

create index if not exists stjerneloeb_user_id_idx
  on public.stjerneloeb (user_id);

-- updated_at trigger
create or replace function public.set_stjerneloeb_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stjerneloeb_set_updated_at on public.stjerneloeb;
create trigger stjerneloeb_set_updated_at
  before update on public.stjerneloeb
  for each row execute function public.set_stjerneloeb_updated_at();

-- RLS
alter table public.stjerneloeb enable row level security;

drop policy if exists "stjerneloeb_owner_select" on public.stjerneloeb;
create policy "stjerneloeb_owner_select"
  on public.stjerneloeb for select
  using (user_id = auth.uid());

drop policy if exists "stjerneloeb_owner_insert" on public.stjerneloeb;
create policy "stjerneloeb_owner_insert"
  on public.stjerneloeb for insert
  with check (user_id = auth.uid());

drop policy if exists "stjerneloeb_owner_update" on public.stjerneloeb;
create policy "stjerneloeb_owner_update"
  on public.stjerneloeb for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "stjerneloeb_owner_delete" on public.stjerneloeb;
create policy "stjerneloeb_owner_delete"
  on public.stjerneloeb for delete
  using (user_id = auth.uid());

commit;
