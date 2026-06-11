import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { demande_id, reponse_finale, enrichir_base } = req.body ?? {};
  if (!demande_id || !reponse_finale?.trim()) {
    return res.status(400).json({ error: "demande_id et reponse_finale requis" });
  }

  const { data: demande } = await admin
    .from("demandes")
    .select("*")
    .eq("id", demande_id)
    .maybeSingle();
  if (!demande) return res.status(404).json({ error: "Demande introuvable" });

  const auth = await requireOrgMember(req, res, demande.org_id);
  if (!auth) return;
  if (!["owner", "admin"].includes(auth.role)) {
    return res.status(403).json({ error: "Seul un juriste (admin de l'organisation) peut valider une réponse" });
  }

  const { data: maj, error } = await admin
    .from("demandes")
    .update({
      statut: "repondue",
      reponse_finale: reponse_finale.trim(),
      validee_par: auth.user.id,
      validee_at: new Date().toISOString(),
    })
    .eq("id", demande.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Notification au demandeur
  await admin.from("notifications").insert({
    org_id: demande.org_id,
    user_id: demande.created_by,
    titre: `Réponse à votre demande : ${demande.objet.slice(0, 80)}`,
    corps: "Votre direction juridique a répondu.",
    lien: `/demandes/${demande.id}`,
  });

  // Capitalisation : la réponse validée enrichit la base de réponses types
  if (enrichir_base) {
    await admin.from("reponses_types").insert({
      org_id: demande.org_id,
      question: demande.objet,
      reponse: reponse_finale.trim(),
      categorie: demande.categorie,
      valide_par: auth.user.id,
    });
  }

  await logAudit(demande.org_id, auth.user.id, "frontdoor.validee", "demande", demande.id, {
    enrichir_base: Boolean(enrichir_base),
    editee: reponse_finale.trim() !== (demande.reponse_ia ?? "").trim(),
  });

  return res.status(200).json({ demande: maj });
}
