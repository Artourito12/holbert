import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, MODEL_SMART } from "../_lib/claude.js";
import { embed } from "../_lib/openai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { demande_id } = req.body ?? {};
  if (!demande_id) return res.status(400).json({ error: "demande_id manquant" });

  const { data: demande } = await admin
    .from("demandes")
    .select("*")
    .eq("id", demande_id)
    .maybeSingle();
  if (!demande) return res.status(404).json({ error: "Demande introuvable" });

  const auth = await requireOrgMember(req, res, demande.org_id);
  if (!auth) return;

  const { data: ent } = await admin
    .from("entitlements")
    .select("active")
    .eq("org_id", demande.org_id)
    .eq("module", "normer")
    .maybeSingle();
  if (!ent?.active) {
    return res.status(403).json({ error: "Le module Normer n'est pas activé pour votre organisation" });
  }

  try {
    // 1. Base de réponses types de l'org
    const { data: reponsesTypes } = await admin
      .from("reponses_types")
      .select("id, question, reponse, categorie")
      .eq("org_id", demande.org_id)
      .order("usage_count", { ascending: false })
      .limit(30);

    // 2. Recherche systématique dans la base documentaire
    const [embedding] = await embed([`${demande.objet}\n${demande.description ?? ""}`]);
    const { data: chunks } = await admin.rpc("match_chunks", {
      p_org: demande.org_id,
      p_embedding: embedding,
      p_count: 5,
    });
    const passages = (chunks ?? [])
      .filter((c) => c.similarite > 0.25)
      .map((c) => c.contenu.slice(0, 400));

    // 3. Qualification + proposition de réponse
    const out = await structured({
      model: MODEL_SMART,
      system:
        "Vous êtes le Front Door d'une direction juridique française : vous qualifiez les demandes des " +
        "opérationnels et proposez une réponse QUE LE JURISTE VALIDERA (vous ne répondez jamais directement " +
        "au demandeur). Règles :\n" +
        "- Appuyez-vous d'abord sur les réponses types déjà validées par la DJ, puis sur les extraits " +
        "documentaires, puis sur le droit général (en citant les textes).\n" +
        "- Vouvoiement, clair pour un non-juriste, concis.\n" +
        "- Si la demande exige une analyse approfondie ou un avocat externe, dites-le dans la réponse " +
        "proposée et qualifiez la priorité en conséquence.",
      prompt:
        `Demande de l'opérationnel :\nObjet : ${demande.objet}\n${demande.description ?? ""}\n\n` +
        `Réponses types validées de l'organisation :\n${JSON.stringify(reponsesTypes ?? [], null, 2)}\n\n` +
        `Extraits de la base documentaire :\n${passages.join("\n---\n") || "(aucun)"}`,
      toolName: "qualifier_demande",
      description: "Qualifie la demande et propose une réponse à valider",
      schema: {
        type: "object",
        properties: {
          categorie: {
            type: "string",
            enum: ["contrats", "social", "commercial", "donnees_personnelles", "corporate", "contentieux", "compliance", "autre"],
          },
          priorite: { type: "string", enum: ["basse", "normale", "haute", "critique"] },
          reponse_proposee: { type: "string" },
          reponse_type_utilisee: { type: "string", description: "id de la réponse type réutilisée, le cas échéant" },
        },
        required: ["categorie", "priorite", "reponse_proposee"],
      },
      maxTokens: 3000,
    });

    if (out.reponse_type_utilisee) {
      const rt = (reponsesTypes ?? []).find((r) => r.id === out.reponse_type_utilisee);
      if (rt) {
        await admin
          .from("reponses_types")
          .update({ usage_count: (rt.usage_count ?? 0) + 1 })
          .eq("id", rt.id);
      }
    }

    const { data: maj, error } = await admin
      .from("demandes")
      .update({
        statut: "a_valider",
        categorie: out.categorie,
        priorite: out.priorite,
        reponse_ia: out.reponse_proposee,
      })
      .eq("id", demande.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Notifier les juristes (owner/admin) qu'une demande attend validation
    const { data: juristes } = await admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", demande.org_id)
      .in("role", ["owner", "admin"]);
    if (juristes?.length) {
      await admin.from("notifications").insert(
        juristes.map((j) => ({
          org_id: demande.org_id,
          user_id: j.user_id,
          titre: `Demande à valider : ${demande.objet.slice(0, 80)}`,
          corps: `Priorité ${out.priorite} · ${out.categorie}`,
          lien: `/demandes/${demande.id}`,
        }))
      );
    }

    await logAudit(demande.org_id, auth.user.id, "frontdoor.qualifiee", "demande", demande.id, {
      categorie: out.categorie,
      priorite: out.priorite,
    });

    return res.status(200).json({ demande: maj });
  } catch (e) {
    console.error("[Holbert API] qualifier:", e);
    return res.status(500).json({ error: `Qualification échouée : ${e.message}` });
  }
}
