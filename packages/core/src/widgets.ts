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

/**
 * Contrat widget émis par l'IA et rendu nativement par le front.
 * (frise, arbre de décision, comparatif… arrivent aux jalons suivants)
 */
export type Widget = {
  type: "calculatrice";
  competence: CompetenceCalcul;
  /** Paramètres pré-remplis détectés dans la conversation. */
  params?: Record<string, string | number>;
};
