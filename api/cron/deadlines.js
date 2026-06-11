import { admin } from "../_lib/supabase-admin.js";
import { envoyerEmail, emailConfigure } from "../_lib/email.js";

/**
 * Cron quotidien (cf. vercel.json) : pour chaque échéance à venir dont un
 * palier d'alerte tombe aujourd'hui, notifie tous les membres de l'org
 * (in-app + email si Resend est configuré).
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  const { data: deadlines, error } = await admin
    .from("deadlines")
    .select("*")
    .eq("statut", "a_venir")
    .gte("date_echeance", new Date().toISOString().slice(0, 10));
  if (error) return res.status(500).json({ error: error.message });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let notifiees = 0;

  for (const d of deadlines ?? []) {
    const echeance = new Date(d.date_echeance + "T00:00:00");
    const joursRestants = Math.round((echeance - today) / 86400000);
    if (!(d.paliers_alerte ?? []).includes(joursRestants)) continue;

    const { data: membres } = await admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", d.org_id);

    if (!membres?.length) continue;
    const dateFr = new Date(d.date_echeance + "T00:00:00").toLocaleDateString("fr-FR");
    const { error: insertError } = await admin.from("notifications").insert(
      membres.map((m) => ({
        org_id: d.org_id,
        user_id: m.user_id,
        titre: `Échéance dans ${joursRestants} jour(s) : ${d.titre}`,
        corps: `Date d'échéance : ${dateFr}`,
        lien: "/echeancier",
      }))
    );
    if (!insertError) notifiees += membres.length;

    if (emailConfigure()) {
      const { data: profils } = await admin
        .from("profiles")
        .select("email")
        .in("user_id", membres.map((m) => m.user_id));
      const emails = (profils ?? []).map((p) => p.email).filter(Boolean);
      if (emails.length) {
        await envoyerEmail({
          to: emails,
          subject: `[Holbert] Échéance dans ${joursRestants} jour(s) : ${d.titre}`,
          text:
            `Une échéance approche.\n\n${d.titre}\nDate : ${dateFr} (J-${joursRestants})\n\n` +
            `Retrouvez le détail dans votre échéancier Holbert.\n\n— Holbert`,
        });
      }
    }
  }

  return res.status(200).json({ echeances_examinees: deadlines?.length ?? 0, notifications: notifiees });
}
