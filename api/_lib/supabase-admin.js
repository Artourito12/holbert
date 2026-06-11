import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "[Holbert API] VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante dans l'environnement"
  );
}

/** Client service role — bypasse RLS, à n'utiliser QUE côté serveur. */
export const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Journalise une action dans l'audit log (append-only). */
export async function logAudit(orgId, actorId, action, targetType, targetId, details = {}) {
  const { error } = await admin.from("audit_log").insert({
    org_id: orgId,
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId == null ? null : String(targetId),
    details,
  });
  if (error) console.error("[Holbert API] logAudit:", error.message);
}
