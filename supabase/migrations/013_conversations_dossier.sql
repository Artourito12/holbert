/* 013 — Conversations rattachables a un dossier contentieux (docs/10 phase 3).
   Le chat Hofraad d'un dossier connait le scan, le bordereau, la chronologie
   et les pieces. Idempotent. */

alter table public.conversations
  add column if not exists dossier_id uuid references public.dossiers (id) on delete set null;

create index if not exists conversations_dossier_idx
  on public.conversations (dossier_id, created_at desc);
