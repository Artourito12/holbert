import { admin } from "./supabase-admin.js";

/**
 * Vérifie le JWT Supabase (header Authorization: Bearer <token>) et,
 * si org_id est fourni, l'appartenance à l'organisation.
 * Retourne { user, role } ou écrit une réponse d'erreur et retourne null.
 */
export async function requireOrgMember(req, res, orgId) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Authentification requise" });
    return null;
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Session invalide ou expirée" });
    return null;
  }
  const user = data.user;

  if (!orgId) {
    res.status(400).json({ error: "org_id manquant" });
    return null;
  }

  const { data: membership } = await admin
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: "Vous n'êtes pas membre de cette organisation" });
    return null;
  }

  return { user, role: membership.role };
}
