-- ============================================================================
-- 000_reset_legacy.sql — supprime l'ANCIEN schéma Holbert (pré-jalon 1)
-- ⚠️ DESTRUCTIF : efface les tables et fichiers de l'ancienne version
--    (organizations, org_members, contracts, cases, bucket "contracts").
--    À exécuter UNE SEULE FOIS, AVANT 001_foundation.sql.
-- ============================================================================

-- Trigger legacy sur auth.users
drop trigger if exists on_auth_user_created on auth.users;

-- Tables legacy (cascade : policies, FK, index)
drop table if exists public.case_message_steps cascade;
drop table if exists public.case_messages cascade;
drop table if exists public.case_documents cascade;
drop table if exists public.cases cascade;
drop table if exists public.analysis_steps cascade;
drop table if exists public.contract_analyses cascade;
drop table if exists public.contracts cascade;
drop table if exists public.org_members cascade;
drop table if exists public.organizations cascade;
drop table if exists public.user_profiles cascade;

-- Fonctions legacy (cascade : supprime aussi les policies storage qui en dépendent)
drop function if exists public.handle_new_user() cascade;
drop function if exists public.user_org_ids() cascade;
drop function if exists public.user_org_role(uuid) cascade;
drop function if exists public.touch_updated_at() cascade;

-- Bucket storage legacy : Supabase interdit le delete SQL direct sur storage.
-- → À supprimer via le dashboard : Storage > bucket "contracts" > ⋯ > Delete bucket
--   (sans urgence : le bucket orphelin ne gêne pas les migrations).

-- Vérification : doit retourner 0 ligne
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('organizations', 'org_members', 'contracts', 'cases', 'user_profiles');
