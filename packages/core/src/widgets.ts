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
    }
  | {
      /** Collecte du contexte d'audit dans la conversation (document, camp, objectif). */
      type: "audit_contexte";
      prefill?: {
        document_hint?: string | null;
        role?: string | null;
        objectif?: string | null;
      };
    }
  | {
      /** Création de contrat guidée dans la conversation (questions une à une). */
      type: "contrat_assistant";
      prefill?: {
        type?: string | null;
        role?: string | null;
      };
    }
  | {
      /** Calculateur ad hoc généré par l'IA (formules évaluées côté client, docs/09 §6). */
      type: "calculatrice_dynamique";
      spec: CalculatriceDynamiqueSpec;
    };

export type ChampDynamique = {
  id: string;
  label: string;
  type: "nombre" | "curseur" | "choix";
  min?: number;
  max?: number;
  step?: number;
  defaut?: number;
  unite?: string;
  options?: { valeur: number; label: string }[];
};

export type CalculatriceDynamiqueSpec = {
  titre: string;
  description?: string;
  champs: ChampDynamique[];
  resultats: {
    id: string;
    label: string;
    /** Expression arithmétique sur les ids des champs (évaluateur sûr). */
    formule: string;
    format?: "euros" | "nombre" | "pourcent";
    accent?: boolean;
  }[];
  sources: { libelle: string; reference: string }[];
  avertissements?: string[];
  date_validite?: string;
};
