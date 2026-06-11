import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, deepText, MODEL_FAST } from "../_lib/claude.js";
import { embed } from "../_lib/openai.js";
import { verifierCitations } from "../_lib/legifrance.js";
import { contexteOrganisation } from "../_lib/org-context.js";

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

    // ---- 1. Routeur : domaine, intention, complexité --------------------------
    const intent = await structured({
      model: MODEL_FAST,
      system:
        "Vous êtes le routeur du chat Hofraad, assistant de recherche juridique français pour " +
        "professionnels du droit. Vous classez chaque demande :\n" +
        "- domaine_juridique : false UNIQUEMENT si la demande n'a aucun rapport avec le droit, " +
        "la conformité, les contrats, les litiges ou la gestion juridique (ex. recette de cuisine, " +
        "code informatique sans dimension juridique). Une question factuelle liée à un dossier reste juridique.\n" +
        "- complexite : simple (réponse en quelques lignes, point de droit établi), moyenne " +
        "(nécessite analyse, croisement de textes ou des documents de l'organisation), complexe " +
        "(cas particulier multi-questions, stratégie, zones grises — mérite une recherche approfondie).\n" +
        "- besoin_professionnel : true si le cas exige plus que de l'information (représentation, urgence procédurale).",
      prompt: `Demande de l'utilisateur :\n"""${texte}"""`,
      toolName: "router_intention",
      description: "Classe l'intention de la demande",
      schema: {
        type: "object",
        properties: {
          domaine_juridique: { type: "boolean" },
          complexite: { type: "string", enum: ["simple", "moyenne", "complexe"] },
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
        required: ["domaine_juridique", "complexite", "kind", "besoin_professionnel", "requete_recherche"],
      },
      maxTokens: 600,
    });

    // ---- Garde-fou : Hofraad ne traite que le droit ---------------------------
    if (intent.domaine_juridique === false) {
      const { data: refus, error: refusError } = await admin
        .from("messages")
        .insert({
          conversation_id: convId,
          org_id,
          role: "assistant",
          contenu:
            "Je suis Hofraad, votre assistant de recherche juridique : je ne traite que les questions " +
            "de droit, de conformité, de contrats et de gestion juridique. Reformulez votre demande " +
            "sous cet angle si elle a une dimension juridique — sinon, je ne vous serai d'aucune aide.",
          intent,
        })
        .select()
        .single();
      if (refusError) return res.status(500).json({ error: refusError.message });
      return res.status(200).json({ conversation_id: convId, message: refus });
    }

    // ---- 2. Recherche SYSTÉMATIQUE dans la base de l'org ---------------------
    // Dégradation douce : si les embeddings sont indisponibles (quota OpenAI…),
    // le chat répond sans la base documentaire au lieu de planter.
    let pertinents = [];
    let rechercheKo = false;
    try {
      const [embedding] = await embed([intent.requete_recherche || texte]);
      const { data: chunks } = await admin.rpc("match_chunks", {
        p_org: org_id,
        p_embedding: embedding,
        p_count: 8,
      });
      pertinents = (chunks ?? []).filter((c) => c.similarite > 0.25);
    } catch (e) {
      rechercheKo = true;
      console.error("[Holbert API] recherche indisponible:", e.message);
    }

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
        : rechercheKo
          ? "(recherche documentaire temporairement indisponible — répondez sur le droit général et signalez-le)"
          : "(aucun document pertinent dans la base de l'organisation)";

      // Profondeur adaptée à la complexité (docs/09 §3) — la recherche
      // approfondie segmentée (phase B) prendra le relais pour "complexe".
      const PROFONDEUR = {
        simple: { thinkingBudget: 0, maxTokens: 2500 },
        moyenne: { thinkingBudget: 3000, maxTokens: 6000 },
        complexe: { thinkingBudget: 10000, maxTokens: 12000 },
      };
      const profondeur = PROFONDEUR[intent.complexite] ?? PROFONDEUR.moyenne;

      const profil = await contexteOrganisation(org_id);
      contenu = await deepText({
        system:
          "Vous êtes Hofraad, assistant de recherche juridique français pour AVOCATS et JURISTES — " +
          "des professionnels avec des cas souvent très particuliers. Règles impératives :\n" +
          "- Vouvoiement, ton confraternel et précis, pas d'emojis.\n" +
          "- TOUT est sourcé : citez les textes exacts (article, code), la jurisprudence pertinente " +
          "(juridiction, date, numéro de pourvoi), et les extraits de documents fournis par [n].\n" +
          "- LE CONTEXTE D'ABORD : si des éléments indispensables manquent pour répondre avec rigueur " +
          "(camp défendu, dates précises, juridiction, qualité des parties), commencez par poser ces " +
          "questions — n'inventez jamais un contexte. Pour une question simple et générale, répondez directement.\n" +
          "- Si l'information n'est pas dans les documents de l'organisation, dites-le explicitement " +
          "avant de donner le cadre juridique général.\n" +
          "- Distinguez ce qui est certain (texte clair, jurisprudence constante) de ce qui est discuté " +
          "(zones grises, divergences) — un professionnel a besoin de cette nuance.\n" +
          "- Calibrez la longueur sur la complexité : une question simple mérite une réponse courte.",
        prompt:
          `Complexité évaluée : ${intent.complexite}\n` +
          `Extraits des documents de l'organisation :\n${contexte}\n` +
          profil +
          `\nDemande : ${texte}`,
        thinkingBudget: profondeur.thinkingBudget,
        maxTokens: profondeur.maxTokens,
      });

      if (intent.complexite === "complexe") {
        contenu +=
          "\n\n*Cas complexe détecté : la recherche approfondie segmentée (analyse question par " +
          "question, sources Légifrance et Judilibre exhaustives, document de synthèse) arrive très " +
          "prochainement dans Hofraad.*";
      }
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
