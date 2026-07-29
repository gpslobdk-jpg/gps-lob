begin;

-- Remove the four global authenticated policies that applied to every bucket.
drop policy if exists "VIP Adgang for lærere nglj8q_0" on storage.objects;
drop policy if exists "VIP Adgang for lærere nglj8q_1" on storage.objects;
drop policy if exists "VIP Adgang for lærere nglj8q_2" on storage.objects;
drop policy if exists "VIP Adgang for lærere nglj8q_3" on storage.objects;

-- Stjerneloeb writes are server-side and require a verified admin claim.
drop policy if exists "stjerneloeb library authenticated uploads" on storage.objects;
drop policy if exists "stjerneloeb library authenticated deletes" on storage.objects;

-- Temporary legacy compatibility only: no owner or UID path format is documented.
-- Authenticated users therefore retain cross-user access inside each named bucket,
-- while these policies deliberately grant no access to any other bucket.
create policy temporary_legacy_compat_afleveringer_select
on storage.objects
for select
to authenticated
using (bucket_id = 'afleveringer');

create policy temporary_legacy_compat_afleveringer_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'afleveringer');

create policy temporary_legacy_compat_afleveringer_update
on storage.objects
for update
to authenticated
using (bucket_id = 'afleveringer')
with check (bucket_id = 'afleveringer');

create policy temporary_legacy_compat_afleveringer_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'afleveringer');

create policy temporary_legacy_compat_arbejdsark_select
on storage.objects
for select
to authenticated
using (bucket_id = 'arbejdsark');

create policy temporary_legacy_compat_arbejdsark_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'arbejdsark');

create policy temporary_legacy_compat_arbejdsark_update
on storage.objects
for update
to authenticated
using (bucket_id = 'arbejdsark')
with check (bucket_id = 'arbejdsark');

create policy temporary_legacy_compat_arbejdsark_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'arbejdsark');

-- Library metadata is shared read-only with authenticated teachers.
alter table public.stjerneloeb_library enable row level security;

drop policy if exists stjerneloeb_library_authenticated_select
on public.stjerneloeb_library;

create policy stjerneloeb_library_authenticated_select
on public.stjerneloeb_library
for select
to authenticated
using (auth.uid() is not null);

revoke all privileges on table public.stjerneloeb_library
from public, anon, authenticated;

grant select on table public.stjerneloeb_library to authenticated;
grant all privileges on table public.stjerneloeb_library to service_role;

commit;
