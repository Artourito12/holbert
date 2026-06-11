-- ============================================================================
-- Reset complet des policies RLS sur organizations + org_members
-- ============================================================================
-- Objectif : repartir d'une base propre quand on a accumule plusieurs patches
-- et qu'une policy fantome ou un grant manquant bloque encore l'INSERT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop TOUTES les policies existantes sur organizations
-- ----------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'organizations' loop
    execute format('drop policy %I on public.organizations', pol.policyname);
  end loop;
end $$;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'org_members' loop
    execute format('drop policy %I on public.org_members', pol.policyname);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Re-enable RLS (flush cache)
-- ----------------------------------------------------------------------------
alter table public.organizations disable row level security;
alter table public.organizations enable row level security;

alter table public.org_members disable row level security;
alter table public.org_members enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Grants explicites
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.org_members to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Policies fraiches (toutes permissives, scoping par membership)
-- ----------------------------------------------------------------------------
create policy "orgs_select_members"
  on public.organizations
  for select
  to authenticated
  using (id in (select public.user_org_ids()));

create policy "orgs_insert_auth"
  on public.organizations
  for insert
  to authenticated
  with check (true);

create policy "orgs_update_members"
  on public.organizations
  for update
  to authenticated
  using (id in (select public.user_org_ids()))
  with check (id in (select public.user_org_ids()));

create policy "orgs_delete_admins"
  on public.organizations
  for delete
  to authenticated
  using (public.user_org_role(id) in ('owner', 'admin'));

-- ----------------------------------------------------------------------------
-- org_members
-- ----------------------------------------------------------------------------
create policy "members_select_self_or_org"
  on public.org_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or org_id in (select public.user_org_ids())
  );

create policy "members_insert_auth"
  on public.org_members
  for insert
  to authenticated
  with check (true);

create policy "members_update_admins"
  on public.org_members
  for update
  to authenticated
  using (public.user_org_role(org_id) in ('owner', 'admin'));

create policy "members_delete_admins"
  on public.org_members
  for delete
  to authenticated
  using (public.user_org_role(org_id) in ('owner', 'admin'));

-- ----------------------------------------------------------------------------
-- 5. Verification (a regarder dans le panneau Results)
-- ----------------------------------------------------------------------------
select 'organizations' as table_name, policyname, cmd, permissive, roles
from pg_policies where tablename = 'organizations'
union all
select 'org_members', policyname, cmd, permissive, roles
from pg_policies where tablename = 'org_members'
order by table_name, cmd, policyname;
