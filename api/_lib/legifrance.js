// ============================================================================
// Client Légifrance via PISTE (AIFE) — OAuth2 client_credentials.
// Prérequis : compte sur https://piste.gouv.fr, souscription à l'API
// Légifrance, puis LEGIFRANCE_CLIENT_ID / LEGIFRANCE_CLIENT_SECRET dans l'env.
// Tant que les clés sont absentes, estConfigure() = false et les appelants
// se replient sur les liens de recherche legifrance.gouv.fr (lib/legifrance front).
// ============================================================================

const OAUTH_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const API_URL = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";

let tokenCache = { token: null, expires: 0 };

export function estConfigure() {
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

async function appel(path, body) {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Légifrance ${path} ${res.status}`);
  return res.json();
}

/**
 * Recherche plein texte dans les codes en vigueur.
 * Retourne les premiers résultats { titre, id, texte } — utilisé pour vérifier
 * qu'un article cité existe et récupérer son contenu authentique.
 */
export async function rechercherArticle(citation) {
  if (!estConfigure()) return null;
  const json = await appel("/search", {
    recherche: {
      champs: [
        {
          typeChamp: "NUM_ARTICLE",
          criteres: [{ typeRecherche: "EXACTE", valeur: citation, operateur: "ET" }],
          operateur: "ET",
        },
      ],
      filtres: [{ facette: "NATURE", valeurs: ["CODE"] }],
      pageNumber: 1,
      pageSize: 5,
      operateur: "ET",
      sort: "PERTINENCE",
      typePagination: "ARTICLE",
    },
    fond: "CODE_ETAT",
  });
  return json?.results ?? [];
}

/** Récupère un article par son identifiant LEGIARTI (texte authentique + état). */
export async function getArticle(legiartiId) {
  if (!estConfigure()) return null;
  const json = await appel("/consult/getArticle", { id: legiartiId });
  return json?.article ?? null;
}
