import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, deepText, MODEL_FAST } from "../_lib/claude.js";
import { embed } from "../_lib/openai.js";
import { verifierCitations } from "../_lib/legifrance.js";
import { rechercherJurisprudence } from "../_lib/judilibre.js";
import { verifierCelex } from "../_lib/eurlex.js";
import { contexteOrganisation } from "../_lib/org-context.js";
import { secretInterneValide, declencherEtape } from "../_lib/recherche-chain.js";

/** Verrou simple : une étape "en_cours" plus récente que ce délai = travail en cours. */
const VERROU_MS = 150000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { recherche_id } = req.body ?? {};
  if (!recherche_id) return res.status(400).json({ error: "recherche_id manquant" });

  const { data: recherche } = await admin
    .from("recherches")
    .select("*")
    .eq("id", recherche_id)
    .maybeSingle();
  if (!recherche) return res.status(404).json({ error: "Recherche introuvable" });

  // Auth : chaîne interne OU membre de l'org (filet côté client)
  if (!secretInterneValide(req)) {
    const auth = await requireOrgMember(req, res, recherche.org_id);
    if (!auth) return;
  }

  if (recherche.statut !== "en_cours") {
    return res.status(200).json({ statut: recherche.statut });
  }

  // Verrou anti-double-traitement (le front et la chaîne peuvent appeler en même temps)
  const enCours = recherche.questions.find((q) => q.statut === "en_cours");
  if (enCours && Date.now() - new Date(recherche.updated_at).getTime() < VERROU_MS) {
    return res.status(200).json({ statut: "en_cours", info: "étape déjà en traitement" });
  }

  const questions = [...recherche.questions];
  const cible = enCours ?? questions.find((q) => q.statut === "a_faire");

  try {
    if (cible) {
      await traiterQuestion(recherche, questions, cible);
      const restantes = questions.filter((q) => q.statut !== "fait").length;
      if (restantes > 0) declencherEtape(recherche.id);
      else declencherEtape(recherche.id); // dernière passe : assemblage
      return res.status(200).json({ statut: "en_cours", question_traitee: cible.id });
    }

    // Toutes les questions sont faites → assemblage final
    if (!recherche.document) {
      await assembler(recherche, questions);
      return res.status(200).json({ statut: "terminee" });
    }
    return res.status(200).json({ statut: recherche.statut });
  } catch (e) {
    console.error("[Hofraad API] recherche etape:", e);
    await admin
      .from("recherches")
      .update({ statut: "erreur", erreur: e.message })
      .eq("id", recherche.id);
    return res.status(500).json({ error: e.message });
  }
}

// ---------------------------------------------------------------------------
async function traiterQuestion(recherche, questions, cible) {
  const idx = questions.findIndex((q) => q.id === cible.id);
  const faites = questions.filter((q) => q.statut === "fait").length;

  // Claim
  questions[idx] = { ...cible, statut: "en_cours" };
  await admin
    .from("recherches")
    .update({
      questions,
      etape_courante: `recherche : ${cible.question.slice(0, 80)}…`,
      progression: Math.min(95, 5 + Math.round((faites / questions.length) * 88)),
    })
    .eq("id", recherche.id);

  // 1. Plan de recherche (rapide)
  const plan = await structured({
    model: MODEL_FAST,
    system:
      "Vous préparez les requêtes de recherche pour une question juridique française. " +
      "dimension_ue : identifiants CELEX UNIQUEMENT si un texte européen précis est pertinent (ex. 32016R0679).",
    prompt: `Question : ${cible.question}\nContexte du cas : ${recherche.comprehension ?? recherche.question_initiale}`,
    toolName: "plan_recherche",
    description: "Prépare les requêtes",
    schema: {
      type: "object",
      properties: {
        requete_jurisprudence: { type: "string", description: "Mots-clés pour la recherche Judilibre (Cour de cassation)" },
        requete_documents: { type: "string", description: "Requête pour la base documentaire de l'organisation" },
        celex: { type: "array", items: { type: "string" }, description: "0 à 2 identifiants CELEX si dimension UE" },
      },
      required: ["requete_jurisprudence", "requete_documents"],
    },
    maxTokens: 500,
  });

  // 2. Recherches parallèles
  const [jurisprudence, docsOrg, actesUe] = await Promise.all([
    rechercherJurisprudence(plan.requete_jurisprudence, 6).catch(() => []),
    (async () => {
      try {
        const [emb] = await embed([plan.requete_documents]);
        const { data } = await admin.rpc("match_chunks", {
          p_org: recherche.org_id,
          p_embedding: emb,
          p_count: 5,
        });
        const hits = (data ?? []).filter((c) => c.similarite > 0.25);
        if (!hits.length) return [];
        const ids = [...new Set(hits.map((h) => h.document_id))];
        const { data: docs } = await admin
          .from("documents")
          .select("id, nom_fichier")
          .in("id", ids);
        const noms = Object.fromEntries((docs ?? []).map((d) => [d.id, d.nom_fichier]));
        return hits.map((h) => ({
          type: "document",
          titre: noms[h.document_id] ?? "Document",
          reference: `document de l'organisation`,
          url: `/documents/${h.document_id}`,
          extrait: h.contenu.slice(0, 400),
        }));
      } catch {
        return [];
      }
    })(),
    Promise.all(
      (plan.celex ?? []).slice(0, 2).map(async (c) => {
        const v = await verifierCelex(c);
        return v.existe
          ? { type: "eu", titre: `Acte UE CELEX ${c}`, reference: c, url: v.url }
          : null;
      })
    ).then((arr) => arr.filter(Boolean)),
  ]);

  // 3. Rédaction de la section (réflexion profonde)
  const profil = await contexteOrganisation(recherche.org_id);
  const section = await deepText({
    system:
      "Vous êtes Hofraad, assistant de recherche juridique pour professionnels du droit. Vous rédigez " +
      "la SECTION d'un document de synthèse consacrée à UNE question juridique. Règles impératives :\n" +
      "- Structure : rappel de la question, principes applicables (textes cités précisément), " +
      "jurisprudence, application au cas, réponse opérationnelle nuancée.\n" +
      "- Ne citez de jurisprudence QUE parmi les décisions fournies ci-dessous (résultats Judilibre " +
      "vérifiés) — si aucune ne convient, dites que la jurisprudence fournie ne tranche pas ce point.\n" +
      "- Citez les articles de codes avec précision (ils seront vérifiés sur Légifrance).\n" +
      "- Utilisez les extraits des documents de l'organisation quand ils éclairent le cas.\n" +
      "- Distinguez le certain du discuté. Markdown, vouvoiement, pas d'emojis.",
    prompt:
      `Cas (compréhension validée) : ${recherche.comprehension ?? recherche.question_initiale}\n` +
      profil +
      `\nQUESTION TRAITÉE : ${cible.question}\n` +
      (cible.justification ? `Pourquoi elle se pose : ${cible.justification}\n` : "") +
      `\nJurisprudence disponible (Judilibre) :\n${
        jurisprudence.length
          ? jurisprudence.map((j) => `- ${j.titre}${j.solution ? ` (${j.solution})` : ""} : ${j.extrait}`).join("\n")
          : "(aucun résultat pertinent)"
      }\n` +
      `\nActes UE vérifiés :\n${actesUe.length ? actesUe.map((a) => `- ${a.titre}`).join("\n") : "(sans objet)"}\n` +
      `\nExtraits des documents de l'organisation :\n${
        docsOrg.length ? docsOrg.map((d, i) => `[${i + 1}] (${d.titre}) ${d.extrait}`).join("\n") : "(aucun)"
      }`,
    thinkingBudget: 6000,
    maxTokens: 10000,
  });

  // 4. Vérification Légifrance des articles cités dans la section
  let textes = [];
  try {
    textes = (await verifierCitations(section)).map((s) => ({
      type: "texte",
      titre: s.citation,
      reference: `${s.code}${s.etat ? ` — ${s.etat === "VIGUEUR" ? "en vigueur" : "version à vérifier"}` : ""}`,
      url: s.url,
    }));
  } catch (e) {
    console.error("[Hofraad API] vérif citations:", e.message);
  }

  questions[idx] = {
    ...cible,
    statut: "fait",
    section,
    sources: [...textes, ...jurisprudence, ...actesUe, ...docsOrg],
  };

  const demarche = [
    ...(recherche.demarche ?? []),
    {
      etape: cible.id,
      detail:
        `Judilibre : « ${plan.requete_jurisprudence} » (${jurisprudence.length} décision(s)) · ` +
        `base documentaire : « ${plan.requete_documents} » (${docsOrg.length} passage(s)) · ` +
        `articles vérifiés Légifrance : ${textes.length} · actes UE : ${actesUe.length}`,
    },
  ];

  const faitsApres = questions.filter((q) => q.statut === "fait").length;
  await admin
    .from("recherches")
    .update({
      questions,
      demarche,
      progression: Math.min(95, 5 + Math.round((faitsApres / questions.length) * 88)),
      etape_courante:
        faitsApres < questions.length ? "question suivante" : "assemblage du document",
    })
    .eq("id", recherche.id);
}

// ---------------------------------------------------------------------------
async function assembler(recherche, questions) {
  const conclusion = await deepText({
    system:
      "Vous êtes Hofraad. Rédigez la CONCLUSION OPÉRATIONNELLE d'un document de synthèse juridique " +
      "dont les sections d'analyse sont déjà écrites : 1) réponse d'ensemble en quelques lignes, " +
      "2) recommandations concrètes hiérarchisées, 3) points de vigilance et zones d'incertitude. " +
      "Markdown, concis, vouvoiement.",
    prompt:
      `Cas : ${recherche.comprehension ?? recherche.question_initiale}\n\n` +
      `Réponses aux questions traitées (résumés) :\n` +
      questions.map((q) => `## ${q.question}\n${(q.section ?? "").slice(0, 1500)}`).join("\n\n"),
    thinkingBudget: 3000,
    maxTokens: 4000,
  });

  const sourcesUniques = [];
  const vues = new Set();
  for (const q of questions) {
    for (const s of q.sources ?? []) {
      const cle = `${s.type}|${s.titre}`;
      if (!vues.has(cle)) {
        vues.add(cle);
        sourcesUniques.push(s);
      }
    }
  }

  const document =
    `# Synthèse de recherche juridique\n\n` +
    `## Le cas\n\n${recherche.comprehension ?? recherche.question_initiale}\n\n` +
    questions.map((q, i) => `# ${i + 1}. ${q.question}\n\n${q.section ?? ""}`).join("\n\n") +
    `\n\n# Conclusion opérationnelle\n\n${conclusion}\n\n` +
    `# Table des sources\n\n` +
    sourcesUniques
      .map((s) => `- ${s.titre} — ${s.reference}${s.url ? ` — ${s.url}` : ""}`)
      .join("\n") +
    `\n\n---\n*Document produit par Hofraad — information juridique et aide à la décision. ` +
    `Les sources citées ont été vérifiées (Légifrance, Judilibre, EUR-Lex) à la date de production ; ` +
    `la démarche de recherche est consultable dans le détail de la recherche.*`;

  await admin
    .from("recherches")
    .update({
      document,
      statut: "terminee",
      etape_courante: "terminée",
      progression: 100,
    })
    .eq("id", recherche.id);

  // Message dans la conversation + notification
  await admin.from("messages").insert({
    conversation_id: recherche.conversation_id,
    org_id: recherche.org_id,
    role: "assistant",
    contenu:
      "**Votre recherche approfondie est terminée.** Le document de synthèse ci-dessous couvre " +
      `${questions.length} question(s), avec ${sourcesUniques.length} source(s) vérifiée(s).`,
    widget: { type: "recherche_resultat", recherche_id: recherche.id },
  });

  await admin.from("notifications").insert({
    org_id: recherche.org_id,
    user_id: recherche.created_by,
    titre: "Votre recherche approfondie est prête",
    corps: recherche.question_initiale.slice(0, 120),
    lien: "/assistant",
  });

  await logAudit(recherche.org_id, recherche.created_by, "recherche.terminee", "recherche", recherche.id, {
    questions: questions.length,
    sources: sourcesUniques.length,
  });
}
