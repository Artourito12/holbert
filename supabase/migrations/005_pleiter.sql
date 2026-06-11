-- ============================================================================
-- 005_pleiter.sql — Holbert jalon 5 : Pleiter MVP (contentieux)
-- Dossiers, pièces (bordereau), chronologie, analyses.
-- Script IDEMPOTENT : ré-exécutable sans erreur.
-- ============================================================================

drop table if exists public.analyses_dossier cascade;
drop table if exists public.evenements cascade;
drop table if exists public.pieces cascade;
drop table if exists public.dossiers cascade;

create table public.dossiers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs (id) on delete cascade,
  nom             text not null check (length(trim(nom)) >= 2),
  parties         jsonb not null default '{}'::jsonb,
  juridiction     text,
  type_procedure  text,
  enjeu_financier numeric,
  statut          text not null default 'actif' check (statut in ('actif', 'clos')),
  created_by      uuid not null references auth.users (id),
  created_at      timestamptz not null default now()
);

create index dossiers_org_idx on public.dossiers (org_id, created_at desc);

create table public.pieces (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid not null references public.dossiers (id) on delete cascade,
  org_id      uuid not null references public.orgs (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  numero      int not null,
  intitule    text not null,
  communiquee boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (dossier_id, numero)
);

create index pieces_dossier_idx on public.pieces (dossier_id, numero);

create table public.evenements (
  id             uuid primary key default gen_random_uuid(),
  dossier_id     uuid not null references public.dossiers (id) on delete cascade,
  org_id         uuid not null references public.orgs (id) on delete cascade,
  date           date not null,
  titre          text not null,
  description    text,
  piece_id       uuid references public.pieces (id) on delete set null,
  source_passage text,
  origine        text not null default 'manuel' check (origine in ('ia', 'manuel')),
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now()
);

create index evenements_dossier_idx on public.evenements (dossier_id, date);

create table public.analyses_dossier (
  id         uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers (id) on delete cascade,
  org_id     uuid not null references public.orgs (id) on delete cascade,
  type       text not null check (type in ('vices', 'prescription', 'synthese', 'conclusions')),
  statut     text not null default 'done' check (statut in ('running', 'done', 'error')),
  resultat   jsonb,
  contenu    text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index analyses_dossier_idx on public.analyses_dossier (dossier_id, created_at desc);

-- ============================================================================
-- RLS — membres de l'org uniquement
-- ============================================================================
alter table public.dossiers         enable row level security;
alter table public.pieces           enable row level security;
alter table public.evenements       enable row level security;
alter table public.analyses_dossier enable row level security;

create policy dossiers_select on public.dossiers
  for select using (public.is_org_member(org_id));
create policy dossiers_insert on public.dossiers
  for insert with check (public.is_org_member(org_id) and created_by = auth.uid());
create policy dossiers_update on public.dossiers
  for update using (public.is_org_member(org_id));
create policy dossiers_delete on public.dossiers
  for delete using (
    public.is_org_member(org_id)
    and (created_by = auth.uid() or public.org_role(org_id) in ('owner', 'admin'))
  );

create policy pieces_select on public.pieces
  for select using (public.is_org_member(org_id));
create policy pieces_insert on public.pieces
  for insert with check (public.is_org_member(org_id));
create policy pieces_update on public.pieces
  for update using (public.is_org_member(org_id));
create policy pieces_delete on public.pieces
  for delete using (public.is_org_member(org_id));

create policy evenements_select on public.evenements
  for select using (public.is_org_member(org_id));
create policy evenements_insert on public.evenements
  for insert with check (public.is_org_member(org_id));
create policy evenements_update on public.evenements
  for update using (public.is_org_member(org_id));
create policy evenements_delete on public.evenements
  for delete using (public.is_org_member(org_id));

create policy analyses_dossier_select on public.analyses_dossier
  for select using (public.is_org_member(org_id));
-- Écritures d'analyses via les fonctions serverless (service role).
