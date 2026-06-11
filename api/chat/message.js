import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, structuredDeep, deepText, MODEL_FAST } from "../_lib/claude.js";
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

  const { org_id, conversation_id, message, mode, dossier_id } = req.body ?? {};
  if (!org_id || !message?.trim()) return res.status(400).json({ error: "org_id et message requis" });

  const auth = await requireOrgMember(req, res, org_id);
  if (!auth) return;
  const texte = message.trim();

  try {
    // ---- Conversation -------------------------------------------------------
    let convId = conversation_id;
    let dossierId = null;
    if (convId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("id, org_id, dossier_id")
        .eq("id", convId)
        .maybeSingle();
      if (!conv || conv.org_id !== org_id) return res.status(404).json({ error: "Conversation introuvable" });
      dossierId = conv.dossier_id;
    } else {
      const { data: conv, error } = await admin
        .from("conversations")
        .insert({
          org_id,
          created_by: auth.user.id,
          dossier_id: dossier_id ?? null,
          titre: texte.slice(0, 60) + (texte.length > 60 ? "…" : ""),
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      convId = conv.id;
      dossierId = conv.dossier_id;
    }

    // ---- Historique de la conversation (continuité multi-tours) -------------
    const { data: precedents } = await admin
      .from("messages")
      .select("role, contenu")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(8);
    const historique = (precedents ?? [])
      .reverse()
      .map((m) => `${m.role === "user" ? "Utilisateur" : "Hofraad"} : ${m.contenu.slice(0, 1500)}`)
      .join("\n---\n");
    const blocHistorique = historique
      ? `\n=== ÉCHANGES PRÉCÉDENTS DE CETTE CONVERSATION ===\n${historique}\n=== FIN DES ÉCHANGES ===\n`
      : "";

    // ---- Contexte du dossier contentieux (conversation rattachée) -----------
    let contexteDossier = "";
    if (dossierId) {
      const [{ data: dossier }, { data: piecesDossier }, { data: evenements }, { data: dernierScan }] =
        await Promise.all([
          admin.from("dossiers").select("*").eq("id", dossierId).maybeSingle(),
          admin
            .from("pieces")
            .select("camp, numero, intitule, date_piece")
            .eq("dossier_id", dossierId)
            .order("camp")
            .order("numero"),
          admin
            .from("evenements")
            .select("date, titre")
            .eq("dossier_id", dossierId)
            .order("date"),
          admin
            .from("scans_dossier")
            .select("document")
            .eq("dossier_id", dossierId)
            .eq("statut", "terminee")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
      if (dossier) {
        const campLib = { nous: "Nous", adverse: "Adverse", procedure: "Acte" };
        contexteDossier =
          `\n=== DOSSIER CONTENTIEUX RATTACHÉ À CETTE CONVERSATION ===\n` +
          `Dossier : ${dossier.nom} · Parties : ${JSON.stringify(dossier.parties)} · ` +
          `Juridiction : ${dossier.juridiction ?? "?"} · Procédure : ${dossier.type_procedure ?? "?"} · ` +
          `Enjeu : ${dossier.enjeu_financier ?? "?"} €\n` +
          `Pièces :\n${(piecesDossier ?? [])
            .map((p) => `[${campLib[p.camp]} n° ${p.numero}] ${p.intitule}${p.date_piece ? ` (${p.date_piece})` : ""}`)
            .join("\n")}\n` +
          `Chronologie :\n${(evenements ?? []).map((e) => `${e.date} — ${e.titre}`).join("\n")}\n` +
          (dernierScan?.document
            ? `\nDernier scan complet du dossier (stratégie, vices, fiches) :\n${dernierScan.document.slice(0, 12000)}\n`
            : "") +
          `=== FIN DU DOSSIER ===\n` +
          `Ancrez vos réponses dans ce dossier : visez les pièces par leur numéro, tenez compte de la ` +
          `chronologie et de la stratégie du scan. Demandez ce qui manque plutôt que de supposer.\n`;
      }
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
        "code informatique sans dimension juridique). Une question factuelle liée à un dossier reste juridique. " +
        "L'arbitrage, le droit international privé, le commerce international et les contrats de " +
        "common law SONT du domaine juridique.\n" +
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
          type_generation: {
            type: "string",
            enum: ["contrat", "courrier", "autre"],
            description: "Si kind=generation : contrat complet, courrier/lettre, ou autre",
          },
          contrat_type: {
            type: "string",
            enum: ["bail-commercial", "prestation-services", "cgv", "autre"],
            description: "Si un type de contrat précis est identifiable",
          },
          document_vise: {
            type: "string",
            description: "Si l'utilisateur désigne un document précis (fragment de son nom), sinon omettre",
          },
          role_vise: {
            type: "string",
            description: "Camp de l'utilisateur s'il est exprimé (bailleur, preneur, prestataire, client…)",
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

    // ---- 2bis. Recherche approfondie : segmentation à valider -----------------
    // Déclenchée par l'utilisateur (mode "approfondie") ou par le routeur
    // (cas complexe) pour les demandes d'analyse — docs/09 §4.
    const kindsAnalyse = ["question", "recherche_base", "analyse_pieces", "hors_perimetre"];
    if (
      kindsAnalyse.includes(intent.kind) &&
      (mode === "approfondie" || intent.complexite === "complexe")
    ) {
      const profilSeg = await contexteOrganisation(org_id);
      const contexteDocs = pertinents.length
        ? `\nExtraits des documents de l'organisation potentiellement liés :\n${pertinents
            .slice(0, 4)
            .map((c) => c.contenu.slice(0, 300))
            .join("\n---\n")}`
        : "";

      const seg = await structuredDeep({
        system:
          "Vous êtes Hofraad, assistant de recherche juridique pour professionnels du droit. " +
          "Avant une recherche approfondie, vous devez : 1) reformuler le cas pour VÉRIFIER votre " +
          "compréhension (faits retenus, partie défendue si identifiable, enjeu) ; 2) SEGMENTER le cas " +
          "en questions juridiques distinctes et précises (2 à 6), chacune avec une justification d'une " +
          "phrase expliquant pourquoi elle se pose. L'utilisateur corrigera et validera ces questions " +
          "avant la recherche. Si un élément de contexte essentiel manque, formulez la question de " +
          "manière à expliciter l'hypothèse retenue.",
        prompt:
          `Demande de l'utilisateur :\n"""${texte}"""\n` +
          blocHistorique +
          contexteDossier +
          profilSeg +
          contexteDocs,
        toolName: "segmenter_cas",
        description: "Reformule le cas et le segmente en questions juridiques",
        schema: {
          type: "object",
          properties: {
            comprehension: {
              type: "string",
              description: "Reformulation du cas : faits retenus, partie défendue, enjeu — 4-8 lignes",
            },
            questions: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  justification: { type: "string" },
                },
                required: ["question"],
              },
            },
          },
          required: ["comprehension", "questions"],
        },
        thinkingBudget: 4000,
        maxTokens: 8000,
      });

      const questions = (seg.questions ?? []).map((q, i) => ({
        id: `q${i + 1}`,
        question: q.question,
        justification: q.justification ?? null,
        statut: "a_faire",
      }));

      const { data: recherche, error: rechError } = await admin
        .from("recherches")
        .insert({
          org_id,
          conversation_id: convId,
          created_by: auth.user.id,
          question_initiale: texte,
          comprehension: seg.comprehension,
          questions,
          statut: "attente_validation",
          etape_courante: "validation des questions",
        })
        .select()
        .single();
      if (rechError) return res.status(500).json({ error: rechError.message });

      const { data: segMsg, error: segMsgError } = await admin
        .from("messages")
        .insert({
          conversation_id: convId,
          org_id,
          role: "assistant",
          contenu:
            "**Voici ce que j'ai compris de votre cas :**\n\n" +
            seg.comprehension +
            "\n\nJ'ai segmenté votre demande en questions juridiques distinctes ci-dessous. " +
            "**Relisez-les, corrigez-les directement si nécessaire, puis validez** : je lancerai " +
            "alors une recherche approfondie (textes, jurisprudence, vos documents) et produirai " +
            "un document de synthèse argumenté et sourcé. Vous pourrez quitter la page : la " +
            "recherche continue et le résultat vous attendra ici.",
          intent,
          widget: {
            type: "recherche_validation",
            recherche_id: recherche.id,
            questions: questions.map((q) => ({
              id: q.id,
              question: q.question,
              justification: q.justification,
            })),
          },
        })
        .select()
        .single();
      if (segMsgError) return res.status(500).json({ error: segMsgError.message });

      await logAudit(org_id, auth.user.id, "recherche.segmentee", "recherche", recherche.id, {
        questions: questions.length,
        declencheur: mode === "approfondie" ? "utilisateur" : "complexite",
      });

      return res.status(200).json({ conversation_id: convId, message: segMsg });
    }

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
    } else if (intent.kind === "calcul") {
      // Calcul hors catalogue : l'IA construit un calculateur ad hoc (docs/09 §6)
      const profilCalc = await contexteOrganisation(org_id);
      const spec = await structuredDeep({
        system:
          "Vous concevez un CALCULATEUR JURIDIQUE INTERACTIF ad hoc pour un professionnel du droit. Règles :\n" +
          "- champs : uniquement type nombre, curseur ou choix (PAS de dates — utilisez des durées en " +
          "mois/années via nombre/curseur). ids en snake_case.\n" +
          "- formules : expressions arithmétiques sur les ids des champs, opérateurs + - * / % () " +
          "comparaisons, ternaire (cond ? a : b), fonctions min/max/abs/round/floor/ceil/pow. RIEN d'autre.\n" +
          "- sources OBLIGATOIRES : textes et barèmes qui fondent chaque taux/seuil utilisé.\n" +
          "- avertissements : limites de la simulation, et SURTOUT tout barème dont la valeur actuelle " +
          "doit être vérifiée (indiquez où la vérifier).\n" +
          "- Si le calcul n'est PAS automatisable sérieusement (trop dépendant d'une appréciation " +
          "judiciaire), faites un calculateur d'ordre de grandeur et dites-le clairement en avertissement.",
        prompt:
          `Demande de calcul : ${texte}\n` +
          blocHistorique +
          contexteDossier +
          profilCalc +
          `\nDate du jour : ${new Date().toISOString().slice(0, 10)}`,
        toolName: "concevoir_calculateur",
        description: "Spécifie le calculateur interactif",
        schema: {
          type: "object",
          properties: {
            titre: { type: "string" },
            description: { type: "string" },
            champs: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: {
                type: "object",
                properties: {
                  id: { type: "string", pattern: "^[a-z][a-z0-9_]*$" },
                  label: { type: "string" },
                  type: { type: "string", enum: ["nombre", "curseur", "choix"] },
                  min: { type: "number" },
                  max: { type: "number" },
                  step: { type: "number" },
                  defaut: { type: "number" },
                  unite: { type: "string" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { valeur: { type: "number" }, label: { type: "string" } },
                      required: ["valeur", "label"],
                    },
                  },
                },
                required: ["id", "label", "type"],
              },
            },
            resultats: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  formule: { type: "string" },
                  format: { type: "string", enum: ["euros", "nombre", "pourcent"] },
                  accent: { type: "boolean" },
                },
                required: ["id", "label", "formule"],
              },
            },
            sources: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: { libelle: { type: "string" }, reference: { type: "string" } },
                required: ["libelle", "reference"],
              },
            },
            avertissements: { type: "array", items: { type: "string" } },
          },
          required: ["titre", "champs", "resultats", "sources"],
        },
        thinkingBudget: 5000,
        maxTokens: 8000,
      });

      spec.date_validite = new Date().toISOString().slice(0, 10);
      widget = { type: "calculatrice_dynamique", spec };
      contenu =
        "Ce calcul ne fait pas partie de mon catalogue certifié : je vous ai construit un calculateur " +
        "sur mesure ci-dessous. **Vérifiez les barèmes cités dans les sources et avertissements** — " +
        "contrairement aux calculateurs certifiés, celui-ci n'est pas verrouillé par des tests.";
    } else if (intent.kind === "audit") {
      // Audit conversationnel : le contexte d'abord — quel document, QUI je défends, l'objectif
      widget = {
        type: "audit_contexte",
        prefill: {
          document_hint: intent.document_vise ?? null,
          role: intent.role_vise ?? null,
        },
      };
      contenu =
        "Auditons ce contrat. L'analyse dépend entièrement de votre camp — les mêmes clauses ne " +
        "présentent pas les mêmes risques des deux côtés — et de votre objectif. Confirmez ces " +
        "éléments ci-dessous : je passerai ensuite le contrat au crible du référentiel (clauses " +
        "manquantes, illégales, défavorables, incohérences), avec le document surligné et mes notes en marge.";
    } else if (intent.kind === "generation" && intent.type_generation === "contrat") {
      widget = {
        type: "contrat_assistant",
        prefill: {
          type: intent.contrat_type && intent.contrat_type !== "autre" ? intent.contrat_type : null,
          role: intent.role_vise ?? null,
        },
      };
      contenu =
        "Créons ce contrat ensemble. Je vais vous poser les questions nécessaires une à une — " +
        "uniquement celles qui comptent pour ce type de contrat, chacune avec son pourquoi. " +
        "Vous pouvez passer une question : le contrat portera alors la mention [À COMPLÉTER].";
    } else if (intent.kind === "generation") {
      // Acte / courrier : imiter les MODÈLES du cabinet quand il y en a (docs/10)
      const { data: templates } = await admin
        .from("actes_templates")
        .select("id, nom_fichier, type_acte, description, analyse_ia, texte")
        .eq("org_id", org_id)
        .eq("statut", "ready");

      const profilGen = await contexteOrganisation(org_id);
      let modele = null;
      let modeleStyleSeul = false;

      if (templates?.length) {
        const choix = await structured({
          model: MODEL_FAST,
          system:
            "Vous choisissez le modèle du cabinet le plus adapté pour rédiger l'acte demandé. " +
            "match=exact si un modèle correspond à la nature de l'acte ; match=style si aucun ne " +
            "correspond mais qu'on peut au moins reprendre l'identité visuelle et le style du cabinet " +
            "depuis le modèle le plus proche ; match=aucun sinon.",
          prompt:
            `Acte demandé : ${texte}\n\nModèles disponibles :\n` +
            templates
              .map((t) => `- id=${t.id} | type=${t.type_acte} | ${t.nom_fichier} : ${t.description}`)
              .join("\n"),
          toolName: "choisir_modele",
          description: "Choisit le modèle à imiter",
          schema: {
            type: "object",
            properties: {
              match: { type: "string", enum: ["exact", "style", "aucun"] },
              template_id: { type: "string" },
            },
            required: ["match"],
          },
          maxTokens: 300,
        });
        modele = templates.find((t) => t.id === choix.template_id) ?? null;
        modeleStyleSeul = choix.match === "style" && !!modele;
        if (choix.match === "aucun") modele = null;
      }

      const systemGen =
        "Vous rédigez des actes juridiques français de niveau professionnel, prêts à l'emploi. Règles :\n" +
        "- Fondez chaque prétention sur ses textes et jurisprudences (citez précisément).\n" +
        "- Pour toute donnée manquante : [À COMPLÉTER : description précise].\n" +
        "- Markdown propre. Terminez par « Notes pour l'utilisateur » (envoi, délais, étape suivante).\n" +
        (modele
          ? modeleStyleSeul
            ? "- Vous disposez d'un modèle du cabinet d'une AUTRE nature : reprenez-en fidèlement " +
              "l'EN-TÊTE, le pied de page et le STYLE (ton, numérotation, formules), mais construisez " +
              "la structure adaptée à l'acte demandé.\n"
            : "- IMITEZ le modèle du cabinet fourni : même en-tête (reproduit à l'identique), même " +
              "structure de sections, même style, mêmes formules. ADAPTEZ le contenu au cas présent : " +
              "ajoutez ou retirez des sections si le cas l'exige — le modèle est un cadre, pas un carcan.\n"
          : "");

      const promptGen =
        `Demande : ${texte}\n` +
        blocHistorique +
        contexteDossier +
        profilGen +
        (modele
          ? `\nMODÈLE DU CABINET (${modele.nom_fichier}) :\n` +
            `Analyse : ${JSON.stringify(modele.analyse_ia)}\n` +
            `Texte intégral du modèle :\n---\n${(modele.texte ?? "").slice(0, 25000)}\n---\n`
          : "") +
        `\nRédigez l'acte complet.`;

      const contenuActe = await deepText({
        system: systemGen,
        prompt: promptGen,
        thinkingBudget: 6000,
        maxTokens: 12000,
      });

      const titreActe = `${(modele?.type_acte ?? intent.type_generation ?? "acte").replace(/_/g, " ")} — ${new Date().toLocaleDateString("fr-FR")}`;
      const { data: genDoc } = await admin
        .from("generated_documents")
        .insert({
          org_id,
          type: modele ? `acte_modele_${modele.type_acte}` : "acte_libre",
          titre: titreActe,
          reponses: { demande: texte, template_id: modele?.id ?? null },
          contenu: contenuActe,
          created_by: auth.user.id,
        })
        .select()
        .single();

      widget = genDoc ? { type: "document_genere", document_id: genDoc.id, titre: genDoc.titre } : null;
      contenu = modele
        ? modeleStyleSeul
          ? `J'ai rédigé l'acte en reprenant l'identité et le style de votre cabinet (d'après « ${modele.nom_fichier} »). ` +
            `Vous n'avez pas encore de modèle pour ce type d'acte précis : déposez-en un dans ` +
            `[Modèles d'actes](/modeles) et je le suivrai à la lettre la prochaine fois.`
          : `J'ai rédigé l'acte en suivant votre modèle « ${modele.nom_fichier} » — en-tête, structure et ` +
            `style du cabinet, adaptés au cas présent. Relisez et complétez les champs [À COMPLÉTER].`
        : `J'ai rédigé l'acte au format professionnel standard. Pour que je reprenne l'en-tête, la ` +
          `structure et le style exacts de votre cabinet, déposez vos propres modèles dans ` +
          `[Modèles d'actes](/modeles) — je les imiterai systématiquement.`;
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
          "- DROIT DES AFFAIRES INTERNATIONALES : vous maîtrisez l'arbitrage (clauses compromissoires, " +
          "principe compétence-compétence, règles matérielles du droit de l'arbitrage, lex mercatoria, " +
          "Convention de New York de 1958, règlements ICC/LCIA), le droit international privé (règles de " +
          "conflit de lois et de juridictions, règlements Rome I/II et Bruxelles I bis, lois de police) " +
          "et les contrats de common law (consideration, representations & warranties, indemnities, " +
          "liquidated damages…) : lisez les clauses en version originale, citez-les en VO, expliquez les " +
          "concepts et leurs risques pour un juriste français. Répondez en français.\n" +
          "- Calibrez la longueur sur la complexité : une question simple mérite une réponse courte.",
        prompt:
          `Complexité évaluée : ${intent.complexite}\n` +
          blocHistorique +
          contexteDossier +
          `Extraits des documents de l'organisation :\n${contexte}\n` +
          profil +
          `\nDemande : ${texte}`,
        thinkingBudget: profondeur.thinkingBudget,
        maxTokens: profondeur.maxTokens,
      });

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
