import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, deepText, MODEL_FAST } from "../_lib/claude.js";
import { rechercherJurisprudence } from "../_lib/judilibre.js";
import { verifierCitations } from "../_lib/legifrance.js";
import { contexteOrganisation } from "../_lib/org-context.js";
import { secretInterneValide, declencher } from "../_lib/recherche-chain.js";

/** Verrou simple : une étape "en_cours" plus récente que ce délai = travail en cours. */
const VERROU_MS = 150000;
const TAILLE_LOT = 3;

const CAMP_LIBELLE = { nous: "NOTRE pièce", adverse: "pièce ADVERSE", procedure: "acte de procédure" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { scan_id } = req.body ?? {};
  if (!scan_id) return res.status(400).json({ error: "scan_id manquant" });

  const { data: scan } = await admin.from("scans_dossier").select("*").eq("id", scan_id).maybeSingle();
  if (!scan) return res.status(404).json({ error: "Scan introuvable" });

  if (!secretInterneValide(req)) {
    const auth = await requireOrgMember(req, res, scan.org_id);
    if (!auth) return;
  }

  if (scan.statut === "terminee") return res.status(200).json({ statut: "terminee" });

  // Reprise après erreur (bouton Réessayer côté front)
  if (scan.statut === "erreur") {
    await admin.from("scans_dossier").update({ statut: "en_cours", erreur: null }).eq("id", scan.id);
    scan.statut = "en_cours";
  }

  const etapes = [...scan.etapes];
  const enCours = etapes.find((e) => e.statut === "en_cours");
  if (enCours && Date.now() - new Date(scan.updated_at).getTime() < VERROU_MS) {
    return res.status(200).json({ statut: "en_cours", info: "étape déjà en traitement" });
  }
  if (enCours) enCours.statut = "a_faire"; // verrou expiré : on relance l'étape

  const etape = etapes.find((e) => e.statut === "a_faire");
  if (!etape) return res.status(200).json({ statut: scan.statut });

  // Claim
  etape.statut = "en_cours";
  await admin
    .from("scans_dossier")
    .update({ etapes, etape_courante: etape.label })
    .eq("id", scan.id);

  const donnees = { ...scan.donnees };
  const demarche = [...scan.demarche];

  try {
    const { data: dossier } = await admin
      .from("dossiers")
      .select("*")
      .eq("id", scan.dossier_id)
      .single();

    if (etape.id === "comprehension") {
      const [{ data: pieces }, { data: evenements }] = await Promise.all([
        admin
          .from("pieces")
          .select("camp, numero, intitule, date_piece")
          .eq("dossier_id", scan.dossier_id)
          .order("camp")
          .order("numero"),
        admin
          .from("evenements")
          .select("date, titre, description")
          .eq("dossier_id", scan.dossier_id)
          .order("date"),
      ]);
      const profil = await contexteOrganisation(scan.org_id);
      donnees.chronologie = (evenements ?? [])
        .map((e) => `${e.date} — ${e.titre}${e.description ? ` (${e.description.slice(0, 120)})` : ""}`)
        .join("\n");
      donnees.inventaire = (pieces ?? [])
        .map((p) => `[${CAMP_LIBELLE[p.camp]} n° ${p.numero}] ${p.intitule}${p.date_piece ? ` — ${p.date_piece}` : " — NON DATÉE"}`)
        .join("\n");

      donnees.comprehension = await deepText({
        system:
          "Vous êtes l'associé contentieux qui prend connaissance d'un dossier. Restituez : qui nous " +
          "défendons et contre qui, la nature du litige, les positions probables de chaque partie, " +
          "l'objectif du client, l'état de la procédure, et ce qui manque au dossier. Concis et précis.",
        prompt:
          `Dossier : ${dossier.nom}\n` +
          `Parties : ${JSON.stringify(dossier.parties)} · Juridiction : ${dossier.juridiction ?? "?"} · ` +
          `Procédure : ${dossier.type_procedure ?? "?"} · Enjeu : ${dossier.enjeu_financier ?? "?"} €\n` +
          profil +
          `\nCe que l'utilisateur explique :\n${scan.contexte}\n\n` +
          `Inventaire des pièces :\n${donnees.inventaire}\n\nChronologie :\n${donnees.chronologie || "(vide)"}`,
        thinkingBudget: 3000,
        maxTokens: 4000,
      });
      demarche.push({ etape: "Compréhension", detail: "Litige, parties et objectif reconstitués" });
    }

    if (etape.id.startsWith("lecture_")) {
      const lot = Number(etape.id.split("_")[1]);
      const ids = (donnees.pieces_ids ?? []).slice(lot * TAILLE_LOT, (lot + 1) * TAILLE_LOT);
      const { data: piecesLot } = await admin
        .from("pieces")
        .select("camp, numero, intitule, date_piece, documents(nom_fichier, texte)")
        .in("id", ids);

      const fiches = await structured({
        model: MODEL_FAST,
        system:
          "Vous faites les fiches de lecture des pièces d'un dossier contentieux. Pour CHAQUE pièce : " +
          "résumé factuel, éléments UTILES à notre cause, éléments à RISQUE pour nous, dates clés. " +
          "Soyez factuel — pas d'interprétation au-delà du document.",
        prompt:
          `Contexte du litige :\n${(donnees.comprehension ?? "").slice(0, 2500)}\n\n` +
          (piecesLot ?? [])
            .map(
              (p) =>
                `=== ${CAMP_LIBELLE[p.camp]} n° ${p.numero} — ${p.intitule} (${p.date_piece ?? "non datée"}) ===\n` +
                `${(p.documents?.texte ?? "").slice(0, 9000)}`
            )
            .join("\n\n"),
        toolName: "fiches_lecture",
        description: "Fiches de lecture des pièces du lot",
        schema: {
          type: "object",
          properties: {
            fiches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  piece: { type: "string", description: "Référence de la pièce (camp + numéro + intitulé)" },
                  resume: { type: "string" },
                  elements_utiles: { type: "array", items: { type: "string" } },
                  elements_risque: { type: "array", items: { type: "string" } },
                  dates_cles: { type: "array", items: { type: "string" } },
                },
                required: ["piece", "resume", "elements_utiles", "elements_risque"],
              },
            },
          },
          required: ["fiches"],
        },
        maxTokens: 4000,
      });
      donnees.fiches = [...(donnees.fiches ?? []), ...fiches.fiches];
      demarche.push({ etape: etape.label, detail: `${fiches.fiches.length} pièce(s) lue(s)` });
    }

    if (etape.id === "strategie" || etape.id === "vices") {
      const angle =
        etape.id === "strategie"
          ? "stratégie procédurale et précontentieuse du litige"
          : "vices de procédure, nullités, prescription, forclusion dans ce litige";
      const plan = await structured({
        model: MODEL_FAST,
        system: "Vous préparez des requêtes de recherche jurisprudentielle (Cour de cassation) ciblées.",
        prompt:
          `Litige :\n${(donnees.comprehension ?? "").slice(0, 2000)}\n\nAngle : ${angle}\n` +
          `Donnez 2 requêtes de recherche courtes et complémentaires.`,
        toolName: "plan_recherche",
        description: "Requêtes Judilibre",
        schema: {
          type: "object",
          properties: { requetes: { type: "array", items: { type: "string" }, maxItems: 2 } },
          required: ["requetes"],
        },
        maxTokens: 300,
      });

      const resultats = (
        await Promise.all((plan.requetes ?? []).slice(0, 2).map((q) => rechercherJurisprudence(q, 5).catch(() => [])))
      ).flat();
      const vues = new Set();
      const jurisprudence = resultats.filter((j) => !vues.has(j.url) && vues.add(j.url));
      donnees[`sources_${etape.id}`] = jurisprudence;

      const fichesTxt = (donnees.fiches ?? [])
        .map(
          (f) =>
            `• ${f.piece} : ${f.resume}\n  Utile : ${(f.elements_utiles ?? []).join(" ; ")}\n  Risque : ${(f.elements_risque ?? []).join(" ; ")}`
        )
        .join("\n");
      const jurisTxt = jurisprudence.length
        ? jurisprudence.map((j) => `- ${j.titre} (${j.reference}) ${j.url}\n  ${(j.extrait ?? "").slice(0, 300)}`).join("\n")
        : "(aucune décision trouvée — ne citez AUCUNE jurisprudence)";

      const profil = await contexteOrganisation(scan.org_id);

      donnees[etape.id] = await deepText({
        system:
          (etape.id === "strategie"
            ? "Vous êtes l'avocat associé qui arrête la STRATÉGIE d'un dossier contentieux. Produisez :\n" +
              "1) la séquence recommandée, étape par étape, dans l'ordre (amiable ? mise en demeure ? " +
              "médiation/conciliation OBLIGATOIRE si une clause ou la loi l'impose — vérifiez dans les " +
              "pièces ; assignation ?), avec pour CHAQUE étape : son fondement, son DÉLAI (déclencheur " +
              "et échéance) et ce qu'elle apporte ;\n" +
              "2) les forces du dossier (pièces visées par leur numéro) ;\n" +
              "3) les faiblesses et comment les neutraliser ;\n" +
              "4) une estimation réaliste des issues possibles.\n"
            : "Vous êtes l'avocat qui traque les VICES DE PROCÉDURE dans les deux sens :\n" +
              "1) CONTRE LA PARTIE ADVERSE : irrégularités de leurs actes (mentions obligatoires, " +
              "délais, signification, compétence), prescription/forclusion de leurs demandes — chaque " +
              "point avec fondement et conséquence (nullité, irrecevabilité…) ;\n" +
              "2) SUR NOS PROPRES ACTES : ce qui pourrait nous être opposé, et comment le purger ou " +
              "le sécuriser AVANT qu'il soit trop tard, avec les délais.\n" +
              "Classez par gravité. Visez les pièces par leur numéro.\n") +
          "Ne citez de jurisprudence QUE parmi les décisions fournies (avec leur lien). Citez les " +
          "textes précisément. Markdown, vouvoiement. Si une information manque, dites quoi demander.",
        prompt:
          `Compréhension du litige :\n${donnees.comprehension}\n\n` +
          profil +
          `\nFiches de lecture des pièces :\n${fichesTxt.slice(0, 22000)}\n\n` +
          `Chronologie :\n${(donnees.chronologie ?? "").slice(0, 4000)}\n\n` +
          `Jurisprudence disponible (Cour de cassation) :\n${jurisTxt}\n\n` +
          `Rédigez la section.`,
        thinkingBudget: 8000,
        maxTokens: 10000,
      });
      demarche.push({
        etape: etape.label,
        detail: `${plan.requetes?.join(" / ") ?? ""} — ${jurisprudence.length} décision(s) examinée(s)`,
      });
    }

    if (etape.id === "assemblage") {
      const conclusion = await deepText({
        system:
          "Vous concluez le scan d'un dossier contentieux : LA recommandation opérationnelle — " +
          "prochaine action concrète, son délai, puis les 3-5 actions suivantes dans l'ordre. Direct.",
        prompt:
          `Compréhension :\n${(donnees.comprehension ?? "").slice(0, 2000)}\n\n` +
          `Stratégie :\n${(donnees.strategie ?? "").slice(0, 5000)}\n\n` +
          `Vices :\n${(donnees.vices ?? "").slice(0, 5000)}`,
        thinkingBudget: 2500,
        maxTokens: 2500,
      });

      const sourcesJuris = [...(donnees.sources_strategie ?? []), ...(donnees.sources_vices ?? [])];
      const vues = new Set();
      const sourcesUniques = sourcesJuris.filter((s) => !vues.has(s.url) && vues.add(s.url));

      const verif = await verifierCitations(`${donnees.strategie ?? ""}\n${donnees.vices ?? ""}`).catch(() => []);

      const document =
        `# Scan du dossier — ${dossier.nom}\n\n` +
        `*Établi le ${new Date().toLocaleDateString("fr-FR")} sur ${(donnees.pieces_ids ?? []).length} pièce(s).*` +
        (donnees.pieces_ignorees ? ` *(${donnees.pieces_ignorees} pièce(s) au-delà de la limite non lues.)*` : "") +
        `\n\n## I. Compréhension du litige\n\n${donnees.comprehension}\n\n` +
        `## II. Stratégie recommandée et délais\n\n${donnees.strategie}\n\n` +
        `## III. Vices de procédure et sécurisation\n\n${donnees.vices}\n\n` +
        `## IV. Conclusion opérationnelle\n\n${conclusion}\n\n` +
        `## V. Fiches de lecture\n\n` +
        (donnees.fiches ?? [])
          .map((f) => `**${f.piece}** — ${f.resume}\n- Utile : ${(f.elements_utiles ?? []).join(" ; ") || "—"}\n- Risque : ${(f.elements_risque ?? []).join(" ; ") || "—"}`)
          .join("\n\n") +
        (sourcesUniques.length
          ? `\n\n## Table des sources\n\n${sourcesUniques.map((s) => `- ${s.titre} (${s.reference}) — ${s.url}`).join("\n")}`
          : "") +
        (verif.length
          ? `\n\n*Articles cités vérifiés sur Légifrance : ${verif.filter((v) => v.trouve).length}/${verif.length} confirmés en vigueur.*`
          : "") +
        `\n\n---\n*Scan établi par Hofraad — signalements à vérifier par l'avocat, pas des conclusions définitives.*`;

      donnees.document_pret = true;
      etape.statut = "fait";
      const faits = etapes.filter((e) => e.statut === "fait").length;
      await admin
        .from("scans_dossier")
        .update({
          etapes,
          donnees,
          demarche,
          document,
          statut: "terminee",
          progression: 100,
          etape_courante: "terminé",
        })
        .eq("id", scan.id);

      await admin.from("notifications").insert({
        org_id: scan.org_id,
        user_id: scan.created_by,
        titre: "Le scan de votre dossier est prêt",
        corps: dossier.nom.slice(0, 120),
        lien: `/pleiter/dossiers/${scan.dossier_id}`,
      });
      await logAudit(scan.org_id, scan.created_by, "dossier.scan_termine", "scan_dossier", scan.id, {
        etapes: faits,
        sources: sourcesUniques.length,
      });
      return res.status(200).json({ statut: "terminee" });
    }

    // Étape (hors assemblage) terminée : enregistrer puis chaîner la suivante
    etape.statut = "fait";
    const faits = etapes.filter((e) => e.statut === "fait").length;
    await admin
      .from("scans_dossier")
      .update({
        etapes,
        donnees,
        demarche,
        progression: Math.min(95, 2 + Math.round((93 * faits) / etapes.length)),
        etape_courante: etapes.find((e) => e.statut === "a_faire")?.label ?? "assemblage",
      })
      .eq("id", scan.id);

    declencher("/api/dossiers/scan-etape", { scan_id: scan.id });
    return res.status(200).json({ statut: "en_cours", etape: etape.id });
  } catch (e) {
    console.error("[Hofraad API] scan-etape:", e);
    etape.statut = "a_faire";
    await admin
      .from("scans_dossier")
      .update({ etapes, statut: "erreur", erreur: `${etape.label} : ${e.message}` })
      .eq("id", scan.id);
    return res.status(500).json({ error: e.message });
  }
}
