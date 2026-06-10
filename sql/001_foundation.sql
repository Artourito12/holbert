-- ============================================================================
-- Holbert — Foundation schema (V1)
-- ============================================================================
-- Multi-tenant : chaque user appartient à une ou plusieurs organisations.
-- Toutes les données métier sont rattachées à org_id et protégées par RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_profiles : extension de auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

create policy "users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

-- Auto-création du profile à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. organizations : tenant principal
-- ----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  legal_form text,                -- SAS, SARL, cabinet individuel, etc.
  siren text,
  sector text,                    -- secteur d'activité (RH, fintech, etc.)
  size_range text,                -- '1-10', '10-50', '50-250', '250+'
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ----------------------------------------------------------------------------
-- 3. org_members : liaison user ↔ organisation + rôle
-- ----------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (org_id, user_id)
);

alter table public.org_members enable row level security;

create index if not exists idx_org_members_user on public.org_members(user_id);
create index if not exists idx_org_members_org on public.org_members(org_id);

-- Helper : retourne les org_id auxquelles l'utilisateur courant appartient
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

-- Helper : check role de l'utilisateur courant dans une org
create or replace function public.user_org_role(target_org_id uuid)
returns public.org_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.org_members
  where org_id = target_org_id and user_id = auth.uid()
  limit 1;
$$;

-- Policies organizations
create policy "members can read their orgs"
  on public.organizations for select
  using (id in (select public.user_org_ids()));

create policy "any user can create an org"
  on public.organizations for insert
  with check (auth.uid() = created_by);

create policy "owners and admins can update their org"
  on public.organizations for update
  using (public.user_org_role(id) in ('owner', 'admin'));

-- Policies org_members
create policy "members can read their org membership"
  on public.org_members for select
  using (
    user_id = auth.uid()
    or org_id in (select public.user_org_ids())
  );

create policy "owner can insert members (initial creation)"
  on public.org_members for insert
  with check (
    -- Soit c'est moi qui m'ajoute (à la création de l'org)
    user_id = auth.uid()
    -- Soit je suis owner/admin de l'org
    or public.user_org_role(org_id) in ('owner', 'admin')
  );

create policy "owner can update member roles"
  on public.org_members for update
  using (public.user_org_role(org_id) in ('owner', 'admin'));

create policy "owner can remove members"
  on public.org_members for delete
  using (public.user_org_role(org_id) in ('owner', 'admin'));

-- ----------------------------------------------------------------------------
-- 4. contracts : table centrale pour Module 1 (Analyzer) + Module 3 (Registry)
-- ----------------------------------------------------------------------------
create type public.contract_status as enum (
  'draft',       -- brouillon
  'active',      -- en cours
  'expired',     -- échu
  'renewed',     -- renouvelé
  'terminated',  -- résilié
  'archived'
);

create type public.contract_risk as enum ('green', 'orange', 'red', 'unknown');

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  -- Métadonnées principales
  title text not null,
  contract_type text,           -- 'nda', 'prestataire', 'bail', 'cdi', etc.
  counterparty text,            -- nom de la contrepartie
  status public.contract_status not null default 'draft',

  -- Dates clés
  signed_at date,
  effective_from date,
  effective_to date,
  renewal_at date,

  -- Financier
  amount_cents bigint,          -- montant en centimes
  currency text default 'EUR',

  -- Tags
  tags text[] default '{}',

  -- Stockage du fichier
  storage_path text,            -- chemin dans le bucket 'contracts'
  original_filename text,
  file_size_bytes bigint,
  mime_type text,

  -- Score IA
  risk_level public.contract_risk default 'unknown',
  risk_score int,               -- 0-100

  -- Audit
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contracts enable row level security;

create index if not exists idx_contracts_org on public.contracts(org_id);
create index if not exists idx_contracts_status on public.contracts(org_id, status);
create index if not exists idx_contracts_renewal on public.contracts(org_id, renewal_at) where renewal_at is not null;

create policy "members can read their org contracts"
  on public.contracts for select
  using (org_id in (select public.user_org_ids()));

create policy "members can create contracts in their orgs"
  on public.contracts for insert
  with check (
    org_id in (select public.user_org_ids())
    and created_by = auth.uid()
  );

create policy "members can update their org contracts"
  on public.contracts for update
  using (org_id in (select public.user_org_ids()));

create policy "members can delete their org contracts"
  on public.contracts for delete
  using (org_id in (select public.user_org_ids()));

-- ----------------------------------------------------------------------------
-- 5. contract_analyses : pipeline IA persistant (Module 1)
-- ----------------------------------------------------------------------------
-- Chaque étape du pipeline multi-agents est stockée pour audit + rejouabilité.

create type public.analysis_step_kind as enum (
  'contextualization',  -- étape 1 : reformulation/compréhension
  'decomposition',      -- étape 2 : découpage en sous-questions
  'sub_analysis',       -- étape 3 : analyse d'une sous-question
  'sub_synthesis',      -- étape 4 : synthèse d'une sous-question
  'global_synthesis'    -- étape 5 : synthèse finale du dossier
);

create type public.analysis_status as enum ('pending', 'running', 'done', 'error');

create table if not exists public.contract_analyses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,

  -- Statut global de l'analyse
  status public.analysis_status not null default 'pending',
  started_at timestamptz default now(),
  finished_at timestamptz,
  error_message text,

  -- Résultats finaux (remplis à la fin du pipeline)
  executive_summary text,         -- 5 points clés
  extracted_clauses jsonb,        -- { duration, termination, liability, ... }
  improvement_suggestions jsonb,  -- [{ clause, suggestion, severity }, ...]
  global_risk public.contract_risk,
  global_risk_score int,
  confidence_level text,          -- 'green' | 'orange' | 'red'

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.contract_analyses enable row level security;

create index if not exists idx_analyses_contract on public.contract_analyses(contract_id);

create policy "members can read their org analyses"
  on public.contract_analyses for select
  using (org_id in (select public.user_org_ids()));

create policy "members can create analyses in their orgs"
  on public.contract_analyses for insert
  with check (
    org_id in (select public.user_org_ids())
    and created_by = auth.uid()
  );

create policy "members can update their org analyses"
  on public.contract_analyses for update
  using (org_id in (select public.user_org_ids()));

-- Détail de chaque étape du pipeline (audit + breadcrumb UI)
create table if not exists public.analysis_steps (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.contract_analyses(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,

  kind public.analysis_step_kind not null,
  step_index int not null,        -- ordre dans le pipeline

  -- Pour les sub_analysis / sub_synthesis : à quelle sous-question on est rattaché
  parent_step_id uuid references public.analysis_steps(id) on delete cascade,

  -- Input/output Claude
  prompt text,                    -- prompt système + user envoyé
  model text,                     -- 'claude-sonnet-4-6' | 'claude-opus-4-7'
  output_text text,               -- réponse brute
  output_json jsonb,              -- réponse parsée

  -- Sources juridiques citées (articles, jurisprudence)
  citations jsonb default '[]',   -- [{ type, ref, url, excerpt, confidence }]
  confidence_level text,          -- 'green' | 'orange' | 'red'

  -- Métriques
  tokens_in int,
  tokens_out int,
  duration_ms int,
  status public.analysis_status not null default 'pending',
  error_message text,

  created_at timestamptz not null default now()
);

alter table public.analysis_steps enable row level security;

create index if not exists idx_steps_analysis on public.analysis_steps(analysis_id, step_index);

create policy "members can read their org analysis steps"
  on public.analysis_steps for select
  using (org_id in (select public.user_org_ids()));

create policy "members can create analysis steps"
  on public.analysis_steps for insert
  with check (org_id in (select public.user_org_ids()));

create policy "members can update analysis steps"
  on public.analysis_steps for update
  using (org_id in (select public.user_org_ids()));

-- ----------------------------------------------------------------------------
-- 6. updated_at triggers (DRY)
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_profiles_touch before update on public.user_profiles
  for each row execute function public.touch_updated_at();
create trigger trg_organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger trg_contracts_touch before update on public.contracts
  for each row execute function public.touch_updated_at();
