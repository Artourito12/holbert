-- ============================================================================
-- 007_mode_preuve.sql — vérification Légifrance des articles cités par l'IA
-- (sources_loi : [{ citation, code, trouve, etat, url }])
-- ============================================================================

alter table public.messages add column if not exists sources_loi jsonb;
