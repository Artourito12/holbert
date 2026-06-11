/**
 * Identifiants techniques des modules (inchangés en base de données).
 * Depuis le pivot Hofraad v2 (docs/09) :
 *  - le chat Hofraad et ses outils (ex-"raader") sont OUVERTS À TOUS ;
 *  - seuls "pleiter" (Module 1) et "normer" (Module 2) restent activables.
 */
export type ModuleId = "raader" | "normer" | "pleiter";

export type ModuleMeta = {
  id: ModuleId;
  /** Nom commercial du module. */
  name: string;
  /** Description courte (vouvoiement, ton professionnel). */
  description: string;
  /** Cible commerciale, pour le back-office. */
  cible: string;
};

export const MODULES: Record<ModuleId, ModuleMeta> = {
  raader: {
    id: "raader",
    name: "Outils",
    description:
      "Calculateurs, création de contrats et courriers — les moteurs du chat Hofraad, aussi accessibles en direct.",
    cible: "Toutes les organisations (inclus)",
  },
  normer: {
    id: "normer",
    name: "Module 2 — Compliance",
    description:
      "Direction juridique : Front Door, validation par un juriste, réponses types, reporting d'activité.",
    cible: "Juristes d'entreprise, directions juridiques",
  },
  pleiter: {
    id: "pleiter",
    name: "Module 1 — Contentieux",
    description:
      "Gestion de dossier augmentée : chronologie sourcée, bordereau, analyses, trame de conclusions.",
    cible: "Avocats et cabinets",
  },
};

export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

/** Modules réellement activables par organisation (back-office). */
export const ACTIVABLE_MODULE_IDS: ModuleId[] = ["pleiter", "normer"];
