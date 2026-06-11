import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { deepText } from "../_lib/claude.js";
import { contexteOrganisation } from "../_lib/org-context.js";

// Catalogue minimal côté serveur (miroir de packages/core/src/courriers.ts)
const COURRIERS = {
  mise_en_demeure_paiement: "Mise en demeure de payer (fait courir les intérêts, art. 1344-1 c. civ.)",
  resiliation_bail_locataire: "Congé du locataire — résiliation de bail d'habitation (art. 15 loi du 6 juillet 1989)",
  resiliation_assurance: "Résiliation d'un contrat d'assurance (lois Chatel et Hamon)",
  restitution_depot_garantie: "Demande de restitution du dépôt de garantie (art. 22 loi du 6 juillet 1989)",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { org_id, type, reponses = {} } = req.body ?? {};
  if (!org_id || !type) return res.status(400).json({ error: "org_id et type requis" });
  if (!COURRIERS[type]) return res.status(400).json({ error: `Type de courrier inconnu : ${type}` });

  const auth = await requireOrgMember(req, res, org_id);
  if (!auth) return;

  const { data: ent } = await admin
    .from("entitlements")
    .select("active")
    .eq("org_id", org_id)
    .eq("module", "raader")
    .maybeSingle();
  if (!ent?.active) {
    return res.status(403).json({ error: "Le module Raader n'est pas activé pour votre organisation" });
  }

  try {
    const profil = await contexteOrganisation(org_id);
    const contenu = await deepText({
      thinkingBudget: 2500,
      maxTokens: 7000,
      system:
        "Vous rédigez des courriers juridiques français prêts à envoyer. Règles :\n" +
        "- Forme : expéditeur, destinataire, lieu/date, objet, « Lettre recommandée avec accusé de réception » " +
        "si pertinent, corps structuré, formule de politesse, signature.\n" +
        "- Citez les fondements juridiques exacts qui donnent sa force au courrier.\n" +
        "- Mentionnez les délais et les suites en cas de silence (la valeur du courrier est là).\n" +
        "- Pour toute donnée manquante : [À COMPLÉTER : description].\n" +
        "- Ton ferme et courtois, sans agressivité. Format markdown simple.\n" +
        "- Terminez par « Notes pour l'utilisateur » : mode d'envoi recommandé, délais, étape suivante si échec.",
      prompt:
        `Type de courrier : ${COURRIERS[type]}\n` +
        profil +
        `\nInformations fournies :\n${JSON.stringify(reponses, null, 2)}\n\n` +
        `Rédigez le courrier complet.`,
    });

    const titre = `${COURRIERS[type].split(" (")[0]} — ${new Date().toLocaleDateString("fr-FR")}`;
    const { data: genDoc, error } = await admin
      .from("generated_documents")
      .insert({
        org_id,
        type: `courrier_${type}`,
        titre,
        reponses,
        contenu,
        created_by: auth.user.id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logAudit(org_id, auth.user.id, "courrier.genere", "generated_document", genDoc.id, { type });

    return res.status(200).json({ document: genDoc });
  } catch (e) {
    console.error("[Holbert API] courrier:", e);
    return res.status(500).json({ error: `Génération échouée : ${e.message}` });
  }
}
