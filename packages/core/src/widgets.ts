/** Compétences de calcul disponibles en widget. */
export type CompetenceCalcul = "licenciement" | "pension" | "prescription";

export const COMPETENCES_CALCUL: Record<
  CompetenceCalcul,
  { nom: string; description: string }
> = {
  licenciement: {
    nom: "Indemnité de licenciement",
    description: "Indemnité légale selon le salaire de référence et l'ancienneté.",
  },
  pension: {
    nom: "Pension alimentaire — revalorisation et arriérés",
    description: "Pension revalorisée par l'indice des prix et arriérés sur la période.",
  },
  prescription: {
    nom: "Délai de prescription",
    description: "Échéance de prescription avec causes d'interruption et de suspension.",
  },
};

/** Question segmentée d'une recherche approfondie (éditable avant validation). */
export type RechercheQuestionWidget = {
  id: string;
  question: string;
  justification?: string;
};

/**
 * Contrat widget émis par l'IA et rendu nativement par le front.
 * (frise, arbre de décision, comparatif… arrivent aux jalons suivants)
 */
export type Widget =
  | {
      type: "calculatrice";
      competence: CompetenceCalcul;
      /** Paramètres pré-remplis détectés dans la conversation. */
      params?: Record<string, string | number>;
    }
  | {
      /** Encarts éditables : l'utilisateur corrige puis valide la segmentation. */
      type: "recherche_validation";
      recherche_id: string;
      questions: RechercheQuestionWidget[];
    }
  | {
      /** Suivi de progression + restitution du document de synthèse. */
      type: "recherche_resultat";
      recherche_id: string;
    };
