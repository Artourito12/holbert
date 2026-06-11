import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structuredDeep } from "../_lib/claude.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { piece_id } = req.body ?? {};
  if (!piece_id) return res.status(400).json({ error: "piece_id manquant" });

  const { data: piece } = await admin
    .from("pieces")
    .select("*, documents(id, nom_fichier, texte, statut)")
    .eq("id", piece_id)
    .maybeSingle();
  if (!piece) return res.status(404).json({ error: "Pièce introuvable" });

  const auth = await requireOrgMember(req, res, piece.org_id);
  if (!auth) return;

  const { data: ent } = await admin
    .from("entitlements")
    .select("active")
    .eq("org_id", piece.org_id)
    .eq("module", "pleiter")
    .maybeSingle();
  if (!ent?.active) {
    return res.status(403).json({ error: "Le module Pleiter n'est pas activé pour votre organisation" });
  }

  const texte = piece.documents?.texte;
  if (!texte) {
    return res.status(409).json({
      error: "Le texte de la pièce n'est pas encore extrait — attendez la fin du traitement du document.",
    });
  }

  try {
    const extraction = await structuredDeep({
      thinkingBudget: 2500,
      maxTokens: 10000,
      system:
        "Vous construisez la chronologie d'un dossier contentieux français à partir d'une pièce. " +
        "Vous extrayez TOUS les événements datés pertinents pour le litige (faits, paiements, courriers, " +
        "mises en demeure, actes de procédure, signatures, incidents). Règles :\n" +
        "- Un événement = une date précise (AAAA-MM-JJ ; si seul le mois est connu, prenez le 1er du mois " +
        "et signalez-le dans la description).\n" +
        "- Chaque événement cite le court passage exact de la pièce qui le mentionne.\n" +
        "- Titre factuel et neutre (pas d'interprétation juridique à ce stade).\n" +
        "- N'inventez aucune date.",
      prompt:
        `Pièce n° ${piece.numero} — ${piece.intitule}\n\n` +
        `Contenu :\n---\n${texte.slice(0, 80000)}\n---`,
      toolName: "extraire_evenements",
      description: "Extrait les événements datés de la pièce",
      schema: {
        type: "object",
        properties: {
          evenements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "AAAA-MM-JJ" },
                titre: { type: "string" },
                description: { type: "string" },
                passage_source: { type: "string" },
              },
              required: ["date", "titre"],
            },
          },
        },
        required: ["evenements"],
      },
    });

    const valides = (extraction.evenements ?? []).filter((e) =>
      /^\d{4}-\d{2}-\d{2}$/.test(e.date)
    );

    // Remplace les événements IA précédents de cette pièce (relançable)
    await admin.from("evenements").delete().eq("piece_id", piece.id).eq("origine", "ia");
    if (valides.length) {
      const { error } = await admin.from("evenements").insert(
        valides.map((e) => ({
          dossier_id: piece.dossier_id,
          org_id: piece.org_id,
          date: e.date,
          titre: e.titre,
          description: e.description ?? null,
          piece_id: piece.id,
          source_passage: e.passage_source ?? null,
          origine: "ia",
          created_by: auth.user.id,
        }))
      );
      if (error) throw new Error(error.message);
    }

    await logAudit(piece.org_id, auth.user.id, "dossier.evenements_extraits", "piece", piece.id, {
      dossier_id: piece.dossier_id,
      evenements: valides.length,
    });

    return res.status(200).json({ evenements: valides.length });
  } catch (e) {
    console.error("[Holbert API] extraire-evenements:", e);
    return res.status(500).json({ error: `Extraction échouée : ${e.message}` });
  }
}
