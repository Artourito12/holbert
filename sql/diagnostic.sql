-- ============================================================================
-- Diagnostic RLS organizations
-- ============================================================================
-- A executer dans Supabase SQL editor (vous etes admin -> auth.uid() = NULL)
-- Ces requetes ne corrigent rien, elles affichent l'etat.

-- 1. Quelles sont TOUTES les policies sur organizations ?
select policyname, cmd, roles, qual, with_check
from pg_policies
where tablename = 'organizations';

-- 2. RLS est-elle bien activee ?
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('organizations', 'org_members');

-- 3. Y a-t-il des constraints qui pourraient bloquer ?
select conname, contype, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.organizations'::regclass;
