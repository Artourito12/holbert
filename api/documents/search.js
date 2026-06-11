import { admin } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { embed } from "../_lib/openai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { org_id, query, count } = req.body ?? {};
  if (!org_id || !query?.trim()) return res.status(400).json({ error: "org_id et query requis" });

  const auth = await requireOrgMember(req, res, org_id);
  if (!auth) return;

  const [embedding] = await embed([query.trim()]);
  const { data: chunks, error } = await admin.rpc("match_chunks", {
    p_org: org_id,
    p_embedding: embedding,
    p_count: count ?? 8,
  });
  if (error) return res.status(500).json({ error: error.message });

  // Joindre les noms de documents
  const docIds = [...new Set((chunks ?? []).map((c) => c.document_id))];
  const { data: docs } = docIds.length
    ? await admin.from("documents").select("id, nom_fichier, type_confirme").in("id", docIds)
    : { data: [] };
  const byId = Object.fromEntries((docs ?? []).map((d) => [d.id, d]));

  return res.status(200).json({
    resultats: (chunks ?? []).map((c) => ({
      document_id: c.document_id,
      nom_fichier: byId[c.document_id]?.nom_fichier ?? "Document",
      type: byId[c.document_id]?.type_confirme ?? null,
      position: c.pos,
      extrait: c.contenu,
      similarite: c.similarite,
    })),
  });
}
