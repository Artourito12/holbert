# Rapport 1 — Recoupement Heldert & extraction du design system

> Source analysée : projet **Heldert** (`C:\Users\aarra\Desktop\RH`), app RH en production.
> Objectif : matérialiser sa direction artistique à 100 % (couleur brand exceptée : bordeaux
> au lieu du bleu) sous forme de design tokens + librairie de composants partagée.
> Statut : **en attente de validation** avant toute implémentation.

---

## 1. Stack design de Heldert (à reprendre à l'identique)

| Élément | Valeur |
|---|---|
| Framework CSS | Tailwind CSS **v4** (`@theme` dans le CSS, pas de tailwind.config.js) |
| Police principale | **IBM Plex Sans** 400/500/600/700 (Google Fonts) |
| Police secondaire | Outfit (chargée, peu utilisée — display/landing) |
| Icônes | **SVG custom** (68 icônes dans `src/icons/`) via `vite-plugin-svgr` |
| Dark mode | classe `.dark` sur `<html>`, persistée en `localStorage["theme"]` |
| Utilitaires | `clsx` + `tailwind-merge` |
| Dates | flatpickr (datepicker) + FullCalendar (calendrier) |
| Graphiques | ApexCharts |

## 2. Design tokens

### 2.1 Couleur brand — LE seul écart autorisé

Heldert utilise un bleu (`#1E40AF` / échelle `brand-*` bleue). La plateforme juridique
reprend **tout** sauf cette échelle, remplacée par le **bordeaux/bourgogne** déjà défini :

```css
/* Palette brand — bordeaux / bourgogne (validée, remplace le bleu Heldert) */
--color-brand-25:  #fdf6f7;
--color-brand-50:  #fbeaee;
--color-brand-100: #f5cad2;
--color-brand-200: #eb9cab;
--color-brand-300: #de6c84;
--color-brand-400: #cf445f;
--color-brand-500: #b22a45;   /* primaire */
--color-brand-600: #931f3a;   /* hover */
--color-brand-700: #79192f;
--color-brand-800: #5e1428;
--color-brand-900: #441020;
--color-brand-950: #2a0a14;
```

Points dérivés à adapter en cohérence (sinon il restera du bleu résiduel) :
- `--shadow-focus-ring` → `0 0 0 4px rgba(178, 42, 69, 0.12)` (fait dans la copie actuelle)
- `:focus-visible { outline: 2px solid #b22a45 }` (Heldert : `#1E40AF`)
- Le violet « IA » de Heldert (`#7a5af8`) est conservé tel quel : il signale les
  fonctions IA et reste lisible à côté du bordeaux.

### 2.2 Échelles neutres et sémantiques (reprises à l'identique)

Échelles complètes 25→950 reprises sans modification de Heldert :
`gray` (#fcfcfd → #0c111d, + `gray-dark` #1a2231 pour le fond dark mode),
`success` (vert #12b76a en 500), `error` (rouge #f04438), `warning` (jaune #f79009),
`orange` (#fb6514), `blue-light` (#0ba5ec — info), accents `theme-pink-500` #ee46bc
et `theme-purple-500` #7a5af8.

Valeurs de référence rapides : fond app `gray-50` #f9fafb · bordure par défaut
`gray-200` #e4e7ec · texte principal `gray-800`/`gray-900` · texte secondaire `gray-500`.

### 2.3 Typographie

```
Body : "IBM Plex Sans", system-ui, sans-serif — 14px de base, font-normal, bg-gray-50
Titres   : title-2xl 72/90 · title-xl 60/72 · title-lg 48/60 · title-md 36/44 · title-sm 30/38
Corps    : theme-xl 20/30 · theme-sm 14/20 · theme-xs 12/18
Graisses : 400 (texte) · 500 (libellés, menu) · 600 (titres de cartes, boutons) · 700 (rare)
```

### 2.4 Espacement, rayons, ombres, z-index, breakpoints

```
Espacement : échelle 4px — xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48 · 4xl 64
Rayons     : sm 4 · md 6 · lg 8 (boutons, inputs) · xl 12 (cartes, modales) · full
Ombres     : theme-xs/sm/md/lg/xl (copies exactes des rgba(16,24,40,…) de Heldert)
             + focus-ring bordeaux + shadow-tooltip + drop-shadow-4xl
Z-index    : 1 / 9 / 99 / 999 / 9999 / 99999 / 999999 (header sticky = z-99999)
Breakpoints: 2xsm 375 · xsm 425 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536 · 3xl 2000
Transitions: 0.12s / 0.18s / 0.3s ease ; sidebar 300ms ease-in-out
```

## 3. Layout et navigation (patterns à reproduire)

- **Sidebar** : 290px déployée / 90px repliée, bascule au breakpoint `xl` (1280px),
  overlay + backdrop en mobile. Items : `menu-item` (px-3 py-2, rounded-lg, text-theme-sm,
  font-medium) ; actif = `bg-brand-50 text-brand-500` ; sections expandables avec chevron ;
  badges dynamiques colorés par sévérité.
- **Header** : sticky top-0, fond blanc, bordure basse, z-99999 — recherche globale,
  cloche notifications, menu compte (avatar + dropdown).
- **Contenu** : `max-w-(--breakpoint-2xl)` (1536px), padding `p-2 sm:p-4 md:p-6`.
- **Scrollbars** : `custom-scrollbar` fine (6px, thumb gray-200/gray-700).

## 4. Inventaire des composants Heldert

### 4.1 Existants — à reprendre dans la librairie partagée

| Famille | Composants | Notes de style |
|---|---|---|
| Actions | Button (primary/outline, sm/md, startIcon/endIcon), ButtonGroup | rounded-lg, bg-brand-500→600 hover |
| Affichage | Badge (light/solid × 7 couleurs), Card (+Title/Description), Avatar (6 tailles + statut), Ribbon | cartes : rounded-xl border gray-200 p-5 |
| Overlays | Modal (backdrop blur, fullscreen option), Dropdown (+Item/Icon/Divider), Popover, Tooltip (4 placements) | dropdowns : rounded-xl shadow-theme-lg |
| Navigation | Tabs (underline/badge/vertical/icon), Breadcrumb (3 séparateurs), Pagination (3 variantes) | actif = underline brand |
| Feedback | Alert (4 variantes), Toast custom (success 4s/error 6s/info 4s/warning 5s, top-right, slide-in), Notification banner, ProgressBar (3 variantes), Spinner (4) | toasts : fond pastel + bordure sémantique |
| Données | Table composable (Header/Body/Row/Cell), checkboxes custom (`tableCheckbox`, `taskCheckbox`) | |
| Formulaires | Inputs (border gray, rounded 6, focus ring brand), PasswordInput (œil), DynamicFieldsForm (validation + brouillon auto localStorage), Dropzone upload | label 600/13px, erreur = bordure + fond rouge + `role="alert"` |
| Métier | **Chat tri-colonne** (conversations / messages markdown / panneau documents), éditeur par blocs, checklists onboarding, stats cards dashboard | le chat Heldert est la base directe du chat juridique |

### 4.2 Manquants — à créer dans le style Heldert (signalement explicite, cf. brief §0.3)

Ces composants n'existent pas dans Heldert et seront créés en suivant ses tokens :

1. **Visionneuse de document annotée** — vue côte à côte document/annotations, surlignage
   par gravité (error/warning/success), ancres clause par clause. *(bloc 2 audit)*
2. **Redline / diff de versions** — ajouts/suppressions/modifications avec analyse d'impact. *(bloc 2)*
3. **Frise chronologique interactive** — événements datés, sourcés vers les pièces, éditable,
   zoom. *(bloc 3 — donnée pivot, et widget chat)*
4. **Calculatrice à sliders** — sliders + résultat temps réel + détail du calcul + sources. *(widget)*
5. **Arbre de décision / questionnaire pas-à-pas** — une question à la fois, branchements,
   « pourquoi cette question ? », barre de progression. *(socle 2.6)*
6. **Tableau comparatif riche** — colonnes épinglées, tri, surlignage des écarts. *(widget)*
7. **Checklist cochable** — avec persistance et progression. *(widget)*
8. **Stepper / wizard** — multi-étapes avec état conservé. *(création de contrat, onboarding)*
9. **Jauge de score** — score de risque (audit) et score de complétude (onboarding/data room).
10. **Citation juridique** — bloc source (article, texte, lien Légifrance) inséré dans les réponses.
11. **Bordereau / liste de pièces numérotée** — avec renumérotation par glisser-déposer. *(bloc 3)*
12. **Bannière disclaimer** — mention « information juridique, pas conseil individualisé »,
    discrète mais systémique.

## 5. Ton éditorial Heldert (à transposer)

Caractéristiques observées : français métier précis, formulations directes et impératives,
**vouvoiement** dans les messages adressés à l'utilisateur (« Posez votre question… »,
« Vérifiez votre boîte mail »), pas d'emojis, confirmations explicites pour les actions
destructives avec rappel de conséquence.

Exemples verbatim à imiter :
- Placeholder chat : « Posez votre question, demandez un document ou un outil interactif… (Entrée pour envoyer) »
- Sous-titre de page : « Parcours d'intégration et de sortie de vos salariés, avec checklists et dates clés. »
- Bouton : « + Importer un document (PDF, DOCX — 10 Mo max) »
- Confirmation : « Supprimer définitivement “{titre}” ? Le fichier et son indexation seront supprimés. »
- Erreur : « Votre email n'a pas encore été confirmé. Vérifiez votre boîte mail (et vos spams). »

> Note : Heldert mélange ponctuellement tutoiement (« Communique avec vos équipes ») et
> vouvoiement. Pour une plateforme juridique, **vouvoiement systématique** recommandé —
> à confirmer (question n°8 du récap).

## 6. Recoupement avec le repo holbert actuel

Le repo contient déjà une copie partielle du design Heldert (faite lors des sessions
précédentes) : `src/index.css` est conforme (tokens + bordeaux), ~40 composants UI copiés,
layout sidebar/header. Conformément au brief (« repartir à zéro »), rien n'est réutilisé
d'office ; ce qui suit est **proposé explicitement** à la réutilisation car strictement
identique à la source Heldert :

| Élément du repo actuel | Proposition |
|---|---|
| `src/index.css` (tokens + bordeaux) | **Réutiliser** comme base du package tokens (déjà l'extraction exacte + brand bordeaux) |
| `src/components/ui/*` (40 composants) | **Re-copier proprement depuis Heldert** dans le package UI (la copie actuelle est partielle : il manque pagination, breadcrumb, notification, Toast custom…) et y intégrer le bordeaux |
| Icônes : le repo utilise `lucide-react` | **Écart de DA** — Heldert utilise ses 68 SVG custom. Proposition : copier `src/icons/` de Heldert (fidélité 100 %) et n'autoriser lucide qu'en complément pour les icônes juridiques manquantes, redessinées au même trait (2px, rounded) |
| `public/logo.png` | ✅ Confirmé — logo fourni par Arthur (10/06/2026), avec `favicon.svg` et `icons.svg` |
| `api/`, `sql/`, pages, contexts | **Ne pas réutiliser** — reconstruits proprement (le SQL existant a notamment RLS désactivé en workaround, rédhibitoire pour du multi-tenant juridique) |
