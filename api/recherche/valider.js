import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { declencherEtape } from "../_lib/recherche-chain.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { recherche_id, questions } = req.body ?? {};
  if (!recherche_id || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "recherche_id et questions requis" });
  }

  const { data: recherche } = await admin
    .from("recherches")
    .select("*")
    .eq("id", recherche_id)
    .maybeSingle();
  if (!recherche) return res.status(404).json({ error: "Recherche introuvable" });
  if (recherche.statut !== "attente_validation") {
    return res.status(409).json({ error: "Cette recherche a déjà été lancée" });
  }

  const auth = await requireOrgMember(req, res, recherche.org_id);
  if (!auth) return;

  const validees = questions
    .map((q, i) => ({
      id: q.id ?? `q${i + 1}`,
      question: String(q.question ?? "").trim(),
      justification: q.justification ?? null,
      statut: "a_faire",
    }))
    .filter((q) => q.question.length > 5)
    .slice(0, 6);
  if (!validees.length) return res.status(400).json({ error: "Aucune question valide" });

  const { error } = await admin
    .from("recherches")
    .update({
      questions: validees,
      statut: "en_cours",
      etape_courante: "préparation de la recherche",
      progression: 5,
    })
    .eq("id", recherche_id);
  if (error) return res.status(500).json({ error: error.message });

  await logAudit(recherche.org_id, auth.user.id, "recherche.lancee", "recherche", recherche_id, {
    questions: validees.length,
  });

  // Démarre la chaîne de traitement (sans attendre sa fin)
  declencherEtape(recherche_id);

  return res.status(200).json({ statut: "en_cours" });
}
