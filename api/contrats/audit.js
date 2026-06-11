import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, MODEL_SMART } from "../_lib/claude.js";
import { extraireTexte } from "../_lib/extract-text.js";
import { getReferentiel } from "../_lib/referentiels.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { document_id, role, objectif } = req.body ?? {};
  if (!document_id || !role || !objectif) {
    return res.status(400).json({ error: "document_id, role et objectif requis" });
  }

  const { data: doc } = await admin
    .from("documents")
    .select("*")
    .eq("id", document_id)
    .maybeSingle();
  if (!doc) return res.status(404).json({ error: "Document introuvable" });
  if (doc.statut !== "ready") {
    return res.status(409).json({ error: "Le document doit être traité (type confirmé) avant l'audit" });
  }

  const auth = await requireOrgMember(req, res, doc.org_id);
  if (!auth) return;

  const ref = getReferentiel(doc.type_confirme);
  if (ref.roles.length && !ref.roles.includes(role)) {
    return res.status(400).json({ error: `Rôle invalide pour ce type : ${ref.roles.join(" / ")}` });
  }

  // Vérification de l'entitlement Raader
  const { data: ent } = await admin
    .from("entitlements")
    .select("active")
    .eq("org_id", doc.org_id)
    .eq("module", "raader")
    .maybeSingle();
  if (!ent?.active) {
    return res.status(403).json({ error: "Le module Raader n'est pas activé pour votre organisation" });
  }

  const { data: audit, error: insertError } = await admin
    .from("audits")
    .insert({
      org_id: doc.org_id,
      document_id: doc.id,
      role,
      objectif,
      referentiel_id: ref.meta.id,
      referentiel_version: ref.meta.version,
      created_by: auth.user.id,
    })
    .select()
    .single();
  if (insertError) return res.status(500).json({ error: insertError.message });

  try {
    let texte = doc.texte;
    if (!texte) {
      const { data: blob, error: dlError } = await admin.storage
        .from("documents")
        .download(doc.storage_path);
      if (dlError) throw new Error(`Fichier inaccessible : ${dlError.message}`);
      ({ texte } = await extraireTexte(Buffer.from(await blob.arrayBuffer()), doc.mime));
    }

    const OBJECTIFS = {
      signer: "l'utilisateur s'apprête à signer ce contrat",
      renegocier: "l'utilisateur veut renégocier ce contrat en cours",
      sortir: "l'utilisateur cherche à sortir de ce contrat",
      comprendre: "l'utilisateur veut comprendre ses engagements",
    };

    const resultat = await structured({
      model: MODEL_SMART,
      system:
        "Vous êtes l'auditeur de contrats d'une plateforme juridique française. " +
        "Vous auditez un contrat POUR LE CAMP de l'utilisateur, à partir d'un référentiel " +
        "du type de contrat. Règles :\n" +
        "- Chaque constat cite le passage EXACT du contrat concerné (copie verbatim, courte).\n" +
        "- Chaque constat est expliqué pédagogiquement (vouvoiement) avec son fondement juridique précis.\n" +
        "- Chaque constat propose une reformulation concrète de la clause, prête à copier.\n" +
        "- Catégories : manquante (clause attendue absente), illegale (illégale ou réputée non écrite), " +
        "defavorable (licite mais déséquilibrée contre le camp de l'utilisateur), incoherence " +
        "(contradictions internes : montants, dates, renvois cassés, définitions contradictoires).\n" +
        "- N'inventez rien : si le contrat est correct sur un point, ne créez pas de constat artificiel.\n" +
        "- Score de risque global 0 (aucun risque) à 100 (très dangereux), cohérent avec la gravité des constats.\n" +
        "- La synthèse est une page exécutive : situation, 3-5 points clés, recommandation d'action.",
      prompt:
        `Type de contrat : ${ref.meta.nom}\n` +
        `Camp de l'utilisateur : ${role}\n` +
        `Objectif : ${OBJECTIFS[objectif] ?? objectif}\n\n` +
        `Référentiel — clauses attendues :\n${JSON.stringify(ref.clauses_attendues, null, 2)}\n\n` +
        `Référentiel — clauses pièges/illégales :\n${JSON.stringify(ref.clauses_pieges, null, 2)}\n\n` +
        `Contrat à auditer :\n---\n${texte.slice(0, 90000)}\n---`,
      toolName: "rendre_audit",
      description: "Restitue l'audit structuré du contrat",
      schema: {
        type: "object",
        properties: {
          score: { type: "integer", minimum: 0, maximum: 100 },
          synthese: { type: "string", description: "Synthèse exécutive d'une page, en français, vouvoiement" },
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                categorie: { type: "string", enum: ["manquante", "illegale", "defavorable", "incoherence"] },
                titre: { type: "string" },
                passage: { type: "string", description: "Citation exacte du contrat (vide si clause manquante)" },
                gravite: { type: "string", enum: ["mineure", "moyenne", "majeure"] },
                fondement: { type: "string" },
                explication: { type: "string" },
                reformulation: { type: "string", description: "Clause de remplacement proposée" },
              },
              required: ["categorie", "titre", "gravite", "explication"],
            },
          },
        },
        required: ["score", "synthese", "findings"],
      },
      maxTokens: 16000,
    });

    const findings = (resultat.findings ?? []).map((f, i) => ({
      audit_id: audit.id,
      org_id: doc.org_id,
      categorie: f.categorie,
      titre: f.titre,
      passage: f.passage || null,
      gravite: f.gravite,
      fondement: f.fondement || null,
      explication: f.explication,
      reformulation: f.reformulation || null,
      ordre: i,
    }));
    if (findings.length) {
      const { error: fError } = await admin.from("audit_findings").insert(findings);
      if (fError) throw new Error(fError.message);
    }

    const { data: done } = await admin
      .from("audits")
      .update({ statut: "done", score: resultat.score, synthese: resultat.synthese })
      .eq("id", audit.id)
      .select()
      .single();

    await logAudit(doc.org_id, auth.user.id, "contrat.audit", "audit", audit.id, {
      document_id: doc.id,
      type: ref.meta.id,
      role,
      objectif,
      score: resultat.score,
      findings: findings.length,
    });

    return res.status(200).json({ audit: done });
  } catch (e) {
    console.error("[Holbert API] audit:", e);
    await admin
      .from("audits")
      .update({ statut: "error", erreur: e.message })
      .eq("id", audit.id);
    return res.status(500).json({ error: `Audit échoué : ${e.message}` });
  }
}
