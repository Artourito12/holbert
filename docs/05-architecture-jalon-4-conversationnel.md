# Jalon 4 — Raader conversationnel : architecture

## 1. Moteur de calcul (packages/core/src/calculs)

Fonctions **pures**, paramétrées par des barèmes-données datés — jamais de
chiffre en dur dans le code. Chaque calcul retourne :

```ts
type ResultatCalcul = {
  resultat: { libelle: string; valeur: number | string; unite?: string }[];
  etapes: { libelle: string; formule: string; valeur: string }[];  // détail rejouable
  sources: { libelle: string; reference: string }[];               // textes + barèmes utilisés
  avertissements: string[];                                        // limites de la simulation
};
```

Trois compétences au lancement :
- **Indemnité légale de licenciement** (art. R. 1234-2 c. trav.) — barème à
  deux périodes (avant/après le 27/09/2017) → rejouable à date. Les
  majorations conventionnelles (CC) viendront enrichir les barèmes.
- **Pension alimentaire : revalorisation et arriérés** — indexation année
  par année sur l'IPC (série INSEE hors tabac), arriérés = Σ (dû revalorisé
  − payé) sur la période, bornée par la prescription (5 ans).
- **Prescription** — catalogue de délais (droit commun 5 ans, conso 2 ans,
  salaires 3 ans, loyers 3 ans, corporel 10 ans, immobilier 30 ans…) avec
  **causes d'interruption** (assignation, reconnaissance, exécution forcée —
  le délai repart) et **suspension** (médiation — le délai est mis en pause).

## 2. Barèmes (baremes/*.json)

Données versionnées et datées (`effective_from`/`effective_to`), validées et
compilées par `scripts/build-baremes.mjs` → `packages/core/src/baremes.generated.ts`.
⚠️ Les valeurs d'indices (IPC) embarquées au jalon 4 sont à re-vérifier sur
insee.fr avant toute mise en production — le mécanisme, lui, est verrouillé
par les tests.

## 3. Tests golden (vitest)

`packages/core/src/calculs/__tests__/` : cas de référence calculés à la main
qui verrouillent chaque calculateur. `npm test` en CI et avant chaque commit
touchant calculs/ ou baremes/.

## 4. Widgets interactifs dans le chat

Contrat typé `Widget` (core) émis par l'API chat, rendu nativement par le
front (pas d'iframe) :
- intention `calcul` → le routeur identifie la compétence + pré-remplit les
  paramètres détectés dans la question → message assistant avec
  `widget: { type: "calculatrice", competence, params }`.
- Le composant `CalculatriceWidget` (sliders + champs) recalcule en temps
  réel **côté client** avec les fonctions de core — détail des étapes et
  sources affichés, conformément au principe de pédagogie.
- Les calculateurs sont aussi accessibles hors chat : `/calculateurs` (hub
  Raader), même composant.

## 5. Générations simples (courriers)

Catalogue de courriers (mise en demeure de payer, résiliation de bail par le
locataire, résiliation d'assurance, demande de restitution de dépôt de
garantie) : champs requis par type, génération Claude, stockage dans
`generated_documents`, export DOCX. Page `/courriers/nouveau` + carte sur le
hub Raader. L'intention `generation` du chat oriente vers ce parcours.

## 6. Hors périmètre de ce jalon

Les autres calculateurs du brief §3.2 (rupture conventionnelle, quotités
saisissables, succession, EU261…) suivent le même moteur et s'ajoutent par
barèmes + config. Conventions collectives, OCR, emails Resend : jalons
suivants.
