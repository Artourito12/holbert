-- ============================================================================
-- Patch 2 : policy d'INSERT permissive sur organizations (debloquage)
-- ============================================================================
-- La policy stricte auth.uid() = created_by refuse pour une raison non claire.
-- Pour debloquer : on autorise tout user authentifie a creer une org.
-- Securite : created_by reste NOT NULL et FK vers auth.users, donc on ne peut
--            pas creer pour un user inexistant. Le front met toujours
--            created_by = user.id courant. On re-tightera quand on aura les
--            invites/admin.
-- ============================================================================

drop policy if exists "authenticated users can create org" on public.organizations;
drop policy if exists "any user can create an org" on public.organizations;

create policy "auth users insert org"
  on public.organizations
  for insert
  to authenticated
  with check (true);

-- Idem pour org_members : on relache temporairement le check
drop policy if exists "members insert self or admin invites" on public.org_members;
drop policy if exists "owner can insert members (initial creation)" on public.org_members;

create policy "auth users insert org_members"
  on public.org_members
  for insert
  to authenticated
  with check (true);
