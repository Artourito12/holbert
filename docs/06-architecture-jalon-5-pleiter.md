# Jalon 5 — Pleiter MVP (contentieux) : architecture

## 1. Principe

**La chronologie est la donnée pivot** (brief §5) : tout ce qui entre dans un
dossier alimente une timeline datée dont chaque événement est **sourcé vers sa
pièce**, et toutes les analyses se construisent dessus.

## 2. Données (migration 005)

```
dossiers(id, org_id, nom, parties jsonb, juridiction, type_procedure,
         enjeu_financier, statut: actif|clos, created_by, created_at)
pieces(id, dossier_id, org_id, document_id → documents, numero, intitule,
       communiquee bool)                      -- le bordereau
evenements(id, dossier_id, org_id, date, titre, description,
           piece_id → pieces, source_passage, origine: ia|manuel)
analyses_dossier(id, dossier_id, org_id, type: vices|prescription|synthese|conclusions,
                 statut, resultat jsonb, contenu text, created_by)
```

RLS membres de l'org (pas d'accès super admin). Module `pleiter` requis côté API.

## 3. Flux

1. **Dossier** : fiche (parties, juridiction, type de procédure, enjeu).
2. **Pièces en vrac** : upload → pipeline documentaire du socle (classement,
   texte, indexation) + rattachement au dossier avec **numéro de bordereau
   auto-incrémenté**.
3. **Chronologie** : `api/pleiter/extraire-evenements` lit le texte d'une
   pièce → événements datés (titre, description, passage source) insérés
   dans la timeline. Ajout/édition/suppression manuels par l'avocat
   (origine `manuel` vs `ia`).
4. **Bordereau** : liste numérotée, réordonnable, export DOCX.
5. **Analyses** (`api/pleiter/analyse`, construites SUR la chronologie) :
   - `vices` : délais et formalités de procédure suspects, par événement ;
   - `prescription` : délais applicables aux demandes, causes d'interruption/
     suspension repérées dans la chronologie (même corpus juridique que le
     calculateur du jalon 4) ;
   - `synthese` : note de préparation (forces, faiblesses, questions probables) ;
   - `conclusions` : trame d'écritures — faits tirés de la chronologie avec
     visa des pièces (n° de bordereau), discussion par moyens, dispositif.
     Export DOCX.

## 4. UI

- `/pleiter` : liste des dossiers + création.
- `/dossiers/:id` : onglets Chronologie / Pièces & bordereau / Analyses,
  style Heldert (tabs underline). La frise chronologique verticale est un
  pattern réutilisable (widget « frise » du chat aux jalons suivants).

## 5. Reporté

Conflits d'intérêts (base clients cabinet), agenda des délais procéduraux
multi-niveaux, portail client, temps passé/facturation, statistiques
Judilibre — itérations suivantes de Pleiter (brief §5.2, §5.4).
