-- ============================================================================
-- 006_normer.sql — Holbert jalon 6 : Normer MVP (Front Door + réponses types)
-- Script IDEMPOTENT : ré-exécutable sans erreur.
-- ============================================================================

drop table if exists public.reponses_types cascade;
drop table if exists public.demandes cascade;

create table public.demandes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs (id) on delete cascade,
  created_by     uuid not null references auth.users (id),
  objet          text not null check (length(trim(objet)) >= 3),
  description    text,
  categorie      text,
  priorite       text not null default 'normale'
                 check (priorite in ('basse', 'normale', 'haute', 'critique')),
  statut         text not null default 'nouvelle'
                 check (statut in ('nouvelle', 'a_valider', 'repondue', 'cloturee')),
  reponse_ia     text,
  reponse_finale text,
  validee_par    uuid references auth.users (id),
  validee_at     timestamptz,
  created_at     timestamptz not null default now()
);

create index demandes_org_idx on public.demandes (org_id, created_at desc);
create index demandes_statut_idx on public.demandes (org_id, statut);

create table public.reponses_types (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs (id) on delete cascade,
  question    text not null,
  reponse     text not null,
  categorie   text,
  valide_par  uuid references auth.users (id),
  usage_count int not null default 0,
  created_at  timestamptz not null default now()
);

create index reponses_types_org_idx on public.reponses_types (org_id, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.demandes       enable row level security;
alter table public.reponses_types enable row level security;

create policy demandes_select on public.demandes
  for select using (public.is_org_member(org_id));
create policy demandes_insert on public.demandes
  for insert with check (public.is_org_member(org_id) and created_by = auth.uid());
-- Mise à jour directe réservée aux juristes (owner/admin) — clôture, requalification.
create policy demandes_update on public.demandes
  for update using (public.org_role(org_id) in ('owner', 'admin'));

create policy reponses_types_select on public.reponses_types
  for select using (public.is_org_member(org_id));
create policy reponses_types_delete on public.reponses_types
  for delete using (public.org_role(org_id) in ('owner', 'admin'));
-- Insertion via l'API de validation (service role).
