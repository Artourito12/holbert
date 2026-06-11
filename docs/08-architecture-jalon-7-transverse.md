# Jalon 7 — Transverse : onboarding documentaire, dashboard, ponts inter-modules

## 1. Onboarding documentaire (brief §8)

Principe : l'utilisateur upload en vrac, la plateforme affiche **ce qui
manque** avec un **score de complétude** — l'onboarding démontre le produit.

- Configuration déclarative dans `packages/core/src/onboarding.ts` : pour le
  socle et chaque module, une liste d'objectifs **vérifiables automatiquement**
  (ex. « un bail commercial classé », « une chronologie extraite », « une
  réponse type capitalisée »). Chaque objectif sait se tester à partir des
  compteurs de l'organisation.
- Affichage sur le Dashboard : jauge de complétude (ScoreGauge) + checklist
  cliquable (chaque objectif manquant pointe vers l'écran qui permet de le
  remplir). La liste s'adapte aux modules activés.

## 2. Dashboard enrichi

- KPI selon modules actifs : documents classés, échéances ≤ 30 j, dossiers
  actifs (Pleiter), demandes à valider (Normer), audits réalisés (Raader).
- Carte onboarding (jauge + prochaines étapes).
- Accès rapides vers les actions clés.

## 3. Ponts inter-modules (brief §7, version pragmatique)

- **2+3** : dans un dossier Pleiter, une pièce reconnue comme contrat
  auditable affiche « Auditer » (si Raader actif) — l'audit du contrat
  litigieux se fait sans rupture.
- **1+3 / 1+4** : le routeur du chat oriente désormais vers les modules
  réellement disponibles (analyse de pièces → Pleiter, action de gestion →
  Échéancier) au lieu d'annoncer « à venir ».
- Le bus d'événements générique (`domain_events`) reste pour plus tard : les
  ponts actuels sont des liens directs, suffisants tant que tout vit dans la
  même app.

## 4. Hors périmètre

Options Normer (vie sociale, compliance…), redline/portefeuille Raader,
Judilibre/délais procéduraux Pleiter, OCR, emails Resend : itérations
suivantes, après le test global d'Arthur.
