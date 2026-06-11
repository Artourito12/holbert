import type { ModuleId } from "./modules";

/** Compteurs de l'organisation utilisés pour évaluer l'onboarding. */
export type OrgStats = {
  documents_total: number;
  documents_ready: number;
  /** Nombre de documents par type confirmé (id de référentiel). */
  documents_par_type: Record<string, number>;
  echeances: number;
  conversations: number;
  audits: number;
  documents_generes: number;
  dossiers: number;
  pieces: number;
  evenements: number;
  demandes: number;
  reponses_types: number;
};

export type OnboardingItem = {
  id: string;
  libelle: string;
  /** Où accomplir l'objectif. */
  lien: string;
  /** Module requis (absent = socle, toujours affiché). */
  module?: ModuleId;
  fait: (s: OrgStats) => boolean;
};

export const ONBOARDING_ITEMS: OnboardingItem[] = [
  // ---- Socle ---------------------------------------------------------------
  {
    id: "premier_document",
    libelle: "Importer un premier document (en vrac, le moteur classe tout seul)",
    lien: "/documents",
    fait: (s) => s.documents_total > 0,
  },
  {
    id: "document_traite",
    libelle: "Confirmer le type d'un document (données extraites + sources)",
    lien: "/documents",
    fait: (s) => s.documents_ready > 0,
  },
  {
    id: "echeance",
    libelle: "Avoir une première échéance détectée automatiquement",
    lien: "/echeancier",
    fait: (s) => s.echeances > 0,
  },
  {
    id: "question",
    libelle: "Poser une première question à l'Assistant (réponse sourcée)",
    lien: "/assistant",
    fait: (s) => s.conversations > 0,
  },
  // ---- Outils Hofraad (ouverts à tous) ----------------------------------------
  {
    id: "contrat_classe",
    libelle: "Classer un contrat (bail, prestation ou CGV)",
    lien: "/documents",
    fait: (s) =>
      (s.documents_par_type["bail-commercial"] ?? 0) +
        (s.documents_par_type["prestation-services"] ?? 0) +
        (s.documents_par_type["cgv"] ?? 0) >
      0,
  },
  {
    id: "premier_audit",
    libelle: "Auditer un premier contrat (score de risque + reformulations)",
    lien: "/raader",
    fait: (s) => s.audits > 0,
  },
  {
    id: "premiere_generation",
    libelle: "Générer un premier contrat ou courrier",
    lien: "/raader",
    fait: (s) => s.documents_generes > 0,
  },
  // ---- Pleiter ---------------------------------------------------------------
  {
    id: "premier_dossier",
    libelle: "Créer un premier dossier contentieux",
    lien: "/pleiter",
    module: "pleiter",
    fait: (s) => s.dossiers > 0,
  },
  {
    id: "pieces_dossier",
    libelle: "Déposer les pièces d'un dossier (bordereau automatique)",
    lien: "/pleiter",
    module: "pleiter",
    fait: (s) => s.pieces > 0,
  },
  {
    id: "chronologie",
    libelle: "Extraire la chronologie des pièces",
    lien: "/pleiter",
    module: "pleiter",
    fait: (s) => s.evenements > 0,
  },
  // ---- Normer ----------------------------------------------------------------
  {
    id: "premiere_demande",
    libelle: "Recevoir une première demande au Front Door",
    lien: "/demandes/nouvelle",
    module: "normer",
    fait: (s) => s.demandes > 0,
  },
  {
    id: "reponse_type",
    libelle: "Capitaliser une première réponse type",
    lien: "/normer",
    module: "normer",
    fait: (s) => s.reponses_types > 0,
  },
];

export function onboardingPourModules(actifs: ModuleId[]): OnboardingItem[] {
  return ONBOARDING_ITEMS.filter((i) => !i.module || actifs.includes(i.module));
}

export function scoreOnboarding(items: OnboardingItem[], stats: OrgStats): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.fait(stats)).length / items.length) * 100);
}
