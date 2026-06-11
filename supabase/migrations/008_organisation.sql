-- ============================================================================
-- 008_organisation.sql — profil d'organisation (contexte IA), invitations
-- Script IDEMPOTENT.
-- ============================================================================

drop table if exists public.invitations cascade;
drop table if exists public.org_profils cascade;

-- ---------------------------------------------------------------------------
-- Profil de l'organisation : les données d'entreprise que l'IA utilise comme
-- contexte dans TOUTES ses analyses (chat, audits, Front Door, générations).
-- ---------------------------------------------------------------------------
create table public.org_profils (
  org_id                uuid primary key references public.orgs (id) on delete cascade,
  activite              text,
  forme_juridique       text,
  effectif              text,
  convention_collective text,
  implantations         text,
  contexte_ia           text, -- notes libres : tout ce que l'IA doit savoir
  updated_by            uuid references auth.users (id),
  updated_at            timestamptz not null default now()
);

alter table public.org_profils enable row level security;

create policy org_profils_select on public.org_profils
  for select using (public.is_org_member(org_id));
create policy org_profils_insert on public.org_profils
  for insert with check (public.org_role(org_id) in ('owner', 'admin'));
create policy org_profils_update on public.org_profils
  for update using (public.org_role(org_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- Invitations : un owner/admin invite par email ; à la première connexion,
-- l'invité est rattaché automatiquement (RPC accepter_invitations).
-- ---------------------------------------------------------------------------
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs (id) on delete cascade,
  email       text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  invited_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (org_id, email)
);

alter table public.invitations enable row level security;

create policy invitations_select on public.invitations
  for select using (public.is_org_member(org_id));
create policy invitations_delete on public.invitations
  for delete using (public.org_role(org_id) in ('owner', 'admin'));
-- Insertion via l'API (vérifications + email), service role.

create or replace function public.accepter_invitations()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_inv record;
begin
  if auth.uid() is null then return 0; end if;
  for v_inv in
    select * from public.invitations
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and accepted_at is null
  loop
    insert into public.org_members (org_id, user_id, role)
    values (v_inv.org_id, auth.uid(), v_inv.role)
    on conflict (org_id, user_id) do nothing;
    update public.invitations set accepted_at = now() where id = v_inv.id;
    perform public.log_audit(v_inv.org_id, 'org.invitation_acceptee', 'invitation', v_inv.id::text,
                             jsonb_build_object('role', v_inv.role));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.accepter_invitations() from public, anon;
grant execute on function public.accepter_invitations() to authenticated;
