-- ============================================================================
-- TEST : impersonate le role authenticated en SQL direct
-- ============================================================================
-- Si l'INSERT passe ici, la policy est OK. C'est donc la chaine JWT->role
-- cote PostgREST qui est cassee.
-- ============================================================================

begin;

-- Simule un user authentifie
set local request.jwt.claims = '{"sub":"a7e1bbce-d8a1-4cc0-b8b6-79429cc04f56","role":"authenticated","aud":"authenticated"}';
set local role = authenticated;

-- Confirmer le contexte
select
  current_user as pg_user,
  current_setting('role') as session_role,
  auth.uid() as auth_uid,
  auth.role() as auth_role;

-- Tester l'INSERT
insert into public.organizations(name, created_by)
values ('Test impersonation', 'a7e1bbce-d8a1-4cc0-b8b6-79429cc04f56');

-- Confirmer
select id, name, created_by from public.organizations where name = 'Test impersonation';

rollback; -- annule, on ne garde rien
