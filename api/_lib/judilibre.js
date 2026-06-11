// ============================================================================
// Client Judilibre (Cour de cassation, open data) via PISTE.
// Mêmes identifiants OAuth que Légifrance (API souscrite par la même appli).
// ============================================================================

const OAUTH_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const API_URL = "https://api.piste.gouv.fr/cassation/judilibre/v1.0";

let tokenCache = { token: null, expires: 0 };

export function judilibreConfigure() {
  return Boolean(process.env.LEGIFRANCE_CLIENT_ID && process.env.LEGIFRANCE_CLIENT_SECRET);
}

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires - 60000) {
    return tokenCache.token;
  }
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.LEGIFRANCE_CLIENT_ID,
      client_secret: process.env.LEGIFRANCE_CLIENT_SECRET,
      scope: "openid",
    }),
  });
  if (!res.ok) throw new Error(`PISTE OAuth ${res.status}`);
  const json = await res.json();
  tokenCache = {
    token: json.access_token,
    expires: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

/**
 * Recherche plein texte dans la jurisprudence de la Cour de cassation.
 * Retourne [{ titre, reference, url, extrait, date, solution }].
 */
export async function rechercherJurisprudence(query, taille = 6) {
  if (!judilibreConfigure()) return [];
  const token = await getToken();
  const params = new URLSearchParams({
    query,
    page_size: String(taille),
    sort: "scorepub",
    order: "desc",
  });
  const res = await fetch(`${API_URL}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) {
    console.error("[Hofraad API] Judilibre", res.status, (await res.text()).slice(0, 200));
    return [];
  }
  const json = await res.json();
  return (json?.results ?? []).map((r) => {
    const date = r.decision_date ?? "";
    const numero = r.number ?? (r.numbers ?? [])[0] ?? "";
    const chambre = r.chamber ?? "";
    return {
      type: "jurisprudence",
      titre: `Cass. ${chambre ? chambre + ", " : ""}${date ? new Date(date).toLocaleDateString("fr-FR") + ", " : ""}n° ${numero}`,
      reference: `pourvoi n° ${numero}`,
      url: r.id ? `https://www.courdecassation.fr/decision/${r.id}` : null,
      extrait: (r.summary ?? (r.highlights?.text ?? []).join(" … ") ?? "").slice(0, 400),
      solution: r.solution ?? null,
    };
  });
}
