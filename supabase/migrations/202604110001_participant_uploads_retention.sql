begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  type
)
values (
  'participant-uploads',
  'participant-uploads',
  true,
  null,
  null,
  'STANDARD'
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  type = excluded.type;

delete from vault.secrets
where name = 'participant_uploads_cleanup_secret';

select vault.create_secret(
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  'participant_uploads_cleanup_secret',
  'Shared secret for participant upload retention cron'
);

create or replace function public.get_participant_uploads_cleanup_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_value text;
begin
  select decrypted_secret
    into secret_value
  from vault.decrypted_secrets
  where name = 'participant_uploads_cleanup_secret'
  limit 1;

  if secret_value is null then
    raise exception 'participant_uploads_cleanup_secret is not configured';
  end if;

  return secret_value;
end;
$$;

revoke all on function public.get_participant_uploads_cleanup_secret() from public, anon, authenticated;
grant execute on function public.get_participant_uploads_cleanup_secret() to postgres, service_role;

create or replace function public.list_participant_upload_cleanup_candidates(
  p_cutoff timestamptz,
  p_limit integer default 200
)
returns table (
  answer_id text,
  image_url text
)
language sql
security definer
set search_path = public
as $$
  select
    a.id::text as answer_id,
    a.image_url
  from public.answers as a
  where a.image_url is not null
    and coalesce(a.answered_at, a.created_at, now()) < p_cutoff
  order by coalesce(a.answered_at, a.created_at, now()) asc, a.id asc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

revoke all on function public.list_participant_upload_cleanup_candidates(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.list_participant_upload_cleanup_candidates(timestamptz, integer) to postgres, service_role;

create or replace function public.clear_participant_upload_image_urls(p_answer_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cleared_count integer := 0;
begin
  if coalesce(array_length(p_answer_ids, 1), 0) = 0 then
    return 0;
  end if;

  update public.answers as a
  set image_url = null
  where a.image_url is not null
    and a.id::text = any(p_answer_ids);

  get diagnostics cleared_count = row_count;
  return cleared_count;
end;
$$;

revoke all on function public.clear_participant_upload_image_urls(text[]) from public, anon, authenticated;
grant execute on function public.clear_participant_upload_image_urls(text[]) to postgres, service_role;

-- Deliberately do not schedule a hosted URL from a migration. The replacement
-- retention job is configured explicitly after Edge deployment and smoke test.

commit;
