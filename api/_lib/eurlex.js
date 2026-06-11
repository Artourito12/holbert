// ============================================================================
// EUR-Lex : liens CELEX déterministes + vérification d'existence.
// Pas de clé requise — les pages EUR-Lex sont publiques.
// CELEX : 3 (droit dérivé) + année + R/L/D (règlement/directive/décision) + numéro.
// Ex. RGPD = 32016R0679.
// ============================================================================

export function lienCelex(celex) {
  return `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:${encodeURIComponent(celex)}`;
}

/** Vérifie qu'un identifiant CELEX existe sur EUR-Lex. */
export async function verifierCelex(celex) {
  if (!/^[0-9]{1}[0-9]{4}[A-Z]{1,2}[0-9]{4}/.test(celex)) {
    return { existe: false, url: null };
  }
  try {
    const res = await fetch(lienCelex(celex), { method: "GET", redirect: "follow" });
    const html = res.ok ? await res.text() : "";
    // Page d'erreur EUR-Lex = 200 avec un message dédié
    const existe = res.ok && !/document n'est pas disponible|No legal content/i.test(html.slice(0, 20000));
    return { existe, url: existe ? lienCelex(celex) : null };
  } catch {
    return { existe: false, url: null };
  }
}
