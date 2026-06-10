-- ============================================================================
-- Patch : RLS robuste sur organizations + org_members
-- ============================================================================
-- Symptôme : "new row violates row-level security policy for table organizations"
-- Cause : policy initiale qui n'expose pas explicitement le rôle authenticated,
--         et qui ne tolère pas certaines edge-cases de auth.uid().
-- Fix : recréer la policy avec `to authenticated` et le pattern recommandé Supabase.
-- ============================================================================

-- Diagnostic : décommenter pour voir l'utilisateur courant et les policies actives
-- select auth.uid() as current_user_uid;
-- select policyname, cmd, qual, with_check from pg_policies where tablename = 'organizations';

-- ----------------------------------------------------------------------------
-- organizations : INSERT
-- ----------------------------------------------------------------------------
drop policy if exists "any user can create an org" on public.organizations;

create policy "authenticated users can create org"
  on public.organizations
  for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

-- ----------------------------------------------------------------------------
-- org_members : INSERT (le user s'ajoute lui-même comme owner après création)
-- ----------------------------------------------------------------------------
drop policy if exists "owner can insert members (initial creation)" on public.org_members;

create policy "members insert self or admin invites"
  on public.org_members
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or public.user_org_role(org_id) in ('owner', 'admin')
  );
