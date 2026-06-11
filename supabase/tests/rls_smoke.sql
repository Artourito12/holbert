-- ============================================================================
-- rls_smoke.sql — test d'isolation multi-tenant (cloisonnement RGPD)
-- À exécuter dans l'éditeur SQL Supabase. Tout se passe dans une transaction
-- ANNULÉE à la fin (rollback) : aucune donnée de test ne persiste.
-- Si une vérification échoue, le script s'arrête avec un message "RLS FAIL".
-- Succès = le script se termine sur "RLS OK — isolation vérifiée".
-- ============================================================================
begin;

-- ---- Données de test : 2 utilisateurs, 2 orgs cloisonnées ------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'alice@rls-test.local', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'bob@rls-test.local', '', now(), now(), now());

insert into public.orgs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org Alice', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org Bob',   '22222222-2222-2222-2222-222222222222');

insert into public.org_members (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.entitlements (org_id, module, active) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'raader', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pleiter', true);

-- ---- Impersonation : Alice -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare n int;
begin
  -- Alice ne doit voir QUE son org
  select count(*) into n from public.orgs;
  if n <> 1 then raise exception 'RLS FAIL: alice voit % org(s), attendu 1', n; end if;

  select count(*) into n from public.orgs where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if n <> 0 then raise exception 'RLS FAIL: alice voit l''org de bob'; end if;

  -- ... que son membership
  select count(*) into n from public.org_members;
  if n <> 1 then raise exception 'RLS FAIL: alice voit % membership(s), attendu 1', n; end if;

  -- ... que ses entitlements
  select count(*) into n from public.entitlements;
  if n <> 1 then raise exception 'RLS FAIL: alice voit % entitlement(s), attendu 1', n; end if;

  -- ... que son profil + co-membres (pas bob)
  select count(*) into n from public.profiles where user_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'RLS FAIL: alice voit le profil de bob'; end if;

  -- Alice ne peut PAS s'octroyer un module
  begin
    insert into public.entitlements (org_id, module) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'normer');
    raise exception 'RLS FAIL: alice a pu créer un entitlement';
  exception
    when insufficient_privilege then null; -- attendu : violation RLS (42501)
  end;

  -- Alice ne peut PAS modifier l'org de bob (0 ligne touchée)
  update public.orgs set name = 'piratée' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if found then raise exception 'RLS FAIL: alice a modifié l''org de bob'; end if;

  -- Alice n'est pas platform admin
  if public.is_platform_admin() then raise exception 'RLS FAIL: alice est platform admin'; end if;
end $$;

-- ---- Impersonation : super admin (alice promue, le temps du test) ----------
reset role;
insert into public.platform_admins (user_id) values ('11111111-1111-1111-1111-111111111111');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare n int;
begin
  -- Le super admin voit toutes les orgs
  select count(*) into n from public.orgs where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  if n <> 2 then raise exception 'RLS FAIL: le super admin voit % org(s), attendu 2', n; end if;

  -- ... et peut activer un module pour n'importe quelle org
  insert into public.entitlements (org_id, module, active)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'normer', true);

  -- ... ce qui est tracé dans l'audit log
  select count(*) into n from public.audit_log
  where action = 'entitlement.insert' and org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if n < 1 then raise exception 'RLS FAIL: activation de module non tracée dans audit_log'; end if;
end $$;

reset role;
select 'RLS OK — isolation vérifiée' as resultat;

rollback;
