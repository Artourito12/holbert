import { admin } from "./supabase-admin.js";

/**
 * Profil de l'organisation, formaté pour être injecté dans les prompts IA.
 * Retourne "" si le profil n'est pas renseigné.
 */
export async function contexteOrganisation(orgId) {
  const { data: p } = await admin
    .from("org_profils")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!p) return "";

  const lignes = [
    p.activite && `Activité : ${p.activite}`,
    p.forme_juridique && `Forme juridique : ${p.forme_juridique}`,
    p.effectif && `Effectif : ${p.effectif}`,
    p.convention_collective && `Convention collective : ${p.convention_collective}`,
    p.implantations && `Implantations : ${p.implantations}`,
    p.contexte_ia && `Contexte fourni par l'organisation :\n${p.contexte_ia}`,
  ].filter(Boolean);

  if (!lignes.length) return "";
  return `\n\nPROFIL DE L'ORGANISATION (à prendre en compte dans l'analyse) :\n${lignes.join("\n")}\n`;
}
