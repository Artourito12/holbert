// ============================================================================
// Chaînage des étapes de recherche approfondie : chaque étape est une
// invocation de fonction courte qui déclenche la suivante (docs/09 §4).
// Le secret interne = SUPABASE_SERVICE_ROLE_KEY (déjà serveur-only).
// Le front sert de filet : tant que la recherche est "en_cours", le widget
// de suivi appelle aussi /api/recherche/etape (idempotent).
// ============================================================================

export function secretInterneValide(req) {
  const fourni = req.headers["x-internal-secret"];
  return Boolean(fourni) && fourni === process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Déclenche l'étape suivante sans attendre (fire-and-forget). */
export function declencherEtape(rechercheId) {
  const base = process.env.APP_URL || "http://localhost:3000";
  fetch(`${base}/api/recherche/etape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ recherche_id: rechercheId }),
  }).catch((e) => console.error("[Hofraad API] chaîne recherche:", e.message));
}
