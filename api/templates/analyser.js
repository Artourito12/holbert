import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structuredDeep } from "../_lib/claude.js";
import { extraireTexteAvecOcr } from "../_lib/extract-text.js";

async function echec(id, raison) {
  await admin.from("actes_templates").update({ statut: "error", erreur: raison }).eq("id", id);
  return { error: raison };
}

/**
 * Analyse en profondeur d'un modèle d'acte déposé par l'utilisateur :
 * l'IA en extrait la structure, l'en-tête (cabinet, logo, mentions), les
 * champs variables et le style, pour pouvoir l'imiter à la génération.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { template_id } = req.body ?? {};
  if (!template_id) return res.status(400).json({ error: "template_id manquant" });

  const { data: tpl } = await admin
    .from("actes_templates")
    .select("*")
    .eq("id", template_id)
    .maybeSingle();
  if (!tpl) return res.status(404).json({ error: "Modèle introuvable" });

  const auth = await requireOrgMember(req, res, tpl.org_id);
  if (!auth) return;

  await admin.from("actes_templates").update({ statut: "processing", erreur: null }).eq("id", tpl.id);

  try {
    const { data: blob, error: dlError } = await admin.storage
      .from("documents")
      .download(tpl.storage_path);
    if (dlError) return res.status(500).json(await echec(tpl.id, `Fichier inaccessible : ${dlError.message}`));

    const buffer = Buffer.from(await blob.arrayBuffer());
    const { texte } = await extraireTexteAvecOcr(buffer, tpl.mime);
    if (!texte || texte.length < 80) {
      return res.status(422).json(await echec(tpl.id, "Texte illisible, même après OCR."));
    }

    const analyse = await structuredDeep({
      system:
        "Vous analysez un MODÈLE d'acte juridique fourni par un cabinet pour pouvoir le reproduire " +
        "fidèlement plus tard sur d'autres dossiers. Soyez exhaustif : tout ce qui fait l'identité du " +
        "document (en-tête du cabinet, mentions, formules d'usage, numérotation, ton) doit être capturé. " +
        "Distinguez ce qui est FIXE (identité du cabinet, formules, structure) de ce qui est VARIABLE " +
        "(parties, faits, dates, montants, fondements propres au dossier d'origine).",
      prompt:
        `Nom du fichier : ${tpl.nom_fichier}\n\n` +
        `Contenu du modèle :\n---\n${texte.slice(0, 40000)}\n---\n\n` +
        `Analysez ce modèle pour pouvoir le reproduire sur d'autres dossiers.`,
      toolName: "analyser_modele",
      description: "Capture la structure réutilisable du modèle",
      schema: {
        type: "object",
        properties: {
          type_acte: {
            type: "string",
            description:
              "Nature de l'acte en un mot-clé : assignation, conclusions, mise_en_demeure, courrier, " +
              "contrat, requete, sommation, attestation, bordereau, autre",
          },
          description: { type: "string", description: "Une phrase : ce qu'est ce modèle et quand l'utiliser" },
          en_tete: {
            type: "string",
            description:
              "Reproduction TEXTUELLE complète de l'en-tête : nom du cabinet, logo (décrire), adresse, " +
              "coordonnées, barreau, mentions — tel qu'il doit réapparaître sur chaque acte",
          },
          structure: {
            type: "array",
            items: {
              type: "object",
              properties: {
                section: { type: "string" },
                role: { type: "string", description: "Ce que contient cette section et son rôle juridique" },
                adaptable: {
                  type: "boolean",
                  description: "true si la section doit être réécrite selon le dossier, false si quasi fixe",
                },
              },
              required: ["section", "role", "adaptable"],
            },
          },
          champs_variables: {
            type: "array",
            items: { type: "string" },
            description: "Données propres au dossier à remplacer : parties, dates, montants, juridiction…",
          },
          style: {
            type: "string",
            description:
              "Ton, formules d'usage, numérotation (romaine/arabe), mise en forme (gras, majuscules), " +
              "longueur des développements — tout ce qui fait la patte du rédacteur",
          },
          pied_de_page: { type: "string", description: "Mentions de pied de page s'il y en a" },
        },
        required: ["type_acte", "description", "en_tete", "structure", "champs_variables", "style"],
      },
      thinkingBudget: 4000,
      maxTokens: 8000,
    });

    const { data: updated } = await admin
      .from("actes_templates")
      .update({
        statut: "ready",
        type_acte: analyse.type_acte,
        description: analyse.description,
        texte,
        analyse,
      })
      .eq("id", tpl.id)
      .select()
      .single();

    await logAudit(tpl.org_id, auth.user.id, "template.analyse", "acte_template", tpl.id, {
      type_acte: analyse.type_acte,
    });

    return res.status(200).json({ template: updated });
  } catch (e) {
    console.error("[Holbert API] template analyser:", e);
    return res.status(500).json(await echec(tpl.id, `Analyse échouée : ${e.message}`));
  }
}
