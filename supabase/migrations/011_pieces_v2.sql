/* 011 — Pieces v2 (Contentieux, docs/10 phase 1) : camp (nous / adverse /
   actes de procedure), date de la piece, titre propose par l'IA,
   numerotation par camp. Idempotent. */

alter table public.pieces add column if not exists camp text not null default 'nous';
alter table public.pieces add column if not exists date_piece date;
alter table public.pieces add column if not exists titre_propose text;

alter table public.pieces drop constraint if exists pieces_camp_check;
alter table public.pieces add constraint pieces_camp_check
  check (camp in ('nous', 'adverse', 'procedure'));

/* La numerotation devient propre a chaque camp du dossier. */
alter table public.pieces drop constraint if exists pieces_dossier_id_numero_key;
alter table public.pieces drop constraint if exists pieces_dossier_camp_numero_key;
alter table public.pieces add constraint pieces_dossier_camp_numero_key
  unique (dossier_id, camp, numero);
