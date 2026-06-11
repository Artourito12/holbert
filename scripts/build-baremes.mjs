// ============================================================================
// Valide les barèmes JSON et génère packages/core/src/baremes.generated.ts.
// Un barème = des DONNÉES datées, jamais du code : ajouter/mettre à jour un
// barème ne touche pas aux moteurs de calcul.
// ============================================================================
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(root, "baremes");

const baremes = {};
const erreurs = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  if (!data.id || !data.nom || !data.source) {
    erreurs.push(`${file} : champs id/nom/source requis`);
    continue;
  }
  if (data.id !== file.replace(".json", "")) {
    erreurs.push(`${file} : id "${data.id}" ≠ nom de fichier`);
    continue;
  }
  baremes[data.id] = data;
}

// Cohérence des périodes datées
for (const b of Object.values(baremes)) {
  if (!b.periodes) continue;
  for (const p of b.periodes) {
    if (!p.effective_from) erreurs.push(`${b.id} : période sans effective_from`);
  }
}

if (erreurs.length) {
  console.error(`✗ Validation des barèmes échouée :\n${erreurs.join("\n")}`);
  process.exit(1);
}

const ts = `// Généré par scripts/build-baremes.mjs — NE PAS ÉDITER À LA MAIN.
// Source de vérité : les fichiers baremes/*.json à la racine du repo.
export const BAREMES = ${JSON.stringify(baremes, null, 2)} as const;
`;
writeFileSync(join(root, "packages", "core", "src", "baremes.generated.ts"), ts, "utf8");

const aVerifier = Object.values(baremes).filter((b) => b.a_verifier).map((b) => b.id);
console.log(`✓ ${Object.keys(baremes).length} barème(s) compilé(s) : ${Object.keys(baremes).join(", ")}`);
if (aVerifier.length) {
  console.log(`⚠ Barèmes marqués "a_verifier" (valeurs à contrôler avant production) : ${aVerifier.join(", ")}`);
}
