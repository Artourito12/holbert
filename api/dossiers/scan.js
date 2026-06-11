import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { declencher } from "../_lib/recherche-chain.js";

const TAILLE_LOT = 3;
const MAX_PIECES = 30;

/**
 * Lance le scan complet d'un dossier contentieux (docs/10 phase 2).
 * L'utilisateur explique le cas ; l'IA lit ensuite TOUTES les pièces
 * (par lots), construit la stratégie séquencée avec délais et cherche
 * les vices de procédure dans les deux sens — le tout en asynchrone.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { dossier_id, contexte } = req.body ?? {};
  if (!dossier_id || !contexte || contexte.trim().length < 20) {
    return res.status(400).json({
      error: "dossier_id et un contexte d'au moins 20 caractères sont requis (qui défendez-vous, objectif, où en est-on).",
    });
  }

  const { data: dossier } = await admin
    .from("dossiers")
    .select("*")
    .eq("id", dossier_id)
    .maybeSingle();
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable" });

  const auth = await requireOrgMember(req, res, dossier.org_id);
  if (!auth) return;

  const { data: pieces } = await admin
    .from("pieces")
    .select("id, camp, numero, intitule, date_piece, documents(statut)")
    .eq("dossier_id", dossier_id)
    .order("camp")
    .order("numero");

  const lisibles = (pieces ?? []).filter((p) => p.documents?.statut === "ready");
  if (!lisibles.length) {
    return res.status(409).json({ error: "Aucune pièce exploitable — déposez d'abord les pièces du dossier." });
  }

  const retenues = lisibles.slice(0, MAX_PIECES);
  const nbLots = Math.ceil(retenues.length / TAILLE_LOT);

  const etapes = [
    { id: "comprehension", label: "Compréhension du litige", statut: "a_faire" },
    ...Array.from({ length: nbLots }, (_, i) => ({
      id: `lecture_${i}`,
      label: `Lecture des pièces (lot ${i + 1}/${nbLots})`,
      statut: "a_faire",
    })),
    { id: "strategie", label: "Stratégie et délais", statut: "a_faire" },
    { id: "vices", label: "Vices de procédure (deux sens)", statut: "a_faire" },
    { id: "assemblage", label: "Synthèse finale", statut: "a_faire" },
  ];

  const { data: scan, error } = await admin
    .from("scans_dossier")
    .insert({
      org_id: dossier.org_id,
      dossier_id,
      created_by: auth.user.id,
      contexte: contexte.trim(),
      etapes,
      donnees: {
        pieces_ids: retenues.map((p) => p.id),
        pieces_ignorees: lisibles.length - retenues.length,
      },
      statut: "en_cours",
      etape_courante: "préparation",
      progression: 2,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logAudit(dossier.org_id, auth.user.id, "dossier.scan_lance", "scan_dossier", scan.id, {
    pieces: retenues.length,
  });

  declencher("/api/dossiers/scan-etape", { scan_id: scan.id });
  return res.status(200).json({ scan });
}
