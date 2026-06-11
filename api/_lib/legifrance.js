// ============================================================================
// Client Légifrance via PISTE (AIFE) — OAuth2 client_credentials.
// Prérequis : compte sur https://piste.gouv.fr, souscription à l'API
// Légifrance, puis LEGIFRANCE_CLIENT_ID / LEGIFRANCE_CLIENT_SECRET dans l'env.
// Sans clés : estConfigure() = false, les citations restent de simples liens
// de recherche legifrance.gouv.fr (cf. apps/web/src/lib/legifrance.ts).
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

/** Abréviations usuelles → noms de codes Légifrance. */
const CODES = [
  [/c(?:ode)?\.?\s*civ(?:il)?\.?/i, "Code civil"],
  [/c(?:ode)?\.?\s*(?:de\s+)?com(?:merce)?\.?/i, "Code de commerce"],
  [/c(?:ode)?\.?\s*(?:du\s+)?trav(?:ail)?\.?/i, "Code du travail"],
  [/c(?:ode)?\.?\s*(?:de\s+la\s+)?consom(?:mation)?\.?/i, "Code de la consommation"],
  [/c(?:ode)?\.?\s*(?:des\s+)?assur(?:ances)?\.?/i, "Code des assurances"],
  [/c(?:ode)?\.?\s*mon(?:étaire)?\.?\s*(?:et\s+)?fin(?:ancier)?\.?/i, "Code monétaire et financier"],
  [/c(?:ode)?\.?\s*pén(?:al)?\.?/i, "Code pénal"],
  [/\bCPCE\b/, "Code des procédures civiles d'exécution"],
  [/\bCPC\b|c(?:ode)?\.?\s*(?:de\s+)?proc(?:édure)?\.?\s*civ(?:ile)?\.?/i, "Code de procédure civile"],
  [/\bCPI\b|propriété\s+intellectuelle/i, "Code de la propriété intellectuelle"],
  [/\bCGI\b|général\s+des\s+impôts/i, "Code général des impôts"],
];

/**
 * Vérifie qu'un article existe dans un code donné.
 * numero : "L. 145-4", "2224"… (normalisé en "L145-4" — format Légifrance)
 * Retourne { trouve, etat, id, url } ou null si non configuré.
 */
export async function verifierArticle(numero, nomCode) {
  if (!estConfigure()) return null;
  const num = numero.replace(/[.\s]/g, "").toUpperCase();

  const json = await appel("/search", {
    fond: "CODE_ETAT",
    recherche: {
      champs: [
        {
          typeChamp: "NUM_ARTICLE",
          criteres: [{ typeRecherche: "EXACTE", valeur: num, operateur: "ET" }],
          operateur: "ET",
        },
      ],
      filtres: [],
      pageNumber: 1,
      pageSize: 20,
      operateur: "ET",
      sort: "PERTINENCE",
      typePagination: "ARTICLE",
    },
  });

  // Le filtre par code est ignoré par l'API : on trie nous-mêmes.
  // Le nom du code est le dernier élément non vide du fil d'Ariane `titles`.
  const extraits = [];
  for (const res of json?.results ?? []) {
    const titre =
      (res?.titles ?? []).map((t) => t?.title).filter(Boolean).pop() ?? "";
    if (titre.toLowerCase() !== nomCode.toLowerCase()) continue;
    for (const sec of res?.sections ?? []) {
      for (const ex of sec?.extracts ?? []) {
        if ((ex?.num ?? "").toUpperCase() === num) extraits.push(ex);
      }
    }
  }
  if (!extraits.length) return { trouve: false };

  // Priorité à la version en vigueur, sinon la plus récente (id le plus grand).
  const meilleur =
    extraits.find((e) => e.legalStatus === "VIGUEUR") ??
    extraits.sort((a, b) => (a.id < b.id ? 1 : -1))[0];

  return {
    trouve: true,
    etat: meilleur.legalStatus ?? "INCONNU",
    id: meilleur.id,
    url: `https://www.legifrance.gouv.fr/codes/article_lc/${meilleur.id}`,
  };
}

// "art. L. 145-4 c. com.", "article 2224 du code civil"…
const CITATION_RE =
  /\bart(?:icle)?s?\.?\s+([LRD]\.?\s*)?(\d+(?:-\d+)*)\s+(?:du\s+|de\s+la\s+)?([a-zA-Zéèêàçù.\s]{2,45}?|CPC|CPCE|CPI|CGI)(?=[,;.)\n]|$)/gi;

/**
 * Extrait les citations d'articles d'un texte et les vérifie sur Légifrance
 * (max 4, dédupliquées). Retourne [{ citation, code, trouve, etat, url }].
 */
export async function verifierCitations(texte) {
  if (!estConfigure()) return [];
  const vues = new Set();
  const cibles = [];
  for (const m of texte.matchAll(CITATION_RE)) {
    const numero = `${m[1] ?? ""}${m[2]}`.trim();
    const code = CODES.find(([re]) => re.test(m[3]))?.[1];
    if (!code) continue;
    const cle = `${numero}|${code}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    cibles.push({ citation: m[0].trim().replace(/\s+/g, " "), numero, code });
    if (cibles.length >= 4) break;
  }

  const resultats = [];
  for (const c of cibles) {
    try {
      const v = await verifierArticle(c.numero, c.code);
      if (v) {
        resultats.push({
          citation: c.citation,
          code: c.code,
          trouve: v.trouve,
          etat: v.etat ?? null,
          url: v.url ?? null,
        });
      }
    } catch (e) {
      console.error("[Holbert API] verifierCitations:", e.message);
    }
  }
  return resultats;
}
