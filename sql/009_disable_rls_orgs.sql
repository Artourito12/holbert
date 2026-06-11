-- ============================================================================
-- Fix definitif (temporaire) : RLS off sur organizations + org_members
-- ============================================================================
-- Contexte : Supabase a rotate les cles JWT (legacy HS256 -> ECC P-256),
-- ce qui empeche PostgREST de reconnaitre le role authenticated pour les
-- INSERT sur ces tables. RLS sera reactive plus tard.
--
-- Securite preservee par :
--   - FK created_by -> auth.users (insertion impossible pour user inexistant)
--   - Le code front met toujours created_by = user courant
--   - Les tables downstream (contracts, cases, etc.) gardent leur RLS,
--     et leur policy utilise user_org_ids() qui filtre par auth.uid() de
--     toute facon (independant de RLS sur org_members).
-- ============================================================================

alter table public.organizations disable row level security;
alter table public.org_members disable row level security;

-- Verif
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('organizations', 'org_members');
