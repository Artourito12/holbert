import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { anthropic, structured, MODEL_FAST, MODEL_SMART } from "../_lib/claude.js";
import { embed } from "../_lib/openai.js";
import { verifierCitations } from "../_lib/legifrance.js";

const KINDS = [
  "question", "calcul", "generation", "audit",
  "analyse_pieces", "recherche_base", "action_gestion", "hors_perimetre",
];

const REPONSES_A_VENIR = {
  calcul:
    "Ce calcul précis n'est pas encore couvert. Calculs disponibles : indemnité de licenciement, " +
    "revalorisation de pension alimentaire et arriérés, délais de prescription (page Calculateurs du module Raader).",
  generation:
    "La génération est disponible : pour un contrat, passez par Raader > Créer un contrat ; " +
    "pour un courrier (mise en demeure, résiliations, dépôt de garantie), par Raader > Courriers. " +
    "La génération directe depuis cette conversation arrive bientôt.",
  audit:
    "L'audit de contrats est disponible : ouvrez votre contrat dans Documents puis cliquez « Auditer ». " +
    "Le lancement de l'audit directement depuis cette conversation arrive bientôt.",
  analyse_pieces:
    "L'analyse de pièces se fait dans un dossier : module Pleiter > Nouveau dossier, déposez-y vos pièces " +
    "en vrac — chronologie, bordereau et analyses (vices, prescription, conclusions) s'y construisent.",
  action_gestion:
    "Vos échéances détectées sont dans l'Échéancier (marquer traitée/ignorée). " +
    "Les tâches et rappels personnalisés arrivent à un prochain jalon.",
};

const DISCLAIMER =
  "\n\n---\n*Cette réponse est une information juridique générale fondée sur vos documents, " +
  "pas un conseil juridique individualisé. Pour une situation à enjeu, consultez un professionnel du droit.*";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { org_id, conversation_id, message } = req.body ?? {};
  if (!org_id || !message?.trim()) return res.status(400).json({ error: "org_id et message requis" });

  const auth = await requireOrgMember(req, res, org_id);
  if (!auth) return;
  const texte = message.trim();

  try {
    // ---- Conversation -------------------------------------------------------
    let convId = conversation_id;
    if (convId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("id, org_id")
        .eq("id", convId)
        .maybeSingle();
      if (!conv || conv.org_id !== org_id) return res.status(404).json({ error: "Conversation introuvable" });
    } else {
      const { data: conv, error } = await admin
        .from("conversations")
        .insert({
          org_id,
          created_by: auth.user.id,
          titre: texte.slice(0, 60) + (texte.length > 60 ? "…" : ""),
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      convId = conv.id;
    }

    await admin.from("messages").insert({
      conversation_id: convId,
      org_id,
      role: "user",
      contenu: texte,
    });

    // ---- 1. Routeur d'intention ---------------------------------------------
    const intent = await structured({
      model: MODEL_FAST,
      system:
        "Vous êtes le routeur d'intention d'une plateforme juridique française. " +
        "Vous classez la demande de l'utilisateur et détectez si elle relève du conseil " +
        "individualisé réglementé (stratégie personnelle à fort enjeu, représentation, contentieux engagé).",
      prompt: `Demande de l'utilisateur :\n"""${texte}"""`,
      toolName: "router_intention",
      description: "Classe l'intention de la demande",
      schema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: KINDS },
          besoin_professionnel: {
            type: "boolean",
            description: "true si le cas exige l'orientation vers un professionnel du droit",
          },
          requete_recherche: {
            type: "string",
            description: "Reformulation optimale pour la recherche dans la base documentaire",
          },
          competence_calcul: {
            type: "string",
            enum: ["licenciement", "pension", "prescription", "autre"],
            description:
              "Si kind=calcul : licenciement (indemnité de licenciement), pension (pension alimentaire, " +
              "revalorisation, arriérés), prescription (délais pour agir), sinon autre",
          },
          params_calcul: {
            type: "object",
            description:
              "Paramètres chiffrés/datés détectés dans la demande (clés : salaire_reference, " +
              "anciennete_annees, anciennete_mois, pension_initiale, annee_fixation, paye_mensuel, " +
              "date_debut, date_fin, type_action, point_depart — uniquement si explicites)",
          },
        },
        required: ["kind", "besoin_professionnel", "requete_recherche"],
      },
      maxTokens: 600,
    });

    // ---- 2. Recherche SYSTÉMATIQUE dans la base de l'org ---------------------
    const [embedding] = await embed([intent.requete_recherche || texte]);
    const { data: chunks } = await admin.rpc("match_chunks", {
      p_org: org_id,
      p_embedding: embedding,
      p_count: 8,
    });
    const pertinents = (chunks ?? []).filter((c) => c.similarite > 0.25);

    const docIds = [...new Set(pertinents.map((c) => c.document_id))];
    const { data: docs } = docIds.length
      ? await admin.from("documents").select("id, nom_fichier").in("id", docIds)
      : { data: [] };
    const nomDoc = Object.fromEntries((docs ?? []).map((d) => [d.id, d.nom_fichier]));

    const sources = pertinents.map((c, i) => ({
      n: i + 1,
      document_id: c.document_id,
      nom_fichier: nomDoc[c.document_id] ?? "Document",
      position: c.pos,
      extrait: c.contenu.slice(0, 400),
    }));

    // ---- 3. Exécution selon l'intention ---------------------------------------
    let contenu;
    let widget = null;
    if (
      intent.kind === "calcul" &&
      ["licenciement", "pension", "prescription"].includes(intent.competence_calcul)
    ) {
      widget = {
        type: "calculatrice",
        competence: intent.competence_calcul,
        params: intent.params_calcul ?? {},
      };
      contenu =
        "Voici le calculateur correspondant à votre demande. Ajustez les valeurs : le résultat, " +
        "le détail du calcul et ses sources se mettent à jour en temps réel.";
    } else if (intent.kind === "question" || intent.kind === "recherche_base" || intent.kind === "hors_perimetre") {
      const contexte = sources.length
        ? sources.map((s) => `[${s.n}] (${s.nom_fichier})\n${s.extrait}`).join("\n\n")
        : "(aucun document pertinent dans la base de l'organisation)";

      const reponse = await anthropic.messages.create({
        model: MODEL_SMART,
        max_tokens: 2000,
        system:
          "Vous êtes l'assistant juridique d'une plateforme française. Règles impératives :\n" +
          "- Vouvoiement, français précis, ton direct et pédagogique, pas d'emojis.\n" +
          "- Appuyez-vous d'abord sur les extraits de documents fournis, cités par [n].\n" +
          "- Si l'information n'est pas dans les documents, dites-le explicitement avant " +
          "de donner le cadre juridique général (avec les textes applicables).\n" +
          "- Vous fournissez de l'information juridique, jamais de conseil individualisé.\n" +
          "- Restez concis : répondez à la question, pas plus.",
        messages: [
          {
            role: "user",
            content: `Extraits des documents de l'organisation :\n${contexte}\n\nQuestion : ${texte}`,
          },
        ],
      });
      contenu = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    } else {
      contenu =
        `J'ai bien compris votre demande (${intent.kind.replace("_", " ")}), mais cette compétence n'est pas encore ouverte : ` +
        (REPONSES_A_VENIR[intent.kind] ?? "elle arrive à un prochain jalon.");
      if (sources.length) {
        contenu += `\n\nEn attendant, j'ai trouvé dans votre base ${sources.length} passage(s) qui semblent liés — posez-moi une question dessus si utile.`;
      }
    }

    // ---- Mode preuve : vérification Légifrance des articles cités -----------
    let sourcesLoi = [];
    try {
      sourcesLoi = await verifierCitations(contenu);
    } catch (e) {
      console.error("[Holbert API] mode preuve:", e.message);
    }

    if (intent.besoin_professionnel) {
      contenu +=
        "\n\n**Votre situation semble dépasser l'information juridique générale.** " +
        "Je vous recommande de consulter un avocat (annuaire : avocat.fr) ou, selon le sujet, " +
        "un conciliateur de justice (gratuit, conciliateurs.fr).";
    }
    contenu += DISCLAIMER;

    const { data: assistantMsg, error: msgError } = await admin
      .from("messages")
      .insert({
        conversation_id: convId,
        org_id,
        role: "assistant",
        contenu,
        intent,
        sources,
        widget,
        sources_loi: sourcesLoi.length ? sourcesLoi : null,
      })
      .select()
      .single();
    if (msgError) return res.status(500).json({ error: msgError.message });

    await logAudit(org_id, auth.user.id, "chat.message", "conversation", convId, {
      kind: intent.kind,
      besoin_professionnel: intent.besoin_professionnel,
      sources: sources.length,
    });

    return res.status(200).json({ conversation_id: convId, message: assistantMsg });
  } catch (e) {
    console.error("[Holbert API] chat:", e);
    return res.status(500).json({ error: `Erreur du chat : ${e.message}` });
  }
}
