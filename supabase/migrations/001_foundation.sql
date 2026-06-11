-- ============================================================================
-- 001_foundation.sql — Holbert : fondations multi-tenant
-- À exécuter dans l'éditeur SQL du dashboard Supabase (rôle postgres).
-- Contenu : profiles, orgs, org_members, platform_admins, entitlements,
--           audit_log (append-only), RLS stricte, RPC create_organization.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. PROFILES — miroir public de auth.users (auth.users n'est pas lisible
--    côté client ; le back-office et les listes de membres lisent profiles)
-- ============================================================================
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. TABLES CŒUR
-- ============================================================================
create table public.orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) >= 2),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id     uuid not null references public.orgs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.entitlements (
  org_id     uuid not null references public.orgs (id) on delete cascade,
  module     text not null check (module in ('raader', 'normer', 'pleiter')),
  options    jsonb not null default '{}'::jsonb,
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (org_id, module)
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid,
  actor_id    uuid,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_org_idx on public.audit_log (org_id, created_at desc);
create index org_members_user_idx on public.org_members (user_id);

-- ============================================================================
-- 3. FONCTIONS HELPER (security definer — évitent la récursion RLS)
-- ============================================================================
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function public.org_role(p_org uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.org_members
  where org_id = p_org and user_id = auth.uid();
$$;

create or replace function public.log_audit(
  p_org uuid,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql security definer
set search_path = public
as $$
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, details)
  values (p_org, auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ============================================================================
-- 4. RLS — cloisonnement strict par organisation
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.orgs            enable row level security;
alter table public.org_members     enable row level security;
alter table public.platform_admins enable row level security;
alter table public.entitlements    enable row level security;
alter table public.audit_log       enable row level security;

-- ---- profiles --------------------------------------------------------------
-- Lecture : soi-même, les co-membres d'une de ses orgs, le super admin.
create policy profiles_select on public.profiles
  for select using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1
      from public.org_members me
      join public.org_members them on them.org_id = me.org_id
      where me.user_id = auth.uid() and them.user_id = profiles.user_id
    )
  );

-- Mise à jour : uniquement son propre profil (l'email reste géré par auth).
create policy profiles_update on public.profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and email = (select email from public.profiles p where p.user_id = auth.uid()));

-- Pas de policy insert/delete : créé par trigger, supprimé par cascade auth.

-- ---- orgs ------------------------------------------------------------------
create policy orgs_select on public.orgs
  for select using (public.is_org_member(id) or public.is_platform_admin());

create policy orgs_update on public.orgs
  for update using (public.org_role(id) in ('owner', 'admin') or public.is_platform_admin());

create policy orgs_delete on public.orgs
  for delete using (public.org_role(id) = 'owner' or public.is_platform_admin());

-- Pas de policy insert : la création passe par le RPC create_organization
-- (security definer) qui crée l'org ET le membership owner atomiquement.

-- ---- org_members -----------------------------------------------------------
create policy org_members_select on public.org_members
  for select using (public.is_org_member(org_id) or public.is_platform_admin());

create policy org_members_insert on public.org_members
  for insert with check (public.org_role(org_id) in ('owner', 'admin') or public.is_platform_admin());

create policy org_members_update on public.org_members
  for update using (public.org_role(org_id) in ('owner', 'admin') or public.is_platform_admin());

create policy org_members_delete on public.org_members
  for delete using (
    user_id = auth.uid() -- quitter une organisation
    or public.org_role(org_id) in ('owner', 'admin')
    or public.is_platform_admin()
  );

-- ---- platform_admins -------------------------------------------------------
-- Chacun peut vérifier son propre statut ; aucune écriture via l'API
-- (seed manuel en SQL uniquement).
create policy platform_admins_select on public.platform_admins
  for select using (user_id = auth.uid());

-- ---- entitlements ----------------------------------------------------------
-- Lecture : membres de l'org (la sidebar en dépend) + super admin.
-- Écriture : super admin UNIQUEMENT (activation des modules = acte commercial).
create policy entitlements_select on public.entitlements
  for select using (public.is_org_member(org_id) or public.is_platform_admin());

create policy entitlements_insert on public.entitlements
  for insert with check (public.is_platform_admin());

create policy entitlements_update on public.entitlements
  for update using (public.is_platform_admin());

create policy entitlements_delete on public.entitlements
  for delete using (public.is_platform_admin());

-- ---- audit_log (append-only) -----------------------------------------------
create policy audit_log_select on public.audit_log
  for select using (
    public.is_platform_admin()
    or (org_id is not null and public.org_role(org_id) in ('owner', 'admin'))
  );

-- Pas de policy insert (passe par log_audit / triggers, security definer).
-- Append-only : on retire physiquement les droits de modification.
revoke update, delete, truncate on public.audit_log from anon, authenticated;

-- ============================================================================
-- 5. RPC — création d'organisation (atomique : org + owner + audit)
-- ============================================================================
create or replace function public.create_organization(p_name text)
returns public.orgs
language plpgsql security definer
set search_path = public
as $$
declare
  v_org public.orgs;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Le nom de l''organisation doit faire au moins 2 caractères';
  end if;

  insert into public.orgs (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into v_org;

  insert into public.org_members (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner');

  perform public.log_audit(v_org.id, 'org.created', 'org', v_org.id::text,
                           jsonb_build_object('name', v_org.name));
  return v_org;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- ============================================================================
-- 6. AUDIT AUTOMATIQUE des changements d'entitlements
-- ============================================================================
create or replace function public.audit_entitlements()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.entitlements;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  perform public.log_audit(
    v_row.org_id,
    'entitlement.' || lower(tg_op),
    'entitlement',
    v_row.module,
    jsonb_build_object('module', v_row.module, 'active', v_row.active, 'options', v_row.options)
  );
  return v_row;
end;
$$;

create trigger entitlements_audit
  after insert or update or delete on public.entitlements
  for each row execute function public.audit_entitlements();
