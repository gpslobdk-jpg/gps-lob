begin;

-- Add post_type to an existing posts/questions table if present, otherwise create a lightweight session_posts
-- table so we have an explicit place for post metadata. Default to 'quiz' for backward compatibility.

do $$
begin
  if to_regclass('public.session_posts') is not null then
    alter table public.session_posts
      add column if not exists post_type text not null default 'quiz';
  elsif to_regclass('public.questions') is not null then
    alter table public.questions
      add column if not exists post_type text not null default 'quiz';
  else
    -- Create a small posts table to support future per-post metadata.
    create table if not exists public.session_posts (
      id uuid primary key default gen_random_uuid(),
      run_id text,
      post_index integer,
      content jsonb,
      post_type text not null default 'quiz',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists session_posts_run_id_idx on public.session_posts (run_id);
  end if;
end
$$;

commit;
