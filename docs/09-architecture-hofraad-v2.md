# Hofraad v2 — l'IA juridique au centre : architecture

> Décisions d'Arthur (11/06/2026) : **Hofraad** = nom du site ET du chat
> (domaine hofraad.com à acheter — recommandation : Vercel ou Cloudflare).
> Le chat est la pierre angulaire, accessible à toutes les organisations.
> Les ex-modules sont renommés : **Module 1 = Contentieux** (ex-Pleiter),
> **Module 2 = Compliance** (ex-Normer). L'ex-Raader est dissous DANS le chat.
> Budget recherche approfondie : viser l'excellence, ~2 € max par run.

## 1. Principes non négociables

1. **Juridique uniquement** — toute demande hors domaine est déclinée poliment.
2. **Tout est sourcé, toujours** — avec liens d'accès : Légifrance (lois,
   règlements, codes), **Judilibre** (jurisprudence Cour de cassation),
   **EUR-Lex** (directives/règlements UE, liens CELEX), passages exacts des
   documents de l'utilisateur.
3. **Le contexte avant la réponse** — l'IA s'assure de savoir : qui elle
   défend (camp), l'objectif, les pièces disponibles, le profil de
   l'organisation. Elle pose les questions manquantes, jamais plus.
4. **La profondeur s'adapte** — mode automatique : un routeur évalue la
   complexité et choisit le budget de réflexion. L'utilisateur peut forcer
   « Recherche approfondie ».
5. **Public : professionnels du droit** — ton confraternel, précision,
   le raisonnement est montré (démarche, sources consultées, limites).

## 2. Modèles (décision coût/qualité)

| Usage | Modèle | Réflexion |
|---|---|---|
| Routage, complexité, garde-fou | Haiku 4.5 | aucune |
| Réponse simple | **Opus 4.8** | minimale |
| Réponse moyenne | **Opus 4.8** | ~3k |
| Cas complexe / segmentation / synthèses de recherche | **Opus 4.8** | 8-16k |
| Extraction, audits, analyses (existant) | **Opus 4.8** (remplace Fable 5) | inchangé |

## 3. Pipeline du chat Hofraad

```
Message (± documents joints, OCR vision en secours)
  → Haiku : { domaine_juridique?, complexite: simple|moyenne|complexe,
              contexte_manquant[], competence (calcul/contrat/audit/…) }
  ├─ hors domaine → refus poli
  ├─ contexte manquant critique → questions de clarification d'abord
  ├─ simple   → Opus réponse directe sourcée (+ widget si pertinent)
  ├─ moyenne  → Opus + réflexion + RAG + vérif Légifrance
  └─ complexe (ou bouton Recherche approfondie)
        → SEGMENTATION : l'IA reformule le cas en questions juridiques
          distinctes → widget « encarts éditables » → l'utilisateur corrige
          et VALIDE
        → RECHERCHE APPROFONDIE (asynchrone, voir §4)
```

Compétences intégrées au chat (ex-Raader dissous) :
- **calcul** → widget calculatrice (fait) + widgets dynamiques (§6) ;
- **création de contrat** → l'IA mène le questionnaire DANS la conversation
  (référentiel + questions au fil de l'eau), génère, restitue + DOCX ;
- **audit** → l'IA exige le camp et l'objectif, lance l'audit, restitue la
  synthèse dans le chat + lien vers le **document stabiloté** (§5).

## 4. Recherche approfondie (asynchrone, reprenable)

- Table `recherches` : statut, étapes (jsonb avec progression), questions
  validées, sections produites, document final. **L'utilisateur peut quitter
  et revenir** : barre de progression par étapes, résultat conservé dans la
  conversation.
- Contrainte Vercel (60 s/fonction) → **chaîne de fonctions** : chaque étape
  est un appel court qui enregistre son résultat puis déclenche le suivant
  (auto-invocation authentifiée par secret interne). Étapes :
  1. Pour chaque question validée : recherches parallèles — base documentaire
     de l'org (RAG), Légifrance (textes), Judilibre (jurisprudence),
     EUR-Lex si dimension UE — sources collectées avec liens ;
  2. Rédaction d'une section argumentée par question (Opus, réflexion haute) ;
  3. Assemblage : document de synthèse structuré (exposé, analyse par
     question, conclusion opérationnelle, table des sources), exportable DOCX.
- « Démarche suivie » jointe au document : requêtes effectuées, sources
  retenues/écartées, points non tranchés.
- Coût estimé par run : 0,5-2 € selon nombre de questions. Plafond configurable.

## 5. Audit dans le chat : stabilotage + notes en marge

- L'audit reste le moteur existant (référentiel, camp, gravités), mais :
  - restitution conversationnelle (synthèse dans le chat) ;
  - **vue document annotée** : texte de l'utilisateur avec surlignage par
    gravité (« stabilotage ») et **notes en marge** : reformulation proposée,
    explication du désaccord, fondement — ancrées au passage exact ;
  - les notes sont consultables sur le document ET résumées dans le chat.
- Évolution de l'actuelle vue audit (passages surlignés déjà en place) vers
  une vraie marge interactive.

## 6. Widgets dynamiques

Au-delà du catalogue fixe : l'IA peut émettre une **spécification de
calculateur ad hoc** `{ titre, champs (sliders/nombres/dates/selects),
formules (expressions évaluées par un mini-évaluateur SÛR côté client — pas
d'eval), resultats, sources, avertissements }`. Tout widget affiche ses
sources et sa date de validité. Le catalogue golden-testé reste prioritaire
quand il couvre le besoin ; le dynamique couvre la longue traîne.

## 7. Intégrations sources

- **Légifrance** (fait) : vérification des articles cités + liens.
- **Judilibre** (souscrit, à brancher) : recherche plein texte des arrêts,
  liens officiels, méta (chambre, date, solution) — même token PISTE.
- **EUR-Lex** : constructeur de liens CELEX déterministe + vérification
  d'existence ; recherche réelle quand la dimension UE est détectée.
- **OCR** : si l'extraction texte échoue (scan), envoi du PDF à la vision
  Claude pour transcription, puis pipeline normal.

## 8. Renommages et accès

- `PLATFORM_NAME = "Hofraad"` (toujours centralisé — domaine hofraad.com).
- Chat **ouvert à toutes les organisations** (plus d'entitlement « raader » ;
  les vérifications correspondantes sont retirées des API).
- Entitlements restants : `pleiter` → « **Module 1 — Contentieux** »,
  `normer` → « **Module 2 — Compliance** » (ids techniques inchangés en base).
- Les pages calculateurs/contrats/courriers deviennent des **raccourcis
  « Outils »** vers les mêmes moteurs que le chat.

## 9. Phasage

| Phase | Contenu | Statut |
|---|---|---|
| A | Rebranding Hofraad, modules 1/2, chat ouvert à tous, bascule Opus 4.8, garde-fou juridique, routeur de complexité avec profondeur adaptative | ce jalon |
| B | Segmentation + encarts validables + recherche approfondie asynchrone (chaîne de fonctions, progression, reprise), Judilibre + EUR-Lex | suivant |
| C | Création de contrat conversationnelle + audit conversationnel avec stabilotage/notes en marge | suivant |
| D | Widgets dynamiques + OCR vision | suivant |
| E | Domaine hofraad.com (achat par Arthur), bascule APP_URL/EMAIL_FROM/Resend | quand acheté |
