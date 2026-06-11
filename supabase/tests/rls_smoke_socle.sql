-- ============================================================================
-- rls_smoke_socle.sql — isolation des tables du jalon 2 (documents, chat…)
-- À exécuter APRÈS 003. Transaction annulée à la fin : rien ne persiste.
-- Succès = « RLS SOCLE OK — isolation vérifiée ».
-- ============================================================================
begin;

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

-- Données socle pour Alice (insérées en tant que postgres, hors RLS)
insert into public.documents (id, org_id, nom_fichier, mime, storage_path, uploaded_by, statut)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'bail.pdf', 'application/pdf', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/x/bail.pdf',
        '11111111-1111-1111-1111-111111111111', 'ready');

insert into public.document_chunks (document_id, org_id, contenu, position)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'contenu secret du bail', 0);

insert into public.deadlines (org_id, document_id, titre, date_echeance)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Échéance triennale', '2027-01-01');

insert into public.conversations (id, org_id, created_by)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');

insert into public.messages (conversation_id, org_id, role, contenu)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user', 'question confidentielle');

-- Alice est aussi platform admin : elle ne doit PAS pour autant voir
-- le contenu documentaire de Bob (et réciproquement, cf. doc 02 §D5).
insert into public.platform_admins (user_id) values ('11111111-1111-1111-1111-111111111111');

-- ---- Impersonation : Bob (membre d'une AUTRE org) ---------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
declare n int;
begin
  select count(*) into n from public.documents;
  if n <> 0 then raise exception 'RLS FAIL: bob voit % document(s) d''alice', n; end if;

  select count(*) into n from public.document_chunks;
  if n <> 0 then raise exception 'RLS FAIL: bob voit les chunks d''alice'; end if;

  select count(*) into n from public.extracted_facts;
  if n <> 0 then raise exception 'RLS FAIL: bob voit les faits extraits d''alice'; end if;

  select count(*) into n from public.deadlines;
  if n <> 0 then raise exception 'RLS FAIL: bob voit l''échéancier d''alice'; end if;

  select count(*) into n from public.conversations;
  if n <> 0 then raise exception 'RLS FAIL: bob voit les conversations d''alice'; end if;

  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'RLS FAIL: bob voit les messages d''alice'; end if;

  -- bob ne peut pas créer un document dans l'org d'alice
  begin
    insert into public.documents (org_id, nom_fichier, mime, storage_path, uploaded_by)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'intrusion.pdf', 'application/pdf', 'x', '22222222-2222-2222-2222-222222222222');
    raise exception 'RLS FAIL: bob a créé un document chez alice';
  exception
    when insufficient_privilege then null; -- attendu
  end;

  -- la recherche sémantique refuse l'org d'autrui (garde is_org_member)
  select count(*) into n from public.match_chunks('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select array_fill(0.0, array[1536]))::vector, 5);
  if n <> 0 then raise exception 'RLS FAIL: match_chunks expose l''org d''alice à bob'; end if;
end $$;

-- ---- Impersonation : Alice platform admin — pas d'accès au contenu de Bob ---
reset role;
insert into public.documents (org_id, nom_fichier, mime, storage_path, uploaded_by, statut)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'secret-bob.pdf', 'application/pdf',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/y/secret-bob.pdf',
        '22222222-2222-2222-2222-222222222222', 'ready');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare n int;
begin
  if not public.is_platform_admin() then raise exception 'SETUP FAIL: alice devrait être platform admin'; end if;

  select count(*) into n from public.documents where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if n <> 0 then raise exception 'RLS FAIL: le super admin voit les documents d''une org dont il n''est pas membre'; end if;
end $$;

reset role;
select 'RLS SOCLE OK — isolation vérifiée' as resultat;

rollback;
