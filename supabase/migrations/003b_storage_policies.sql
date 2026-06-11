-- ============================================================================
-- 003b_storage_policies.sql — accès au bucket "documents" par organisation
-- Chemin des fichiers : {org_id}/{document_id}/{fichier}
--
-- ⚠️ Si ce script échoue avec « must be owner of table objects », créez les
-- trois policies via le dashboard : Storage > Policies > bucket "documents",
-- avec les expressions indiquées ci-dessous (mêmes conditions).
-- ============================================================================

drop policy if exists documents_storage_select on storage.objects;
drop policy if exists documents_storage_insert on storage.objects;
drop policy if exists documents_storage_delete on storage.objects;

create policy documents_storage_select on storage.objects
  for select using (
    bucket_id = 'documents'
    and public.is_org_member((split_part(name, '/', 1))::uuid)
  );

create policy documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.is_org_member((split_part(name, '/', 1))::uuid)
  );

create policy documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'documents'
    and public.is_org_member((split_part(name, '/', 1))::uuid)
  );

select 'Storage policies OK' as resultat;
