// ============================================================================
// Envoi d'emails via Resend (https://resend.com).
// Sans RESEND_API_KEY : no-op silencieux (les notifications in-app restent).
// EMAIL_FROM : expéditeur vérifié chez Resend (défaut : onboarding@resend.dev,
// utilisable uniquement vers l'adresse du compte Resend — pour tester).
// ============================================================================

export function emailConfigure() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function envoyerEmail({ to, subject, text }) {
  if (!emailConfigure()) return { envoye: false, raison: "RESEND_API_KEY absente" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Holbert <onboarding@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error("[Holbert API] Resend:", res.status, (await res.text()).slice(0, 200));
      return { envoye: false, raison: `Resend ${res.status}` };
    }
    return { envoye: true };
  } catch (e) {
    console.error("[Holbert API] Resend:", e.message);
    return { envoye: false, raison: e.message };
  }
}
