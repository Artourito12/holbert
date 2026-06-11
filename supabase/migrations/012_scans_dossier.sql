/* 012 — Scan complet d'un dossier contentieux par l'IA (docs/10 phase 2) :
   comprehension du litige, lecture de toutes les pieces, strategie sequencee
   avec delais, vices de procedure dans les deux sens. Asynchrone (chaine de
   fonctions, progression, quitter/revenir). Idempotent. */

drop table if exists public.scans_dossier cascade;

create table public.scans_dossier (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs (id) on delete cascade,
  dossier_id     uuid not null references public.dossiers (id) on delete cascade,
  created_by     uuid not null references auth.users (id),
  contexte       text not null,
  etapes         jsonb not null default '[]'::jsonb,
  donnees        jsonb not null default '{}'::jsonb,
  statut         text not null default 'en_cours'
                 check (statut in ('en_cours', 'terminee', 'erreur')),
  etape_courante text,
  progression    int not null default 0 check (progression between 0 and 100),
  document       text,
  demarche       jsonb not null default '[]'::jsonb,
  erreur         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index scans_dossier_idx on public.scans_dossier (dossier_id, created_at desc);

create trigger scans_dossier_touch before update on public.scans_dossier
  for each row execute function public.touch_updated_at();

alter table public.scans_dossier enable row level security;

create policy scans_dossier_select on public.scans_dossier
  for select using (public.is_org_member(org_id));

/* Ecritures via les fonctions serverless (service role) uniquement. */
