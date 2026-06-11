-- ============================================================================
-- 004_contrats.sql — Holbert jalon 3 : moteur d'audit et de création (Raader)
-- ============================================================================

-- Texte intégral extrait du document : évite les ré-extractions à chaque
-- analyse et permet la vue annotée des audits.
alter table public.documents add column if not exists texte text;

create table public.audits (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.orgs (id) on delete cascade,
  document_id         uuid not null references public.documents (id) on delete cascade,
  role                text not null,
  objectif            text not null check (objectif in ('signer', 'renegocier', 'sortir', 'comprendre')),
  referentiel_id      text not null,
  referentiel_version int not null,
  statut              text not null default 'running' check (statut in ('running', 'done', 'error')),
  erreur              text,
  score               int check (score between 0 and 100),
  synthese            text,
  created_by          uuid not null references auth.users (id),
  created_at          timestamptz not null default now()
);

create index audits_org_idx on public.audits (org_id, created_at desc);
create index audits_doc_idx on public.audits (document_id);

create table public.audit_findings (
  id            uuid primary key default gen_random_uuid(),
  audit_id      uuid not null references public.audits (id) on delete cascade,
  org_id        uuid not null references public.orgs (id) on delete cascade,
  categorie     text not null check (categorie in ('manquante', 'illegale', 'defavorable', 'incoherence')),
  titre         text not null,
  passage       text,
  gravite       text not null check (gravite in ('mineure', 'moyenne', 'majeure')),
  fondement     text,
  explication   text not null,
  reformulation text,
  ordre         int not null default 0
);

create index audit_findings_audit_idx on public.audit_findings (audit_id, ordre);

create table public.generated_documents (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs (id) on delete cascade,
  type       text not null,
  role       text,
  variante   text not null default 'equilibree'
             check (variante in ('protectrice_a', 'equilibree', 'protectrice_b')),
  titre      text not null,
  reponses   jsonb not null default '{}'::jsonb,
  contenu    text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index generated_documents_org_idx on public.generated_documents (org_id, created_at desc);

-- ============================================================================
-- RLS — membres de l'org uniquement (pas d'accès super admin au contenu)
-- ============================================================================
alter table public.audits              enable row level security;
alter table public.audit_findings      enable row level security;
alter table public.generated_documents enable row level security;

create policy audits_select on public.audits
  for select using (public.is_org_member(org_id));

create policy audit_findings_select on public.audit_findings
  for select using (public.is_org_member(org_id));

create policy generated_documents_select on public.generated_documents
  for select using (public.is_org_member(org_id));
create policy generated_documents_delete on public.generated_documents
  for delete using (
    public.is_org_member(org_id)
    and (created_by = auth.uid() or public.org_role(org_id) in ('owner', 'admin'))
  );

-- Les insertions/mises à jour passent par les fonctions serverless (service role).
