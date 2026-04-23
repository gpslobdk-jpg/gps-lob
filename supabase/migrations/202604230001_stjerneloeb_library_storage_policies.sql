begin;

-- Allow authenticated browser uploads directly into the Stjerneløb bucket.
drop policy if exists "stjerneloeb library authenticated uploads" on storage.objects;
create policy "stjerneloeb library authenticated uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'stjerneloeb_pdfs'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Allow the uploader to clean up failed uploads from the browser.
drop policy if exists "stjerneloeb library authenticated deletes" on storage.objects;
create policy "stjerneloeb library authenticated deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'stjerneloeb_pdfs'
  and split_part(name, '/', 1) = auth.uid()::text
);

commit;
