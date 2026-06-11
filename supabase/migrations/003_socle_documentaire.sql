-- ============================================================================
-- 003_socle_documentaire.sql — Holbert jalon 2
-- Base documentaire (2 étages), recherche sémantique (pgvector),
-- échéancier, notifications, chat (conversations/messages).
-- ⚠️ Le super admin n'a AUCUN accès à ces tables (contenu client).
-- Script IDEMPOTENT : ré-exécutable sans erreur (drop puis recreate).
-- Les policies storage sont dans 003b_storage_policies.sql.
-- ============================================================================

create extension if not exists vector;

-- Reprise propre en cas d'exécution précédente partielle
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.notifications cascade;
drop table if exists public.deadlines cascade;
drop table if exists public.extracted_facts cascade;
drop table if exists public.document_chunks cascade;
drop table if exists public.documents cascade;
drop function if exists public.match_chunks(uuid, vector, int);

-- ============================================================================
-- 1. TABLES
-- ============================================================================
create table public.documents (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.orgs (id) on delete cascade,
  nom_fichier         text not null,
  mime                text not null,
  taille              bigint not null default 0,
  hash_sha256         text,
  storage_path        text not null,
  statut              text not null default 'uploaded'
                      check (statut in ('uploaded','processing','classified','extracting','ready','error')),
  erreur              text,
  type_detecte        text,
  type_confiance      real,
  indices             jsonb not null default '[]'::jsonb,
  type_confirme       text,
  referentiel_version int,
  version_de          uuid references public.documents (id) on delete set null,
  uploaded_by         uuid not null references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index documents_org_idx on public.documents (org_id, created_at desc);
create index documents_hash_idx on public.documents (org_id, hash_sha256);

create table public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  org_id      uuid not null references public.orgs (id) on delete cascade,
  contenu     text not null,
  position    int not null,
  embedding   vector(1536)
);

create index document_chunks_doc_idx on public.document_chunks (document_id);
create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

create table public.extracted_facts (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.documents (id) on delete cascade,
  org_id         uuid not null references public.orgs (id) on delete cascade,
  fait_id        text not null,
  type           text not null,
  valeur         jsonb not null,
  passage_source text,
  confiance      real,
  created_at     timestamptz not null default now()
);

create index extracted_facts_doc_idx on public.extracted_facts (document_id);

create table public.deadlines (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs (id) on delete cascade,
  document_id    uuid references public.documents (id) on delete cascade,
  fait_id        text,
  titre          text not null,
  date_echeance  date not null,
  paliers_alerte int[] not null default '{30,7,1}',
  statut         text not null default 'a_venir'
                 check (statut in ('a_venir','traitee','ignoree')),
  created_at     timestamptz not null default now()
);

create index deadlines_org_idx on public.deadlines (org_id, date_echeance);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  titre      text not null,
  corps      text,
  lien       text,
  lue        boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, lue, created_at desc);

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  titre      text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now()
);

create index conversations_org_idx on public.conversations (org_id, created_at desc);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  org_id          uuid not null references public.orgs (id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  contenu         text not null,
  intent          jsonb,
  sources         jsonb,
  widget          jsonb,
  created_at      timestamptz not null default now()
);

create index messages_conv_idx on public.messages (conversation_id, created_at);

-- updated_at automatique sur documents
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 2. RLS — membres de l'org uniquement (PAS de policy super admin ici :
--    le contenu documentaire des clients ne lui est pas accessible)
-- ============================================================================
alter table public.documents       enable row level security;
alter table public.document_chunks enable row level security;
alter table public.extracted_facts enable row level security;
alter table public.deadlines       enable row level security;
alter table public.notifications   enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;

-- documents : lecture membres ; insert par l'uploadeur membre ; modification
-- de contenu réservée au serveur (service role) ; suppression owner/admin ou uploadeur.
create policy documents_select on public.documents
  for select using (public.is_org_member(org_id));
create policy documents_insert on public.documents
  for insert with check (public.is_org_member(org_id) and uploaded_by = auth.uid());
create policy documents_delete on public.documents
  for delete using (
    public.is_org_member(org_id)
    and (uploaded_by = auth.uid() or public.org_role(org_id) in ('owner','admin'))
  );

create policy document_chunks_select on public.document_chunks
  for select using (public.is_org_member(org_id));

create policy extracted_facts_select on public.extracted_facts
  for select using (public.is_org_member(org_id));

create policy deadlines_select on public.deadlines
  for select using (public.is_org_member(org_id));
create policy deadlines_update on public.deadlines
  for update using (public.is_org_member(org_id));

create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());

create policy conversations_select on public.conversations
  for select using (public.is_org_member(org_id));
create policy conversations_insert on public.conversations
  for insert with check (public.is_org_member(org_id) and created_by = auth.uid());
create policy conversations_delete on public.conversations
  for delete using (public.is_org_member(org_id) and created_by = auth.uid());

create policy messages_select on public.messages
  for select using (public.is_org_member(org_id));

-- ============================================================================
-- 3. RECHERCHE SÉMANTIQUE — RPC avec garde d'appartenance
-- ============================================================================
create or replace function public.match_chunks(
  p_org uuid,
  p_embedding vector(1536),
  p_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  contenu text,
  pos int,
  similarite double precision
)
language sql stable security definer
set search_path = public
as $$
  select c.id, c.document_id, c.contenu, c.position,
         1 - (c.embedding <=> p_embedding) as similarite
  from public.document_chunks c
  where c.org_id = p_org
    and c.embedding is not null
    and (public.is_org_member(p_org) or (auth.jwt() ->> 'role') = 'service_role')
  order by c.embedding <=> p_embedding
  limit least(greatest(p_count, 1), 20);
$$;

revoke all on function public.match_chunks(uuid, vector, int) from public, anon;
grant execute on function public.match_chunks(uuid, vector, int) to authenticated, service_role;

-- ============================================================================
-- 4. STORAGE — bucket privé "documents"
--    (les policies sont dans 003b_storage_policies.sql)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800, -- 50 Mo
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'message/rfc822',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
