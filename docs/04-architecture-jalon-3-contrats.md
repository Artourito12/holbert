# Jalon 3 — Moteur Contrats (Raader) : architecture

> Implémenté à la suite (validation groupée des jalons 2-3-4 décidée par Arthur
> le 11/06/2026 — il testera la structure complète d'un bloc).

## 1. Workflow AUDIT

```
Document "ready" d'un type contrat (bail-commercial, prestation-services, cgv)
  → bouton "Auditer" (fiche document)
  → contextualisation : RÔLE (selon referentiel.roles) + OBJECTIF (signer / renégocier / sortir)
  → api/contrats/audit.js : texte intégral + référentiel → Claude (Fable) → findings structurés
  → page /audits/:id : score de risque (jauge), synthèse exécutive,
    vue côte à côte findings ↔ texte du document avec passages surlignés
```

Catégories de findings (alignées brief §4.1) : `manquante` (vs clauses_attendues
du référentiel), `illegale` (clauses_pieges, avec fondement), `defavorable`
(au camp de l'utilisateur, avec gravité), `incoherence` (montants, dates,
renvois). Chaque finding : passage cité, explication pédagogique, fondement
juridique, **reformulation proposée**. Score 0-100 + résumé d'une page.

La version du référentiel est figée dans l'audit (rejouabilité). Tout est
journalisé dans audit_log.

## 2. Workflow CRÉATION

```
/contrats/nouveau : type → camp/rôle + variante (protectrice A / équilibrée / protectrice B)
  → questionnaire issu du référentiel (questions du rôle + faits requis),
    chaque question avec son "pourquoi"
  → api/contrats/generer.js : Claude (Fable) rédige le contrat complet
  → résultat : aperçu + téléchargement DOCX (lib `docx`) + sauvegarde
```

Les templates propres à l'organisation (socle 2.5) viendront avec Normer ;
v1 = modèles plateforme générés par référentiel.

## 3. Données (migration 004)

```
audits(id, org_id, document_id, role, objectif, referentiel_id,
       referentiel_version, statut: running|done|error, erreur,
       score, synthese, created_by, created_at)
audit_findings(id, audit_id, org_id, categorie, titre, passage, gravite,
               fondement, explication, reformulation, ordre)
generated_documents(id, org_id, type, role, variante, titre, reponses jsonb,
                    contenu, created_by, created_at)
```

RLS : membres de l'org uniquement (comme le socle, pas d'accès super admin).
Écritures de contenu via service role.

## 4. UI et intégrations

- **Page Raader** (`/raader`) : hub du module — Auditer un contrat / Créer un
  contrat / derniers audits.
- **Fiche document** : bouton Auditer (modal rôle + objectif) + historique des
  audits du document.
- **`/audits/:id`** : jauge de score (nouveau composant `ScoreGauge` ajouté à
  @holbert/ui — n'existait pas dans Heldert, créé dans son style, cf. doc 01
  §4.2), synthèse, findings groupés par catégorie avec sévérités
  (error/warning/info), clic → surlignage du passage dans le texte.
- **Chat** : l'intention `audit` n'est plus « à venir » — elle oriente vers le
  workflow (création d'audit directe depuis le chat à un jalon ultérieur).
- Routes gardées par `hasModule("raader")`.

## 5. Reporté volontairement (compétences avancées §4.3 du brief)

Redline/comparateur de versions, assistant de négociation, audit de
portefeuille en masse, veille de conformité, suivi des obligations → après
les MVP des trois modules.
