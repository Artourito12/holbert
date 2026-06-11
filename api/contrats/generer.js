import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { anthropic, MODEL_SMART } from "../_lib/claude.js";
import { REFERENTIELS } from "../_lib/referentiels.js";

const VARIANTES = {
  protectrice_a: (roles) => `très protectrice pour le camp "${roles[0] ?? "partie A"}"`,
  equilibree: () => "équilibrée entre les parties (standard de marché)",
  protectrice_b: (roles) => `très protectrice pour le camp "${roles[1] ?? "partie B"}"`,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { org_id, type, role, variante = "equilibree", reponses = {} } = req.body ?? {};
  if (!org_id || !type) return res.status(400).json({ error: "org_id et type requis" });

  const ref = REFERENTIELS[type];
  if (!ref || type === "generique") return res.status(400).json({ error: `Type non générable : ${type}` });
  if (!VARIANTES[variante]) return res.status(400).json({ error: "Variante invalide" });

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
    const reponse = await anthropic.messages.create({
      model: MODEL_SMART,
      max_tokens: 16000,
      system:
        "Vous êtes le rédacteur de contrats d'une plateforme juridique française. " +
        "Vous rédigez un contrat COMPLET, prêt à relire par les parties, en français juridique " +
        "précis mais lisible. Règles :\n" +
        "- Structure : titre, identification des parties (avec champs [À COMPLÉTER] si l'information manque), " +
        "préambule si pertinent, articles numérotés, signatures.\n" +
        "- Intégrez TOUTES les clauses attendues du référentiel fourni ; aucune clause illégale ou " +
        "réputée non écrite (référentiel des pièges fourni à titre de garde-fou).\n" +
        "- Adaptez le niveau de protection à la variante demandée, sans jamais franchir la légalité.\n" +
        "- Utilisez les réponses de l'utilisateur ; pour toute donnée manquante, insérez [À COMPLÉTER : description].\n" +
        "- Terminez par une section « Notes pour l'utilisateur » listant les choix faits et les points à vérifier.\n" +
        "- Format : markdown simple (titres #, ##, paragraphes).",
      messages: [
        {
          role: "user",
          content:
            `Type de contrat : ${ref.meta.nom}\n` +
            `Variante demandée : ${VARIANTES[variante](ref.roles)}\n` +
            (role ? `Camp de l'utilisateur : ${role}\n` : "") +
            `\nClauses attendues (référentiel) :\n${JSON.stringify(ref.clauses_attendues, null, 2)}\n` +
            `\nPièges à éviter (référentiel) :\n${JSON.stringify(ref.clauses_pieges, null, 2)}\n` +
            `\nRéponses de l'utilisateur au questionnaire :\n${JSON.stringify(reponses, null, 2)}\n\n` +
            `Rédigez le contrat complet.`,
        },
      ],
    });
    const contenu = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");

    const titre = `${ref.meta.nom} — ${new Date().toLocaleDateString("fr-FR")}`;
    const { data: genDoc, error } = await admin
      .from("generated_documents")
      .insert({
        org_id,
        type,
        role: role ?? null,
        variante,
        titre,
        reponses,
        contenu,
        created_by: auth.user.id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logAudit(org_id, auth.user.id, "contrat.genere", "generated_document", genDoc.id, {
      type,
      role,
      variante,
    });

    return res.status(200).json({ document: genDoc });
  } catch (e) {
    console.error("[Holbert API] generer:", e);
    return res.status(500).json({ error: `Génération échouée : ${e.message}` });
  }
}
