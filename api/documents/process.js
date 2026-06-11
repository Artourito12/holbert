import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, MODEL_FAST } from "../_lib/claude.js";
import { embed } from "../_lib/openai.js";
import { extraireTexteAvecOcr, chunker } from "../_lib/extract-text.js";
import { typesPourClassification } from "../_lib/referentiels.js";

async function echec(doc, raison) {
  await admin
    .from("documents")
    .update({ statut: "error", erreur: raison })
    .eq("id", doc.id);
  return { error: raison };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { document_id } = req.body ?? {};
  if (!document_id) return res.status(400).json({ error: "document_id manquant" });

  const { data: doc } = await admin
    .from("documents")
    .select("*")
    .eq("id", document_id)
    .maybeSingle();
  if (!doc) return res.status(404).json({ error: "Document introuvable" });

  const auth = await requireOrgMember(req, res, doc.org_id);
  if (!auth) return;

  await admin.from("documents").update({ statut: "processing", erreur: null }).eq("id", doc.id);

  try {
    // ---- 1. Téléchargement + extraction du texte ---------------------------
    const { data: blob, error: dlError } = await admin.storage
      .from("documents")
      .download(doc.storage_path);
    if (dlError) return res.status(500).json(await echec(doc, `Fichier inaccessible : ${dlError.message}`));

    const buffer = Buffer.from(await blob.arrayBuffer());
    const { texte, ocr } = await extraireTexteAvecOcr(buffer, doc.mime);

    if (!texte || texte.length < 40) {
      return res.status(422).json(
        await echec(doc, "Texte illisible, même après OCR — vérifiez la qualité du scan et réessayez.")
      );
    }

    // ---- 2. Doublons / versions (hash exact) --------------------------------
    let versionDe = null;
    if (doc.hash_sha256) {
      const { data: doublon } = await admin
        .from("documents")
        .select("id, nom_fichier")
        .eq("org_id", doc.org_id)
        .eq("hash_sha256", doc.hash_sha256)
        .neq("id", doc.id)
        .limit(1)
        .maybeSingle();
      if (doublon) versionDe = doublon.id;
    }

    // ---- 3. ÉTAGE 1 — Identification du type --------------------------------
    const types = typesPourClassification();
    const classification = await structured({
      model: MODEL_FAST,
      system:
        "Vous êtes le classificateur documentaire d'une plateforme juridique française. " +
        "Vous identifiez le type d'un document parmi un registre de types connus. " +
        "Si aucun type ne correspond vraiment, répondez type=inconnu plutôt que de forcer une correspondance.",
      prompt:
        `Registre des types connus :\n${JSON.stringify(types, null, 2)}\n\n` +
        `Document (début, max 12 000 caractères) :\n---\n${texte.slice(0, 12000)}\n---\n\n` +
        `Identifiez le type de ce document.`,
      toolName: "classifier_document",
      description: "Classe le document dans le registre des types",
      schema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [...types.map((t) => t.id), "inconnu"],
            description: "Identifiant du type, ou 'inconnu'",
          },
          confiance: { type: "number", minimum: 0, maximum: 1 },
          indices: {
            type: "array",
            items: { type: "string" },
            description: "2 à 4 éléments du document qui justifient cette classification",
          },
        },
        required: ["type", "confiance", "indices"],
      },
      maxTokens: 600,
    });

    // ---- 4. Indexation sémantique (indépendante du type) --------------------
    await admin.from("document_chunks").delete().eq("document_id", doc.id);
    const chunks = chunker(texte);
    const embeddings = await embed(chunks);
    const { error: chunkError } = await admin.from("document_chunks").insert(
      chunks.map((contenu, i) => ({
        document_id: doc.id,
        org_id: doc.org_id,
        contenu,
        position: i,
        embedding: embeddings[i],
      }))
    );
    if (chunkError) return res.status(500).json(await echec(doc, `Indexation échouée : ${chunkError.message}`));

    // ---- 5. Statut : classified — en attente de confirmation utilisateur ----
    const { data: updated } = await admin
      .from("documents")
      .update({
        statut: "classified",
        type_detecte: classification.type,
        type_confiance: classification.confiance,
        indices: classification.indices,
        version_de: versionDe,
        texte,
      })
      .eq("id", doc.id)
      .select()
      .single();

    await logAudit(doc.org_id, auth.user.id, "document.processed", "document", doc.id, {
      type_detecte: classification.type,
      confiance: classification.confiance,
      chunks: chunks.length,
      doublon_de: versionDe,
      ocr,
    });

    return res.status(200).json({ document: updated });
  } catch (e) {
    console.error("[Holbert API] process:", e);
    return res.status(500).json(await echec(doc, `Erreur de traitement : ${e.message}`));
  }
}
