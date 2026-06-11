# Holbert — plateforme juridique IA

Plateforme d'information juridique et d'aide à la décision, en trois modules
activables par organisation :

| Module | Cible | Contenu |
|---|---|---|
| **Raader** | Particuliers, TPE, opérationnels | Chat juridique, calculs, courriers + audit & création de contrats |
| **Normer** | Juristes d'entreprise, DJ | Front Door, compliance, vie sociale |
| **Pleiter** | Avocats, cabinets | Dossiers contentieux, chronologie, écritures |

La suite complète s'appelle **Orders**. Voir `docs/` pour le design system
(hérité de Heldert, brand bordeaux) et l'architecture validée.

## Structure du monorepo

```
packages/ui      @holbert/ui — design system (tokens, icônes, composants)
packages/core    @holbert/core — types, modules, logique pure
apps/web         application React (Vite)
api/             fonctions serverless Vercel (jalon 2+)
supabase/        migrations SQL + tests RLS
referentiels/    référentiels documentaires YAML (jalon 2+)
baremes/         barèmes de calcul datés (jalon 4+)
docs/            rapports design system & architecture
```

## Démarrer

```bash
npm install
npm run dev        # lance apps/web (http://localhost:5173)
npm run build      # typecheck + build de production
```

Variables d'environnement : copier `.env.example` vers `.env.local` à la
racine et remplir les clés Supabase.

## Base de données

Exécuter dans l'éditeur SQL du dashboard Supabase, dans l'ordre :

1. `supabase/migrations/001_foundation.sql`
2. Créer votre compte dans l'application (signup)
3. `supabase/migrations/002_seed_platform_admin.sql` (désigne le super admin)
4. `supabase/tests/rls_smoke.sql` — doit afficher « RLS OK — isolation vérifiée »

## Règles du projet

- Le projet Heldert (`../RH`) est la référence design, en **lecture seule**.
- Le nom « Holbert » peut changer : il vit dans `packages/core/src/config.ts`,
  jamais en dur ailleurs.
- Ton éditorial : français, vouvoiement, direct, sans emojis (cf. docs/01).
