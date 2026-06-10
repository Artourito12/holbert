-- ============================================================================
-- Holbert — Module 4 : Legal Case Chat
-- ============================================================================
-- Tables :
--   cases             : un dossier juridique (titre, domaine, statut)
--   case_documents    : pièces jointes au dossier (PDF/DOCX/email)
--   case_messages     : fil de conversation user/IA
--   case_message_steps: pipeline IA multi-agents persistant (audit + breadcrumb)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. cases
-- ----------------------------------------------------------------------------
create type public.case_status as enum (
  'open',        -- en cours
  'pending',     -- en attente d'info
  'resolved',    -- traité
  'escalated',   -- transmis avocat externe
  'archived'
);

create type public.legal_domain as enum (
  'contrat',
  'travail',
  'social',
  'commercial',
  'societe',
  'fiscal',
  'immobilier',
  'propriete_intellectuelle',
  'donnees_personnelles',
  'concurrence',
  'penal_affaires',
  'autre'
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  title text not null,
  domain public.legal_domain default 'autre',
  initial_question text,                    -- la situation décrite au départ
  status public.case_status not null default 'open',

  -- Synthèse mémo (rempli quand l'user clique "Générer mémo")
  memo_summary text,
  memo_generated_at timestamptz,

  tags text[] default '{}',

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cases enable row level security;

create index if not exists idx_cases_org on public.cases(org_id);
create index if not exists idx_cases_status on public.cases(org_id, status);

create policy "members can read their org cases"
  on public.cases for select
  using (org_id in (select public.user_org_ids()));

create policy "members can create cases in their orgs"
  on public.cases for insert
  with check (
    org_id in (select public.user_org_ids())
    and created_by = auth.uid()
  );

create policy "members can update their org cases"
  on public.cases for update
  using (org_id in (select public.user_org_ids()));

create policy "members can delete their org cases"
  on public.cases for delete
  using (org_id in (select public.user_org_ids()));

-- ----------------------------------------------------------------------------
-- 2. case_documents : fichiers attachés au dossier
-- ----------------------------------------------------------------------------
create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,

  filename text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,

  -- Texte extrait (pour DOCX/email après mammoth)
  extracted_text text,

  -- Type de pièce
  doc_kind text,                            -- 'contrat', 'courriel', 'pv', 'jugement', 'bilan', 'autre'

  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now()
);

alter table public.case_documents enable row level security;

create index if not exists idx_case_docs_case on public.case_documents(case_id);

create policy "members can read their org case docs"
  on public.case_documents for select
  using (org_id in (select public.user_org_ids()));

create policy "members can upload case docs"
  on public.case_documents for insert
  with check (org_id in (select public.user_org_ids()));

create policy "members can delete case docs"
  on public.case_documents for delete
  using (org_id in (select public.user_org_ids()));

-- ----------------------------------------------------------------------------
-- 3. case_messages : fil de conversation
-- ----------------------------------------------------------------------------
create type public.case_message_role as enum ('user', 'assistant', 'system');

create type public.analysis_mode as enum (
  'standard',         -- mode par défaut
  'contradictoire',   -- arguments pour/contre
  'risque_contentieux', -- probabilité + enjeu financier
  'negociation',      -- leviers, points de blocage
  'memo'              -- rédige un mémo
);

create table if not exists public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,

  role public.case_message_role not null,
  content text not null,                    -- le texte de la bulle
  content_json jsonb,                       -- réponse structurée (sections, sources)

  -- Pour les messages assistant : mode utilisé + niveau de confiance
  mode public.analysis_mode default 'standard',
  confidence_level text,                    -- 'green' | 'orange' | 'red'

  -- Si on cite des sources juridiques
  citations jsonb default '[]',

  -- Ordre dans le fil
  position int not null,

  -- Métadonnées Claude
  model text,
  tokens_in int,
  tokens_out int,
  duration_ms int,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.case_messages enable row level security;

create index if not exists idx_case_messages_case on public.case_messages(case_id, position);

create policy "members can read their org case messages"
  on public.case_messages for select
  using (org_id in (select public.user_org_ids()));

create policy "members can post case messages"
  on public.case_messages for insert
  with check (org_id in (select public.user_org_ids()));

-- ----------------------------------------------------------------------------
-- 4. case_message_steps : pipeline multi-agents (comme analysis_steps pour M1)
-- ----------------------------------------------------------------------------
-- Chaque message assistant peut être le fruit d'un pipeline multi-étapes.
-- On stocke chaque étape ici pour audit + breadcrumb du raisonnement.

create type public.case_step_kind as enum (
  'contextualization',
  'clarification',     -- l'IA pose des questions de clarification
  'decomposition',     -- découpage en sous-questions
  'sub_analysis',      -- une sous-question analysée
  'sub_synthesis',
  'global_synthesis',
  'memo_generation'
);

create table if not exists public.case_message_steps (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.case_messages(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,

  kind public.case_step_kind not null,
  step_index int not null,
  parent_step_id uuid references public.case_message_steps(id) on delete cascade,

  prompt text,
  model text,
  output_text text,
  output_json jsonb,

  citations jsonb default '[]',
  confidence_level text,

  tokens_in int,
  tokens_out int,
  duration_ms int,
  status text default 'done',
  error_message text,

  created_at timestamptz not null default now()
);

alter table public.case_message_steps enable row level security;

create index if not exists idx_case_steps_message on public.case_message_steps(message_id, step_index);

create policy "members can read case steps"
  on public.case_message_steps for select
  using (org_id in (select public.user_org_ids()));

create policy "members can insert case steps"
  on public.case_message_steps for insert
  with check (org_id in (select public.user_org_ids()));

-- ----------------------------------------------------------------------------
-- 5. Updated_at trigger
-- ----------------------------------------------------------------------------
create trigger trg_cases_touch before update on public.cases
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Storage bucket : case-documents
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-documents',
  'case-documents',
  false,
  52428800,                       -- 50 Mo
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'message/rfc822'              -- pour les emails .eml
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members can read case files of their orgs"
  on storage.objects for select
  using (
    bucket_id = 'case-documents'
    and (split_part(name, '/', 1))::uuid in (select public.user_org_ids())
  );

create policy "members can upload case files in their orgs"
  on storage.objects for insert
  with check (
    bucket_id = 'case-documents'
    and (split_part(name, '/', 1))::uuid in (select public.user_org_ids())
  );

create policy "members can delete case files in their orgs"
  on storage.objects for delete
  using (
    bucket_id = 'case-documents'
    and (split_part(name, '/', 1))::uuid in (select public.user_org_ids())
  );
