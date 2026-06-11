// ============================================================================
// Valide les référentiels YAML et génère :
//  - api/_lib/referentiels.generated.json   (runtime des fonctions serverless)
//  - packages/core/src/referentiels.generated.ts (registre léger pour le front)
// Usage : node scripts/build-referentiels.mjs   (exécuté aussi par npm run build)
// Ajouter un type de document = ajouter un fichier YAML, zéro code.
// ============================================================================
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(root, "referentiels");

const Gravite = z.enum(["mineure", "moyenne", "majeure"]);

const FaitSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  type: z.enum([
    "parties", "date", "liste_dates", "duree", "montant",
    "liste_montants", "nombre", "texte", "bool",
  ]),
  libelle: z.string().min(3),
  requis: z.boolean().optional().default(false),
  alimente_echeancier: z.boolean().optional().default(false),
  alerte: z.array(z.number().int().positive()).optional(), // jours avant échéance
});

const ReferentielSchema = z.object({
  meta: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.number().int().positive(),
    nom: z.string().min(2),
    famille: z.string().min(2),
  }),
  identification: z.object({
    indices: z.array(z.string()),
    pieges_confusion: z.array(z.string()).default([]),
  }),
  roles: z.array(z.string()).default([]),
  extraction: z.object({
    faits: z.array(FaitSchema).min(1),
  }),
  clauses_attendues: z.array(z.object({
    id: z.string(),
    libelle: z.string(),
    gravite_si_absente: Gravite,
    fondement: z.string().optional(),
  })).default([]),
  clauses_pieges: z.array(z.object({
    id: z.string(),
    libelle: z.string(),
    detection: z.string(),
    gravite: Gravite,
    fondement: z.string().optional(),
  })).default([]),
  questions: z.record(z.string(), z.array(z.object({
    id: z.string(),
    question: z.string(),
    pourquoi: z.string(),
  }))).default({}),
});

const files = readdirSync(DIR).filter((f) => f.endsWith(".yaml"));
const referentiels = {};
const erreurs = [];

for (const file of files) {
  const raw = parse(readFileSync(join(DIR, file), "utf8"));
  const result = ReferentielSchema.safeParse(raw);
  if (!result.success) {
    erreurs.push(`${file} :\n${result.error.issues.map((i) => `  - ${i.path.join(".")} : ${i.message}`).join("\n")}`);
    continue;
  }
  const ref = result.data;
  const attendu = file.replace(".yaml", "").replace(/^_/, "");
  if (ref.meta.id !== attendu) {
    erreurs.push(`${file} : meta.id "${ref.meta.id}" ≠ nom de fichier (attendu "${attendu}")`);
    continue;
  }
  // Les faits avec échéancier doivent avoir des paliers d'alerte
  for (const fait of ref.extraction.faits) {
    if (fait.alimente_echeancier && !fait.alerte?.length) {
      erreurs.push(`${file} : le fait "${fait.id}" alimente l'échéancier sans paliers d'alerte`);
    }
  }
  referentiels[ref.meta.id] = ref;
}

if (!referentiels.generique) {
  erreurs.push("_generique.yaml manquant : le fallback est obligatoire");
}

if (erreurs.length) {
  console.error(`✗ Validation des référentiels échouée (${erreurs.length} erreur(s)) :\n\n${erreurs.join("\n\n")}`);
  process.exit(1);
}

// --- Génération runtime API --------------------------------------------------
const apiOut = join(root, "api", "_lib", "referentiels.generated.json");
mkdirSync(dirname(apiOut), { recursive: true });
writeFileSync(apiOut, JSON.stringify(referentiels, null, 2) + "\n", "utf8");

// --- Génération registre front -----------------------------------------------
const registry = Object.values(referentiels).map((r) => ({
  id: r.meta.id,
  nom: r.meta.nom,
  famille: r.meta.famille,
  version: r.meta.version,
  roles: r.roles,
}));
const ts = `// Généré par scripts/build-referentiels.mjs — NE PAS ÉDITER À LA MAIN.
export type ReferentielInfo = {
  id: string;
  nom: string;
  famille: string;
  version: number;
  roles: string[];
};

export const REFERENTIELS_REGISTRY: ReferentielInfo[] = ${JSON.stringify(registry, null, 2)};

export function referentielNom(id: string | null | undefined): string {
  if (!id) return "Type inconnu";
  return REFERENTIELS_REGISTRY.find((r) => r.id === id)?.nom ?? id;
}
`;
writeFileSync(join(root, "packages", "core", "src", "referentiels.generated.ts"), ts, "utf8");

console.log(`✓ ${Object.keys(referentiels).length} référentiel(s) validé(s) : ${Object.keys(referentiels).join(", ")}`);
