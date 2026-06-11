# Jalon 2 — Socle documentaire : architecture détaillée

> Statut : **proposition soumise à validation** avant implémentation.
> Périmètre (cf. doc 02, §3) : moteur documentaire à deux étages, 3 référentiels,
> base documentaire + recherche sémantique, échéancier, routeur d'intention v1.

---

## 1. Vue d'ensemble du pipeline

```
Upload (vrac autorisé)
  │  front → Supabase Storage (bucket privé "documents", chemin {org_id}/{doc_id}/{fichier})
  ▼
api/documents/process          statut : uploaded → processing
  │  extraction de texte : PDF (unpdf) · DOCX (mammoth) · TXT/EML
  ▼
ÉTAGE 1 — Identification       statut : classified
  │  Claude Haiku + registre des types (issu des référentiels YAML)
  │  → { type, confiance, indices } ; doublon détecté par hash SHA-256
  │  ⚠ CONFIRMATION UTILISATEUR systématique ("J'ai identifié un bail
  │     commercial — c'est bien ça ?") avant l'étage 2
  ▼
ÉTAGE 2 — Extraction           statut : extracting → ready
  │  référentiel YAML du type (ou _generique) → Claude extrait les
  │  données structurées (parties, dates, montants, obligations)
  │  → extracted_facts (chaque fait pointe vers son passage source)
  │  → les dates alimentent deadlines (échéancier central)
  ▼
Indexation sémantique
     chunks ~800 tokens (overlap 15 %) → embeddings OpenAI
     text-embedding-3-small → document_chunks (pgvector)
```

Tout échec = statut `error` + raison lisible ; relançable. Chaque étape écrit
dans `audit_log`. La version du référentiel utilisée est enregistrée avec
l'extraction (rejouabilité, cf. suggestion n°4 validée).

## 2. Référentiels (cœur extensible sans code)

- `referentiels/_generique.yaml` (fallback) + `bail-commercial.yaml`,
  `prestation-services.yaml`, `cgv.yaml`.
- Schéma zod dans `packages/core/src/referentiels/schema.ts` ; les YAML sont
  validés en CI (script `npm run check:referentiels`) ET au chargement.
- Structure (extrait) :

```yaml
meta: { id: bail-commercial, version: 1, nom: "Bail commercial", famille: baux }
identification:
  indices: ["bail commercial", "locaux commerciaux", "L145-", "indice ILC"]
  pieges_confusion: [bail-professionnel, bail-habitation]
roles: [bailleur, preneur]
extraction:
  faits:
    - { id: parties, type: parties, requis: true }
    - { id: date_signature, type: date }
    - { id: duree_bail, type: duree }
    - { id: loyer_annuel, type: montant }
    - { id: echeance_triennale, type: date, alimente_echeancier: true, alerte: [J-180, J-90] }
clauses_attendues:    # utilisées au jalon 3 (audit) mais déjà décrites
  - { id: destination, gravite_si_absente: majeure, fondement: "art. L145-47 C. com." }
clauses_pieges: [...]
questions: { bailleur: [...], preneur: [...] }
```

## 3. Données (migration 003)

```
documents(id, org_id, nom_fichier, mime, taille, hash_sha256, storage_path,
          statut, type_detecte, type_confiance, indices jsonb,
          type_confirme, referentiel_version, version_de → documents.id,
          uploaded_by, created_at)
document_chunks(id, document_id, org_id, contenu, position, embedding vector(1536))
extracted_facts(id, document_id, org_id, fait_id, type, valeur jsonb,
                passage_source, confiance)
deadlines(id, org_id, document_id, fait_id, titre, date_echeance,
          paliers_alerte int[], statut: a_venir|traitee|ignoree, created_at)
notifications(id, org_id, user_id, titre, corps, lien, lue, created_at)
conversations(id, org_id, created_by, titre, created_at)
messages(id, conversation_id, org_id, role: user|assistant, contenu,
         intent jsonb, sources jsonb, widget jsonb, created_at)
```

- RLS identique au jalon 1 : `is_org_member(org_id)` partout, écriture
  serveur via service role, super admin = jamais d'accès au contenu (les
  policies admin ne couvrent PAS ces tables — conformité doc 02 §D5).
- Index HNSW sur `document_chunks.embedding` + RPC `match_chunks(p_org,
  p_embedding, p_count)` (security definer, filtre org AVANT le knn).
- Bucket storage `documents` privé + policies par org (upload/lecture
  membres, taille max 50 Mo, types: pdf, docx, doc, txt, eml, png, jpg).

## 4. Fonctions serverless (api/)

| Endpoint | Rôle |
|---|---|
| `api/_lib/auth.js` | vérifie le JWT Supabase, résout org + membership, refuse sinon |
| `api/_lib/claude.js`, `api/_lib/openai.js`, `api/_lib/supabase-admin.js` | clients |
| `api/documents/process.js` | pipeline complet post-upload (étapes §1) |
| `api/documents/confirm-type.js` | l'utilisateur confirme/corrige le type → déclenche l'étage 2 |
| `api/documents/search.js` | recherche sémantique (embedding de la requête + match_chunks) |
| `api/chat/message.js` | routeur d'intention v1 + exécution (cf. §5) |
| `api/cron/deadlines.js` | quotidien : paliers atteints → notifications in-app |

Dev local : `vercel dev` (fonctions sur :3000) + proxy Vite `/api → :3000`.
Modèles : classification = Haiku (rapide, ~0,1 ct/doc) ; extraction = Fable
(qualité juridique) ; embeddings = text-embedding-3-small.

## 5. Routeur d'intention v1 + chat socle

- Page Chat (style ChatPage Heldert, colonne documents à droite) disponible
  dès qu'un module est actif — c'est l'expérience commune.
- `api/chat/message.js` : 1) classification de l'intention (tool use, schéma
  `Intent` du doc 02) ; 2) recherche systématique dans la base de l'org ;
  3) exécution selon `kind` :
  - `question` / `recherche_base` → réponse RAG sourcée (passages cités,
    document + position cliquables) — fonctionnel dès ce jalon ;
  - `audit` / `generation` / `calcul` → message honnête « disponible
    prochainement » + ce que le système a compris (et log telemetry) ;
  - `besoin_professionnel` → bandeau orientation (disclaimer systémique).
- Chaque tour : intent + sources persistés dans `messages` (telemetry des
  ratés = backlog d'amélioration, suggestion n°2 validée).

## 6. UI (apps/web)

- **Documents** (socle, sidebar) : liste (type, statut, badges), upload en
  vrac (dropzone Heldert), bannière de confirmation de type par document,
  fiche document (faits extraits + passages sources, échéances détectées).
- **Échéancier** (socle, sidebar) : liste chronologique filtrable, statuts,
  badge sidebar (nombre à J-30) ; cloche header → notifications.
- **Chat** : conversation simple v1 (texte + sources), historique par org.
- Score de complétude d'onboarding : affiché sur le Dashboard (« 3 documents
  classés, 2 échéances détectées ») — version simple, le parcours guidé
  complet vient avec les blocs.

## 7. Livrable vérifiable du jalon

Uploader en vrac un bail commercial PDF + un contrat de prestation DOCX →
les deux sont classés (confirmation demandée), leurs données extraites
visibles avec passages sources, les échéances apparaissent dans
l'échéancier, et « quelle est la durée du bail ? » dans le chat répond avec
citation du passage. Le tout cloisonné par org (test RLS étendu aux
nouvelles tables).

## 8. Prérequis et coûts

- `.env.local` : `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` (et les mêmes en
  variables d'environnement Vercel au déploiement).
- Ordre de grandeur par document de 20 pages : ~1-3 ct (classification +
  extraction + embeddings). Recherche/chat : ~0,1-1 ct par question.
