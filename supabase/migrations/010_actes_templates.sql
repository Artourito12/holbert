/* 010 — Modeles d'actes fournis par l'utilisateur, analyses par l'IA
   (structure, en-tete, champs variables, style) puis imites a la generation.
   Idempotent. Commentaires en bloc pour survivre aux copier-coller. */

create table if not exists actes_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nom_fichier text not null,
  storage_path text not null,
  mime text not null,
  type_acte text,
  description text,
  texte text,
  analyse jsonb,
  statut text not null default 'processing' check (statut in ('processing','ready','error')),
  erreur text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists actes_templates_org_idx on actes_templates(org_id);

alter table actes_templates enable row level security;

drop policy if exists "templates select membres" on actes_templates;
create policy "templates select membres" on actes_templates
  for select using (is_org_member(org_id));

drop policy if exists "templates insert membres" on actes_templates;
create policy "templates insert membres" on actes_templates
  for insert with check (is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "templates delete membres" on actes_templates;
create policy "templates delete membres" on actes_templates
  for delete using (is_org_member(org_id));

/* Les mises a jour (analyse) passent par la service role uniquement. */

drop trigger if exists actes_templates_touch on actes_templates;
create trigger actes_templates_touch
  before update on actes_templates
  for each row execute function touch_updated_at();
