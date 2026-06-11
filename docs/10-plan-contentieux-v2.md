# Plan de travail — Contentieux v2 + décisions du 12/06/2026

> Décisions d'Arthur : le chat devient l'écran d'accueil (dashboard retiré),
> la page Documents générique sort de la navigation (les documents pertinents
> vivront classés dans les modules), l'IA doit être à l'aise en droit des
> affaires internationales (arbitrage, DIP, règles matérielles, common law,
> contrats en anglais). Le module Contentieux devient un suivi de dossier
> de A à Z piloté par Hofraad.

## Phase 0 — immédiat (ce tour)

- [x] Chat = page d'accueil (`/`), dashboard et Documents retirés de la
  navigation (routes conservées : les fiches documents restent accessibles
  par lien).
- [x] Compétence internationale injectée dans tous les prompts (chat,
  segmentation, recherche approfondie, classification multilingue) :
  arbitrage (clause compromissoire, règles matérielles, lex mercatoria,
  Convention de New York 1958), DIP (règles de conflit, Rome I/II, for),
  common law (consideration, reps & warranties, indemnities — lecture en VO,
  réponse en français avec citations originales).
- [x] Test de sanité : vérifier sur l'API que l'IA traite correctement une
  question d'arbitrage/règle matérielle.

## Phase 1 — Pièces v2 (le socle du dossier)

- Migration : `pieces` enrichie — `camp` (nous | adverse | procedure),
  `titre_propose` (par l'IA), `date_piece` (extraite ou saisie),
  numérotation par camp (nos pièces = bordereau officiel ; pièces adverses
  numérotées à part, préfixées).
- Flux d'ajout : l'utilisateur dépose en vrac et choisit UNIQUEMENT le camp
  (nos pièces / pièces adverses / actes de procédure — assignations,
  conclusions, ordonnances). L'IA : classe la nature, propose un intitulé
  de bordereau propre (« Pièce n° X — Intitulé (date) »), extrait la date.
- **Date introuvable → demande explicite à l'utilisateur** (champ bloquant
  doux : la pièce reste « à dater » tant que rien n'est fourni).
- Chronologie alimentée automatiquement (événements datés sourcés par
  pièce, comme aujourd'hui, plus la date de la pièce elle-même).
- Détection de doublons (hash) signalée. Ajout possible à tout moment.

## Phase 2 — Scan du dossier (l'audit complet du cas)

- L'utilisateur explique le cas (contexte libre : qui nous sommes, ce qu'on
  veut, où on en est) → l'IA indexe toutes les pièces puis produit, en
  asynchrone (infra des recherches approfondies : chaîne, progression,
  quitter/revenir) :
  1. compréhension du litige et des positions des deux parties ;
  2. **stratégie séquencée** (amiable ? médiation obligatoire si clause ?
     mise en demeure ? assignation ?) avec les DÉLAIS de chaque action ;
  3. vices de procédure et arguments : dans les deux sens — opportunités
     contre la partie adverse ET risques sur nos propres actes ;
  4. forces/faiblesses appuyées sur les pièces (visées) et la jurisprudence
     (Judilibre) ;
- La synthèse est conservée comme document du dossier, re-scannable quand
  de nouvelles pièces arrivent (delta).

## Phase 3 — Hofraad dans le dossier

- Conversations rattachées au dossier : le chat reçoit en contexte le scan,
  le bordereau, la chronologie et les pièces pertinentes (RAG ciblé dossier).
- Production d'actes à la demande (mise en demeure, trame d'assignation,
  conclusions, sommation…) stockés dans les documents du dossier.
- Conseil « prochaine étape » avec délais → échéancier central (alertes).
- Toujours sourcé (Légifrance, Judilibre, pièces visées).

## Phase 4 — Finitions

- Export bordereau au nouveau format d'intitulés ; délais procéduraux →
  alertes multi-niveaux ; statut communiquée/à communiquer par pièce.

## Hors périmètre immédiat (notés)

- Conflits d'intérêts cabinet (base clients), facturation/temps passé,
  portail client — itérations ultérieures du module.
