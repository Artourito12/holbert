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

/** Déclenche une fonction interne sans attendre (fire-and-forget). */
export function declencher(path, body) {
  const base = process.env.APP_URL || "http://localhost:3000";
  fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(body),
  }).catch((e) => console.error("[Hofraad API] chaîne interne:", e.message));
}

/** Déclenche l'étape suivante d'une recherche approfondie. */
export function declencherEtape(rechercheId) {
  declencher("/api/recherche/etape", { recherche_id: rechercheId });
}
