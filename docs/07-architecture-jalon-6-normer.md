# Jalon 6 — Normer MVP (Front Door + reporting) : architecture

## 1. Principe (brief §6.1)

Toutes les demandes des opérationnels entrent par un **formulaire intelligent**
(ou le chat) → **qualification automatique** (catégorie, priorité, réponse
proposée en s'appuyant sur la base de réponses types ET la base documentaire)
→ **validation par un juriste** (workflow humain, débrayage plus tard, une
fois la confiance acquise) → la réponse validée part au demandeur et
**enrichit la base de réponses types**. Le **reporting d'activité** est le
tableau de bord que la DJ montre à sa direction générale.

## 2. Données (migration 006)

```
demandes(id, org_id, created_by, objet, description,
         categorie, priorite: basse|normale|haute|critique,
         statut: nouvelle|a_valider|repondue|cloturee,
         reponse_ia, reponse_finale, validee_par, validee_at, created_at)
reponses_types(id, org_id, question, reponse, categorie,
               valide_par, usage_count, created_at)
```

Rôles v1 : les `owner`/`admin` de l'org sont les juristes (valident) ; les
`member` sont les opérationnels (déposent). RLS membres org ; la validation
passe par l'API (audit + notification + enrichissement atomiques).

## 3. API

- `api/normer/qualifier` : Claude qualifie la demande (catégorie, priorité)
  et propose une réponse en citant : 1) les réponses types existantes de
  l'org, 2) la recherche sémantique dans la base documentaire. Statut →
  `a_valider`.
- `api/normer/valider` : réservé aux juristes — réponse finale (éditée ou
  non), notification in-app au demandeur, option « enrichir la base de
  réponses types », statut → `repondue`. Tout est tracé dans l'audit log.

## 4. UI

- `/normer` : trois onglets — **Demandes** (file de traitement, badges
  statut/priorité), **Réponses types** (la mémoire de la DJ), **Reporting**
  (volumes, répartition par statut/catégorie, délai moyen de réponse).
- `/demandes/nouvelle` : formulaire opérationnel (objet + description), la
  qualification part automatiquement.
- `/demandes/:id` : vue de traitement — réponse proposée éditable, bouton
  « Valider et répondre » + case « ajouter aux réponses types ».

## 5. Légifrance (décision du 11/06/2026)

- Sans clé : citations d'articles → liens automatiques vers la recherche
  legifrance.gouv.fr (fait, dans tout rendu de texte).
- Avec compte PISTE (`LEGIFRANCE_CLIENT_ID/SECRET`) : client OAuth prêt
  (`api/_lib/legifrance.js`) — servira au mode preuve (vérification des
  articles cités) et à la veille réglementaire de Normer.

## 6. Reporté (options Normer, brief §6.2-6.8)

Contrats d'entreprise (réutilise Raader), vie sociale/entity management,
compliance Sapin II/RGPD, contentieux DJ (réutilise Pleiter), M&A, actifs —
chaque option = une itération sur ce socle, activée via `entitlements.options`.
