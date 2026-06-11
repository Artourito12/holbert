import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { structured, MODEL_FAST } from "../_lib/claude.js";

/**
 * Classement d'une pièce de dossier après ingestion : l'IA lit la pièce et
 * propose un intitulé de bordereau professionnel + la date qu'elle porte.
 * Si aucune date fiable n'est trouvée, c'est à l'utilisateur de la saisir
 * (la pièce reste « à dater » — docs/10 phase 1).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { piece_id } = req.body ?? {};
  if (!piece_id) return res.status(400).json({ error: "piece_id manquant" });

  const { data: piece } = await admin
    .from("pieces")
    .select("*, documents(id, nom_fichier, texte, statut, version_de)")
    .eq("id", piece_id)
    .maybeSingle();
  if (!piece) return res.status(404).json({ error: "Pièce introuvable" });

  const auth = await requireOrgMember(req, res, piece.org_id);
  if (!auth) return;

  const doc = piece.documents;
  if (!doc?.texte) {
    return res.status(409).json({ error: "Document pas encore traité — relancez après l'ingestion." });
  }

  try {
    const CAMP_LIBELLE = {
      nous: "pièce produite par NOTRE partie",
      adverse: "pièce produite par la PARTIE ADVERSE",
      procedure: "acte de procédure (assignation, conclusions, ordonnance…)",
    };

    const classement = await structured({
      model: MODEL_FAST,
      system:
        "Vous préparez le bordereau de pièces d'un dossier contentieux français. " +
        "Pour la pièce fournie : 1) proposez un intitulé de bordereau professionnel, précis et " +
        "neutre — nature de l'acte, parties concernées, objet — comme l'écrirait un avocat " +
        "(ex. « Mise en demeure adressée par SM Studio à Novaprint », « Facture n° 2026-014 ») ; " +
        "2) identifiez la DATE que porte la pièce (date de l'acte, de la facture, du courrier — " +
        "PAS la date de réception ni une date citée incidemment). " +
        "Si aucune date n'est identifiable avec certitude, date_piece=null — n'inventez jamais.",
      prompt:
        `Nature indiquée par l'utilisateur : ${CAMP_LIBELLE[piece.camp] ?? piece.camp}\n` +
        `Nom du fichier : ${doc.nom_fichier}\n\n` +
        `Contenu (début) :\n---\n${doc.texte.slice(0, 9000)}\n---`,
      toolName: "classer_piece",
      description: "Intitulé de bordereau + date de la pièce",
      schema: {
        type: "object",
        properties: {
          titre_bordereau: { type: "string", description: "Intitulé professionnel pour le bordereau" },
          date_piece: {
            type: ["string", "null"],
            description: "Date portée par la pièce, format YYYY-MM-DD, ou null si incertaine",
          },
          confiance_date: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["titre_bordereau", "date_piece"],
      },
      maxTokens: 500,
    });

    const datePiece =
      classement.date_piece && /^\d{4}-\d{2}-\d{2}$/.test(classement.date_piece)
        ? classement.date_piece
        : null;

    const { data: updated } = await admin
      .from("pieces")
      .update({
        titre_propose: classement.titre_bordereau,
        intitule: classement.titre_bordereau,
        ...(datePiece ? { date_piece: datePiece } : {}),
      })
      .eq("id", piece.id)
      .select()
      .single();

    await logAudit(piece.org_id, auth.user.id, "piece.classee", "piece", piece.id, {
      titre: classement.titre_bordereau,
      date_piece: datePiece,
    });

    return res.status(200).json({
      piece: updated,
      date_trouvee: !!datePiece,
      doublon_de: doc.version_de ?? null,
    });
  } catch (e) {
    console.error("[Holbert API] classer-piece:", e);
    return res.status(500).json({ error: `Classement échoué : ${e.message}` });
  }
}
