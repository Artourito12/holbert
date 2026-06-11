import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { anthropic, structured, MODEL_SMART } from "../_lib/claude.js";

const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titre: { type: "string" },
          gravite: { type: "string", enum: ["mineure", "moyenne", "majeure"] },
          explication: { type: "string" },
          fondement: { type: "string" },
          evenements_lies: { type: "array", items: { type: "string" }, description: "Dates AAAA-MM-JJ des événements concernés" },
          action_recommandee: { type: "string" },
        },
        required: ["titre", "gravite", "explication"],
      },
    },
    synthese: { type: "string", description: "Synthèse en 3-5 phrases" },
  },
  required: ["findings", "synthese"],
};

const PROMPTS = {
  vices: {
    system:
      "Vous êtes l'assistant procédural d'un avocat français. À partir de la chronologie d'un dossier, " +
      "vous repérez les VICES DE PROCÉDURE potentiels et les délais suspects : délais de prescription ou de " +
      "forclusion, délais de comparution et de signification, mentions et notifications obligatoires, " +
      "régularité des actes (mise en demeure préalable, tentative amiable obligatoire…). " +
      "Chaque constat cite son fondement précis et les événements datés concernés. " +
      "Signalez aussi les vérifications à faire qui ne ressortent pas de la chronologie. N'inventez rien.",
    structured: true,
  },
  prescription: {
    system:
      "Vous êtes l'assistant d'un avocat français. À partir de la chronologie d'un dossier, vous analysez " +
      "la PRESCRIPTION de chaque demande envisageable : délai applicable (avec fondement), point de départ " +
      "probable, causes d'interruption (assignation art. 2241, reconnaissance art. 2240, exécution forcée " +
      "art. 2244) et de suspension (médiation art. 2238) PRÉSENTES DANS LA CHRONOLOGIE, échéance estimée. " +
      "Qualifiez chaque conclusion de certaine ou à vérifier, en citant les événements datés utilisés.",
    structured: true,
  },
  synthese: {
    system:
      "Vous êtes l'assistant d'un avocat français. Rédigez une NOTE DE SYNTHÈSE de préparation du dossier : " +
      "1) résumé des faits (depuis la chronologie), 2) forces du dossier, 3) faiblesses et risques, " +
      "4) pièces ou éléments manquants, 5) questions probables du juge ou de l'adversaire. " +
      "Concis, structuré en markdown, vouvoiement.",
    structured: false,
  },
  conclusions: {
    system:
      "Vous êtes l'assistant de rédaction d'un avocat français. Rédigez une TRAME DE CONCLUSIONS : " +
      "en-tête (juridiction, parties avec leurs qualités), I. FAITS ET PROCÉDURE (récit chronologique " +
      "rigoureux construit sur la chronologie fournie, avec visa des pièces « (pièce n° X) » à chaque fait " +
      "sourcé), II. DISCUSSION (moyens plausibles structurés, avec [À DÉVELOPPER : …] là où l'avocat doit " +
      "trancher la stratégie), III. PAR CES MOTIFS (dispositif). " +
      "Format markdown. C'est une trame de travail destinée à un avocat, pas un acte final.",
    structured: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { dossier_id, type } = req.body ?? {};
  if (!dossier_id || !PROMPTS[type]) {
    return res.status(400).json({ error: "dossier_id et type (vices|prescription|synthese|conclusions) requis" });
  }

  const { data: dossier } = await admin
    .from("dossiers")
    .select("*")
    .eq("id", dossier_id)
    .maybeSingle();
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable" });

  const auth = await requireOrgMember(req, res, dossier.org_id);
  if (!auth) return;

  const { data: ent } = await admin
    .from("entitlements")
    .select("active")
    .eq("org_id", dossier.org_id)
    .eq("module", "pleiter")
    .maybeSingle();
  if (!ent?.active) {
    return res.status(403).json({ error: "Le module Pleiter n'est pas activé pour votre organisation" });
  }

  const [{ data: evenements }, { data: pieces }] = await Promise.all([
    admin.from("evenements").select("*").eq("dossier_id", dossier_id).order("date"),
    admin.from("pieces").select("id, numero, intitule").eq("dossier_id", dossier_id).order("numero"),
  ]);

  if (!evenements?.length) {
    return res.status(409).json({
      error: "La chronologie est vide — ajoutez des pièces et extrayez leurs événements d'abord.",
    });
  }

  const contexte =
    `Dossier : ${dossier.nom}\n` +
    `Parties : ${JSON.stringify(dossier.parties)}\n` +
    `Juridiction : ${dossier.juridiction ?? "non précisée"} · Procédure : ${dossier.type_procedure ?? "non précisée"}\n` +
    `Enjeu : ${dossier.enjeu_financier ? `${dossier.enjeu_financier} €` : "non précisé"}\n\n` +
    `Bordereau des pièces :\n${(pieces ?? []).map((p) => `Pièce n° ${p.numero} — ${p.intitule}`).join("\n")}\n\n` +
    `Chronologie (événements sourcés) :\n` +
    evenements
      .map((e) => {
        const piece = pieces?.find((p) => p.id === e.piece_id);
        const visa = piece ? ` (pièce n° ${piece.numero})` : "";
        return `- ${e.date} : ${e.titre}${e.description ? ` — ${e.description}` : ""}${visa}${e.source_passage ? ` [source : « ${e.source_passage.slice(0, 150)} »]` : ""}`;
      })
      .join("\n");

  try {
    let resultat = null;
    let contenu = null;

    if (PROMPTS[type].structured) {
      const out = await structured({
        model: MODEL_SMART,
        system: PROMPTS[type].system,
        prompt: contexte,
        toolName: "rendre_analyse",
        description: "Restitue l'analyse structurée du dossier",
        schema: FINDINGS_SCHEMA,
        maxTokens: 8000,
      });
      resultat = out;
      contenu = out.synthese;
    } else {
      const reponse = await anthropic.messages.create({
        model: MODEL_SMART,
        max_tokens: 12000,
        system: PROMPTS[type].system,
        messages: [{ role: "user", content: contexte }],
      });
      contenu = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }

    const { data: analyse, error } = await admin
      .from("analyses_dossier")
      .insert({
        dossier_id,
        org_id: dossier.org_id,
        type,
        statut: "done",
        resultat,
        contenu,
        created_by: auth.user.id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logAudit(dossier.org_id, auth.user.id, `dossier.analyse_${type}`, "analyse", analyse.id, {
      dossier_id,
      evenements: evenements.length,
    });

    return res.status(200).json({ analyse });
  } catch (e) {
    console.error("[Holbert API] analyse dossier:", e);
    return res.status(500).json({ error: `Analyse échouée : ${e.message}` });
  }
}
