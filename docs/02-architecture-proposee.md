# Rapport 2 — Architecture (validée le 11/06/2026, amendée)

> Statut : **validé** avec les décisions ci-dessous.
> Règle absolue : le projet Heldert (`C:\Users\aarra\Desktop\RH`) est en **lecture seule**
> (référence design uniquement) — on ne travaille que sur holbert.

---

## 0. Offre commerciale et nommage (décision du 11/06/2026)

Trois **modules** activables par organisation — le moteur Contrats n'est PAS un module
séparé : c'est une capacité interne de Raader.

| Module | Nom | Cible | Contenu (réf. brief) |
|---|---|---|---|
| Conseil | **Raader** | particuliers, TPE, opérationnels | bloc 1 (chat, calculs, courriers) **+ bloc 2 intégré** (audit & création de contrats) |
| Compliance | **Normer** | juristes d'entreprise, DJ | bloc 4 (Front Door + options) |
| Contentieux | **Pleiter** | avocats, cabinets | bloc 3 (dossiers, chronologie) |
| Suite complète | **Orders** | — | les trois modules ensemble |

Plateforme : **Holbert** (nom susceptible de changer → le nom doit rester une constante
de config centralisée, jamais en dur dans le code ou les textes).

## 1. Décisions structurantes (validées)

### D1 — Un seul produit déployé, modules activés par licence (feature flags)

Une application unique dont la navigation et les capacités s'adaptent aux modules
activés pour l'organisation (table `entitlements`, modules `raader` / `normer` / `pleiter`).

- « Vendu séparément » = commercial, pas technique.
- Les synergies du §7 du brief deviennent triviales : même base, mêmes données, un simple
  test d'entitlement ouvre le pont entre modules, sans rupture d'UX.
- Un client mono-module ne voit jamais les autres (sidebar, routeur d'intention et
  API filtrent par entitlements).
- L'activation des modules est pilotée par le **super admin plateforme** (cf. D5).

### D5 — Back-office plateforme (super admin)

Espace réservé (hors organisations) pour Arthur :
- liste des organisations et des inscrits (volumes, dates, dernière activité),
- activation/désactivation des modules par organisation (Raader / Normer / Pleiter,
  et options de Normer),
- vue santé : usage par module, erreurs d'ingestion, ratés du routeur d'intention.

Implémentation : flag `is_platform_admin` porté par le user (table `platform_admins`),
routes `/admin/*` dans la même app, RLS dédiée (les policies « platform admin » sont les
seules à traverser le cloisonnement des orgs, en lecture + gestion des entitlements,
jamais en lecture du contenu documentaire des clients sans trace d'audit).

### D2 — Monorepo npm workspaces, design system en package partagé

```
holbert/
├─ packages/
│  ├─ ui/                  # @holbert/ui — design system Heldert (tokens, icônes, composants)
│  │  ├─ tokens/           #   index.css (@theme), design-tokens.ts
│  │  ├─ icons/            #   68 SVG Heldert + icônes juridiques créées au même trait
│  │  └─ components/       #   librairie complète (cf. rapport 1, §4.1 + §4.2)
│  └─ core/                # @holbert/core — logique pure, zéro dépendance UI/serveur
│     ├─ referentiels/     #   chargeur + validation zod des YAML, fallback générique
│     ├─ calculs/          #   moteurs de calcul purs, rejouables à date
│     ├─ types/            #   types partagés (Document, Intent, Widget, Deadline…)
│     └─ events/           #   définition des événements inter-blocs
├─ apps/
│  └─ web/                 # app React (Vite) — shell + modules Raader/Normer/Pleiter + admin
│     └─ src/
│        ├─ app/           #   routing, layout, providers, entitlements
│        ├─ features/
│        │  ├─ chat/       #   expérience conversationnelle commune (socle)
│        │  ├─ documents/  #   base documentaire, onboarding documentaire
│        │  ├─ echeancier/ #   échéancier transversal
│        │  ├─ raader/     #   module Conseil — inclut conseil ET contrats (audit/création)
│        │  ├─ pleiter/    #   module Contentieux
│        │  ├─ normer/     #   module Compliance (front door + options)
│        │  └─ admin/      #   back-office plateforme (super admin)
│        └─ widgets/       #   registre des widgets interactifs (rendu chat)
├─ api/                    # Vercel serverless functions (Node)
│  ├─ _lib/                #   clients (claude, supabase admin), middleware auth/org/audit
│  ├─ chat/                #   routeur d'intention + orchestration des compétences
│  ├─ documents/           #   ingestion, classification, extraction, embeddings
│  ├─ contrats/            #   audit, génération, redline
│  ├─ contentieux/         #   chronologie, bordereau, analyses
│  └─ cron/                #   alertes échéancier, veille
├─ referentiels/           # YAML versionnés — 1 fichier par type de document + _schema + _fallback
├─ baremes/                # JSON versionnés/datés — 1 dossier par compétence de calcul
├─ supabase/               # migrations SQL numérotées, RLS, seeds
└─ docs/
```

Pourquoi un monorepo : le brief exige que le design system soit **partagé et synchronisé**
entre Heldert et la plateforme juridique. `@holbert/ui` est le candidat à l'extraction
(publication npm privée ou git submodule) le jour où Heldert le consomme aussi.
En attendant, zéro friction : Vercel et Vite gèrent les workspaces nativement.

### D3 — Stack technique (continuité avec Heldert, corrections incluses)

| Couche | Choix | Justification |
|---|---|---|
| Front | React 19 + Vite + Tailwind v4 + react-router 7 | identique Heldert |
| Backend | Vercel serverless functions (Node) | identique Heldert, déjà maîtrisé |
| BDD / Auth / Storage | **Supabase nouveau projet (déjà créé par Arthur)** | l'ancien projet avait RLS désactivé en workaround — on repart sur un schéma neuf avec RLS strict testé dès la migration 001 |
| Recherche sémantique | **pgvector** (extension Supabase) | pas de service externe en plus |
| IA | Claude API (`claude-fable-5` pour l'analyse juridique, Haiku pour la classification/routage) | déjà utilisé ; sorties structurées via tool use |
| Embeddings | **OpenAI** (`text-embedding-3-small`, upgrade `-large` possible) | décision du 11/06 ; clé `OPENAI_API_KEY` côté serverless uniquement |
| Génération DOCX/PDF | `docx` (npm) pour DOCX natif ; PDF via rendu HTML → `@react-pdf/renderer` ou Gotenberg si besoin de fidélité | serverless-compatible |
| Email (alertes) | **Resend** — compte à créer ensemble au moment du jalon échéancier | d'ici là, alertes in-app uniquement |
| Validation | zod partout (référentiels, payloads API, widgets) | un seul langage de schéma |

### D4 — RGPD et confiance dès la migration 001 (pas en couche tardive)

- **Multi-tenant** : `org_id` sur toutes les tables, RLS strict, **tests automatisés
  d'isolation** (un script qui tente de lire les données d'une autre org doit échouer).
- **Audit log** : table append-only alimentée par triggers + middleware API (qui, quoi,
  quand, depuis où). C'est un argument de vente des blocs 3/4, donc une feature, pas une corvée.
- **Disclaimer systémique** : composant bannière + comportement IA (le routeur classe
  chaque réponse : information générale / cas nécessitant un professionnel → orientation).
- Suppression sur demande : cascade org → documents → chunks → storage, journalisée.
- Claude API : DPA Anthropic + zéro rétention ; option Bedrock/Vertex région UE plus tard
  si des clients DJ l'exigent.

---

## 2. Socle commun — conception des moteurs

### 2.1 Routeur d'intention (le « cerveau » du chat)

Un appel Claude avec sortie structurée (tool use) qui retourne :

```ts
type Intent = {
  kind: "question" | "calcul" | "generation" | "audit" | "analyse_pieces"
        | "recherche_base" | "action_gestion" | "hors_perimetre";
  module: "raader" | "pleiter" | "normer";   // arbitré selon entitlements
  competence?: string;        // ex: "calc.indemnite_licenciement", "gen.mise_en_demeure"
  besoin_professionnel: boolean;  // déclenche l'orientation (avocat, conciliateur…)
  donnees_manquantes: string[];   // questions à poser — APRÈS recherche dans la base
};
```

Pipeline d'un tour de chat : intention → recherche dans la base documentaire de l'org
(toujours) → ne poser que les questions réellement manquantes → exécuter la compétence →
restituer (texte sourcé / document / widget). Chaque tour est journalisé (audit + telemetry
des « ratés » du routeur pour améliorer les référentiels).

### 2.2 Moteur documentaire à deux étages

- **Étage 1 — identification** : Claude (Haiku) + premier filtrage par heuristiques
  (extension, en-têtes) → `{ type, confiance, indices }`. Confirmation systématique à
  l'utilisateur (« J'ai identifié un bail commercial — c'est bien ça ? »).
- **Étage 2 — référentiel** : fichier YAML chargé par type, validé par zod :

```yaml
# referentiels/bail-commercial.yaml
meta: { id: bail-commercial, version: 3, famille: baux }
identification: { indices: [...], pieges_confusion: [bail-professionnel] }
roles: [bailleur, preneur]
clauses_attendues:   # checklist — manquante = alerte
  - { id: duree, gravite_si_absente: majeure, fondement: "art. L145-4 C. com." }
clauses_pieges:      # illégales ou abusives — avec fondement
  - { id: ..., detection: ..., fondement: ..., gravite: ... }
points_negociation:  # par rôle
extraction:          # données structurées à extraire (parties, dates, montants, échéances)
questions:           # par rôle et par objectif (signer / renégocier / sortir)
```

  Fallback `_generique.yaml` pour les types inconnus. Ajouter un type = ajouter un fichier,
  zéro code. CI : validation de schéma sur tous les YAML.

### 2.3 Base documentaire

Ingestion : upload → storage → extraction texte (PDF/DOCX/image OCR) → étage 1 →
extraction structurée selon référentiel → chunks + embeddings (pgvector) → détection
doublons/versions (hash exact + similarité) → alimentation échéancier (dates extraites).

### 2.4 Moteur de calcul

Compétences = fonctions pures dans `packages/core/calculs`, paramétrées par des barèmes
JSON datés (`effective_from`/`effective_to`) dans `baremes/`. Tout calcul retourne
`{ resultat, detail_etapes, sources, baremes_utilises (versions) }` — rejouable à date.
**Tests golden** : chaque calculateur a des cas de référence validés (jurisprudence,
simulateurs officiels) qui verrouillent les résultats en CI.

### 2.5 Widgets interactifs

Contrat typé entre l'IA et le front (pas d'iframe, contrairement au chat Heldert —
intégration native, interactions remontées dans la conversation) :

```ts
type Widget =
  | { type: "calculatrice"; competence: string; params: …; }
  | { type: "frise";        evenements: …[] }
  | { type: "arbre";        racine: NoeudDecision }
  | { type: "comparatif";   colonnes: …; lignes: … }
  | { type: "checklist";    items: …[] }
  | { type: "formulaire";   etapes: …[] };
```

L'IA émet le JSON (validé zod), le front rend le composant `@holbert/ui` correspondant,
les réponses de l'utilisateur reviennent comme messages structurés.

### 2.6 Schéma de données (tables principales)

```
orgs, org_members(role), entitlements(module: raader|normer|pleiter, options jsonb, actif)
platform_admins(user_id)            — super admin plateforme (back-office /admin)
documents(org_id, type_detecte, type_confirme, statut, hash, version_de)
document_chunks(embedding vector, document_id), extracted_facts(document_id, cle, valeur, source_span)
deadlines(org_id, source_document/dossier, date, type, niveau_alerte, statut)
conversations, messages(role, contenu, widget_payload, sources)
knowledge_entries(org_id, type, contenu, tags, embedding, valide_par)
audit_log(append-only), notification(in-app)
— Raader/contrats : contracts(audit_runs, findings, redlines), templates(org)
— Pleiter : dossiers(parties, juridiction), pieces(numero_bordereau), evenements_chronologie
— Normer : demandes_front_door(statut, sla, juriste), entites(groupe), mandats, delegations…
```

### 2.7 Échéancier & alertes

Cron Vercel quotidien → deadlines arrivant à échéance (paliers J-90/J-30/J-7/J-1
configurables) → notifications in-app + email. Multi-niveaux pour le bloc 3 (l'oubli de
délai = LA faute professionnelle).

### 2.8 Ponts inter-blocs (§7 du brief)

Table `domain_events` (ex : `contrat.audit_termine`, `dossier.cree_depuis_conversation`)
+ handlers activés par entitlements. Un client mono-bloc : événements émis mais sans
consommateur — le jour où il achète le 2e bloc, l'historique est déjà là.

---

## 3. Ordre de développement (inchangé vs brief §9, jalons précisés)

| # | Jalon | Contenu | Livrable vérifiable |
|---|---|---|---|
| 0 | ✅ ce rapport | recoupement + DS + archi | validé le 11/06/2026 |
| 1 | Fondations | monorepo, `@holbert/ui` complet (tokens bordeaux + composants Heldert + nouveaux composants signalés), Supabase neuf (migrations : orgs, RLS testée, audit, entitlements), auth + création d'org, **back-office super admin v1** (inscrits + activation modules) | app shell qui tourne, page de démo des composants, activation d'un module depuis /admin |
| 2 | Socle | ingestion documentaire (étages 1+2), 3 référentiels (bail commercial, prestation, CGV), base + recherche sémantique, échéancier, routeur d'intention v1 | uploader un bail en vrac → classé, extrait, échéances détectées |
| 3 | Raader — moteur Contrats | workflow audit complet (rôle, objectif, annotations, score, synthèse) puis création (questionnaire, variantes par camp) | audit de bout en bout sur les 3 types |
| 4 | Raader — conversationnel | chat + 3-4 calculateurs golden-testés (licenciement, pension/arriérés, prescription) + widgets + générations simples | |
| 5 | Pleiter MVP | ingestion en masse → chronologie → bordereau, puis vices/prescription, puis écritures | |
| 6 | Normer | Front Door + reporting, puis options : Contrats → Vie sociale → Compliance → Contentieux → M&A → Actifs | |

À chaque jalon : proposition d'architecture détaillée du jalon **avant** implémentation
(méthode de travail du brief §0.4).

---

## 4. Suggestions au-delà du brief (à retenir ou écarter)

1. **Mode preuve** : chaque affirmation juridique de l'IA porte ses sources cliquables
   (Légifrance via l'API PISTE, articles datés — le droit change) et un niveau de confiance.
   Différenciateur majeur de crédibilité.
2. **Telemetry du routeur** : journaliser les intentions mal classées et les types de
   documents non reconnus → backlog automatique d'amélioration des référentiels.
3. **Org de démo seedée** : une organisation fictive avec documents réalistes par bloc —
   sert aux démos commerciales ET aux tests E2E.
4. **Versionnement applicatif des référentiels et barèmes** : la version utilisée est
   enregistrée dans chaque audit/calcul → un audit ancien reste explicable même après
   mise à jour du référentiel (exigence implicite du « rejouable à date », étendue aux audits).
5. **Confiance progressive du Front Door** (bloc 4) : seuil de validation débrayable par
   typologie de demande, avec stats de fiabilité affichées — plutôt qu'un interrupteur global.
6. **Garde-fou « conseil individualisé »** : classifieur dédié qui détecte quand la demande
   bascule de l'information juridique vers le conseil réglementé → bandeau + orientation
   systématique (protection juridique du produit lui-même).
