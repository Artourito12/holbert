/** Identifiants techniques des modules activables par organisation. */
export type ModuleId = "raader" | "normer" | "pleiter";

export type ModuleMeta = {
  id: ModuleId;
  /** Nom commercial du module. */
  name: string;
  /** Description courte (vouvoiement, ton Heldert). */
  description: string;
  /** Cible commerciale, pour le back-office. */
  cible: string;
};

export const MODULES: Record<ModuleId, ModuleMeta> = {
  raader: {
    id: "raader",
    name: "Raader",
    description:
      "Assistant juridique conversationnel : questions, calculs, courriers — et audit & création de contrats.",
    cible: "Particuliers, TPE, opérationnels",
  },
  normer: {
    id: "normer",
    name: "Normer",
    description:
      "Direction juridique & compliance : Front Door, contrats d'entreprise, vie sociale, conformité.",
    cible: "Juristes d'entreprise, directions juridiques",
  },
  pleiter: {
    id: "pleiter",
    name: "Pleiter",
    description:
      "Gestion de dossier contentieux augmentée : chronologie, bordereau, analyses, écritures.",
    cible: "Avocats et cabinets",
  },
};

export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];
