-- ============================================================================
-- Holbert — Storage buckets + policies
-- ============================================================================
-- Bucket 'contracts' : stocke les fichiers PDF/DOCX uploadés
-- Path convention : {org_id}/{contract_id}/{filename}
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts',
  'contracts',
  false,                          -- non-public, accès via signed URLs
  52428800,                       -- 50 Mo max
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policy : un user peut lire un fichier si l'org_id (premier segment du path)
-- fait partie de ses orgs
create policy "members can read contract files of their orgs"
  on storage.objects for select
  using (
    bucket_id = 'contracts'
    and (split_part(name, '/', 1))::uuid in (select public.user_org_ids())
  );

create policy "members can upload contract files in their orgs"
  on storage.objects for insert
  with check (
    bucket_id = 'contracts'
    and (split_part(name, '/', 1))::uuid in (select public.user_org_ids())
  );

create policy "members can update contract files in their orgs"
  on storage.objects for update
  using (
    bucket_id = 'contracts'
    and (split_part(name, '/', 1))::uuid in (select public.user_org_ids())
  );

create policy "members can delete contract files in their orgs"
  on storage.objects for delete
  using (
    bucket_id = 'contracts'
    and (split_part(name, '/', 1))::uuid in (select public.user_org_ids())
  );
