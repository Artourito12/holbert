import { admin, logAudit } from "../_lib/supabase-admin.js";
import { requireOrgMember } from "../_lib/auth.js";
import { envoyerEmail } from "../_lib/email.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { org_id, email, role = "member" } = req.body ?? {};
  const emailNorm = (email ?? "").trim().toLowerCase();
  if (!org_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) {
    return res.status(400).json({ error: "org_id et email valide requis" });
  }
  if (!["admin", "member"].includes(role)) {
    return res.status(400).json({ error: "Rôle invalide (admin ou member)" });
  }

  const auth = await requireOrgMember(req, res, org_id);
  if (!auth) return;
  if (!["owner", "admin"].includes(auth.role)) {
    return res.status(403).json({ error: "Seul un administrateur peut inviter des membres" });
  }

  const { data: org } = await admin.from("orgs").select("name").eq("id", org_id).single();

  // L'utilisateur existe-t-il déjà sur la plateforme ?
  const { data: profil } = await admin
    .from("profiles")
    .select("user_id, email")
    .ilike("email", emailNorm)
    .maybeSingle();

  if (profil) {
    const { error } = await admin
      .from("org_members")
      .insert({ org_id, user_id: profil.user_id, role });
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Cette personne est déjà membre de l'organisation" });
    }
    if (error) return res.status(500).json({ error: error.message });

    await admin.from("notifications").insert({
      org_id,
      user_id: profil.user_id,
      titre: `Vous avez rejoint l'organisation ${org.name}`,
      corps: `Rôle : ${role === "admin" ? "administrateur" : "membre"}`,
      lien: "/",
    });
    await envoyerEmail({
      to: emailNorm,
      subject: `Vous avez été ajouté à ${org.name}`,
      text:
        `Bonjour,\n\nVous avez été ajouté à l'organisation « ${org.name} » ` +
        `en tant que ${role === "admin" ? "administrateur" : "membre"}.\n\n` +
        `Connectez-vous pour y accéder.\n\n— Holbert`,
    });
    await logAudit(org_id, auth.user.id, "org.membre_ajoute", "user", profil.user_id, { role });
    return res.status(200).json({ statut: "ajoute" });
  }

  // Sinon : invitation en attente + email d'inscription Supabase
  const { error: invError } = await admin
    .from("invitations")
    .upsert({ org_id, email: emailNorm, role, invited_by: auth.user.id }, { onConflict: "org_id,email" });
  if (invError) return res.status(500).json({ error: invError.message });

  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(emailNorm, {
    redirectTo: process.env.APP_URL || req.headers.origin || undefined,
  });
  if (mailError && !/already.*registered/i.test(mailError.message ?? "")) {
    console.error("[Holbert API] inviteUserByEmail:", mailError.message);
  }

  await logAudit(org_id, auth.user.id, "org.invitation_envoyee", "invitation", emailNorm, { role });
  return res.status(200).json({ statut: "invite" });
}
