import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, MODEL_SMART } from "../_lib/claude.js";
import { extraireTexte } from "../_lib/extract-text.js";
import { getReferentiel, REFERENTIELS } from "../_lib/referentiels.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { document_id, type } = req.body ?? {};
  if (!document_id || !type) return res.status(400).json({ error: "document_id et type requis" });
  if (type !== "generique" && !REFERENTIELS[type]) {
    return res.status(400).json({ error: `Type inconnu : ${type}` });
  }

  const { data: doc } = await admin
    .from("documents")
    .select("*")
    .eq("id", document_id)
    .maybeSingle();
  if (!doc) return res.status(404).json({ error: "Document introuvable" });

  const auth = await requireOrgMember(req, res, doc.org_id);
  if (!auth) return;

  const ref = getReferentiel(type);
  await admin
    .from("documents")
    .update({ statut: "extracting", type_confirme: type, referentiel_version: ref.meta.version })
    .eq("id", doc.id);

  try {
    // ---- ÉTAGE 2 — extraction structurée pilotée par le référentiel ---------
    const { data: blob, error: dlError } = await admin.storage
      .from("documents")
      .download(doc.storage_path);
    if (dlError) throw new Error(`Fichier inaccessible : ${dlError.message}`);
    const { texte } = await extraireTexte(Buffer.from(await blob.arrayBuffer()), doc.mime);

    const faitsAttendus = ref.extraction.faits.map((f) => ({
      fait_id: f.id,
      type: f.type,
      libelle: f.libelle,
      requis: f.requis,
    }));

    const extraction = await structured({
      model: MODEL_SMART,
      system:
        "Vous êtes l'extracteur documentaire d'une plateforme juridique française. " +
        "Vous extrayez des données structurées d'un document, fait par fait, en citant " +
        "pour chaque fait le court passage exact du document qui le justifie. " +
        "N'inventez JAMAIS : si un fait est absent du document, omettez-le. " +
        "Dates au format ISO (AAAA-MM-JJ). Montants en nombre (euros, sans symbole).",
      prompt:
        `Type de document : ${ref.meta.nom}\n\n` +
        `Faits à extraire :\n${JSON.stringify(faitsAttendus, null, 2)}\n\n` +
        `Document :\n---\n${texte.slice(0, 90000)}\n---`,
      toolName: "extraire_faits",
      description: "Extrait les faits structurés du document",
      schema: {
        type: "object",
        properties: {
          faits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fait_id: { type: "string" },
                valeur_texte: { type: "string", description: "Valeur lisible du fait" },
                valeur_date: { type: "string", description: "Date ISO si le fait est une date" },
                valeur_montant: { type: "number", description: "Montant en euros si applicable" },
                items: {
                  type: "array",
                  description: "Pour les listes (dates ou montants multiples)",
                  items: {
                    type: "object",
                    properties: {
                      libelle: { type: "string" },
                      date: { type: "string" },
                      montant: { type: "number" },
                    },
                    required: ["libelle"],
                  },
                },
                passage_source: { type: "string", description: "Citation exacte et courte du document" },
                confiance: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["fait_id", "valeur_texte", "confiance"],
            },
          },
        },
        required: ["faits"],
      },
      maxTokens: 8000,
    });

    const connus = new Set(ref.extraction.faits.map((f) => f.id));
    const faits = (extraction.faits ?? []).filter((f) => connus.has(f.fait_id));

    // ---- Persistance des faits ----------------------------------------------
    await admin.from("extracted_facts").delete().eq("document_id", doc.id);
    if (faits.length) {
      await admin.from("extracted_facts").insert(
        faits.map((f) => {
          const def = ref.extraction.faits.find((d) => d.id === f.fait_id);
          return {
            document_id: doc.id,
            org_id: doc.org_id,
            fait_id: f.fait_id,
            type: def.type,
            valeur: {
              texte: f.valeur_texte,
              date: f.valeur_date ?? null,
              montant: f.valeur_montant ?? null,
              items: f.items ?? null,
            },
            passage_source: f.passage_source ?? null,
            confiance: f.confiance,
          };
        })
      );
    }

    // ---- Échéancier : dates futures des faits marqués ------------------------
    await admin.from("deadlines").delete().eq("document_id", doc.id);
    const today = new Date().toISOString().slice(0, 10);
    const deadlines = [];
    for (const f of faits) {
      const def = ref.extraction.faits.find((d) => d.id === f.fait_id);
      if (!def?.alimente_echeancier) continue;
      const paliers = def.alerte ?? [30, 7];
      const dates = [
        ...(f.valeur_date ? [{ date: f.valeur_date, libelle: def.libelle }] : []),
        ...(f.items ?? []).filter((i) => i.date).map((i) => ({ date: i.date, libelle: i.libelle })),
      ];
      for (const d of dates) {
        if (d.date > today) {
          deadlines.push({
            org_id: doc.org_id,
            document_id: doc.id,
            fait_id: f.fait_id,
            titre: `${d.libelle} — ${doc.nom_fichier}`,
            date_echeance: d.date,
            paliers_alerte: paliers,
          });
        }
      }
    }
    if (deadlines.length) await admin.from("deadlines").insert(deadlines);

    const { data: updated } = await admin
      .from("documents")
      .update({ statut: "ready" })
      .eq("id", doc.id)
      .select()
      .single();

    await logAudit(doc.org_id, auth.user.id, "document.extracted", "document", doc.id, {
      type_confirme: type,
      referentiel_version: ref.meta.version,
      faits: faits.length,
      echeances: deadlines.length,
    });

    return res.status(200).json({ document: updated, faits: faits.length, echeances: deadlines.length });
  } catch (e) {
    console.error("[Holbert API] confirm-type:", e);
    await admin
      .from("documents")
      .update({ statut: "error", erreur: `Extraction échouée : ${e.message}` })
      .eq("id", doc.id);
    return res.status(500).json({ error: `Extraction échouée : ${e.message}` });
  }
}
