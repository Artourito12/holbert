-- ============================================================================
-- TEST : desactiver RLS sur organizations temporairement
-- ============================================================================
-- Objectif : confirmer que c'est bien RLS qui rejette (et pas un trigger,
-- contrainte, ou autre).
--
-- Etapes :
--   1. Run cette commande
--   2. Reessayer la creation d'org sur le site
--   3. Si ca marche -> RLS est le coupable. On re-active et on creuse cote JWT.
--   4. Si ca echoue encore -> ce n'est pas RLS. Triggers, FK, etc.
--
-- IMPORTANT : on re-active a la fin pour ne pas exposer la table.
-- ============================================================================

-- Desactivation
alter table public.organizations disable row level security;

-- (Aller tester sur le site, puis revenir et executer le bloc suivant)

-- Si vous lisez ca apres avoir teste :
-- alter table public.organizations enable row level security;
