// Vérifie la connexion PISTE/Légifrance avec les clés de .env.local.
// Usage : node scripts/test-legifrance.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Chargement minimal de .env.local (pas de dépendance dotenv)
for (const ligne of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

if (!process.env.LEGIFRANCE_CLIENT_ID || !process.env.LEGIFRANCE_CLIENT_SECRET) {
  console.error("✗ LEGIFRANCE_CLIENT_ID / LEGIFRANCE_CLIENT_SECRET absentes de .env.local");
  process.exit(1);
}

// 1. Token OAuth (production)
const oauth = await fetch("https://oauth.piste.gouv.fr/api/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.LEGIFRANCE_CLIENT_ID,
    client_secret: process.env.LEGIFRANCE_CLIENT_SECRET,
    scope: "openid",
  }),
});
if (!oauth.ok) {
  console.error(`✗ OAuth production refusé (${oauth.status}).`);
  console.error("  → Si vos clés sont de type sandbox, recréez l'application côté PRODUCTION sur piste.gouv.fr.");
  process.exit(1);
}
const { access_token } = await oauth.json();
console.log("✓ Token OAuth production obtenu");

// 2. Recherche de l'article 2224 du code civil
const search = await fetch(
  "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      fond: "CODE_ETAT",
      recherche: {
        champs: [
          {
            typeChamp: "NUM_ARTICLE",
            criteres: [{ typeRecherche: "EXACTE", valeur: "2224", operateur: "ET" }],
            operateur: "ET",
          },
        ],
        filtres: [{ facette: "NOM_CODE", valeurs: ["Code civil"] }],
        pageNumber: 1,
        pageSize: 3,
        operateur: "ET",
        sort: "PERTINENCE",
        typePagination: "ARTICLE",
      },
    }),
  }
);
if (!search.ok) {
  console.error(`✗ Recherche Légifrance refusée (${search.status}) : ${(await search.text()).slice(0, 300)}`);
  console.error("  → Vérifiez que l'API Légifrance est bien souscrite par cette application (environnement production).");
  process.exit(1);
}
const json = await search.json();
const premier = json?.results?.[0];
const extrait = premier?.sections?.[0]?.extracts?.[0];
console.log(`✓ Recherche OK — ${json?.totalResultNumber ?? "?"} résultat(s)`);
console.log(`  Article : ${extrait?.num ?? "?"} — ${premier?.titles?.[0]?.title ?? "?"}`);
console.log(`  Id LEGIARTI : ${extrait?.id ?? "?"} · état : ${extrait?.legalStatus ?? "?"}`);
console.log("\nLégifrance est opérationnel.");
