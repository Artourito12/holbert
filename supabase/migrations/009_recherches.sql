-- ============================================================================
-- 009_recherches.sql — Hofraad : recherche approfondie asynchrone (docs/09 §4)
-- Script IDEMPOTENT.
-- ============================================================================

drop table if exists public.recherches cascade;

create table public.recherches (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs (id) on delete cascade,
  conversation_id   uuid not null references public.conversations (id) on delete cascade,
  created_by        uuid not null references auth.users (id),
  question_initiale text not null,
  comprehension     text,
  -- [{ id, question, justification, statut: a_faire|fait, section, sources: [...] }]
  questions         jsonb not null default '[]'::jsonb,
  statut            text not null default 'attente_validation'
                    check (statut in ('attente_validation', 'en_cours', 'terminee', 'erreur')),
  etape_courante    text,
  progression       int not null default 0 check (progression between 0 and 100),
  document          text,
  demarche          jsonb not null default '[]'::jsonb,
  erreur            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index recherches_org_idx on public.recherches (org_id, created_at desc);
create index recherches_conv_idx on public.recherches (conversation_id);

create trigger recherches_touch before update on public.recherches
  for each row execute function public.touch_updated_at();

alter table public.recherches enable row level security;

create policy recherches_select on public.recherches
  for select using (public.is_org_member(org_id));
-- Écritures via les fonctions serverless (service role) uniquement.
