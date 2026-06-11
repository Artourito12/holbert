import { BAREMES } from "../baremes.generated";
import type { ResultatCalcul } from "./types";
import { euros } from "./types";

export type ParamsLicenciement = {
  /** Salaire mensuel brut de référence (le plus favorable : moyenne 12 ou 3 derniers mois). */
  salaire_reference: number;
  anciennete_annees: number;
  /** Mois au-delà des années pleines (pris en compte au prorata, art. R. 1234-1). */
  anciennete_mois: number;
  /** Date de notification du licenciement (détermine le barème applicable). */
  date_notification: string;
};

export function calculerIndemniteLicenciement(p: ParamsLicenciement): ResultatCalcul {
  const bareme = BAREMES["indemnite-licenciement"];
  const periode = bareme.periodes.find(
    (per) =>
      p.date_notification >= per.effective_from &&
      (per.effective_to === null || p.date_notification <= per.effective_to)
  );
  if (!periode) throw new Error("Aucun barème applicable à cette date");

  const avertissements: string[] = [];
  const ancienneteTotale = p.anciennete_annees + p.anciennete_mois / 12;

  if (ancienneteTotale * 12 < bareme.anciennete_minimale_mois) {
    avertissements.push(
      `L'indemnité légale exige au moins ${bareme.anciennete_minimale_mois} mois d'ancienneté ininterrompue (art. L. 1234-9 c. trav.).`
    );
  }
  avertissements.push(
    "Calcul de l'indemnité LÉGALE : votre convention collective peut prévoir un montant plus favorable, qui s'applique alors.",
    "L'indemnité n'est pas due en cas de faute grave ou lourde."
  );

  const anneesJusqua10 = Math.min(ancienneteTotale, 10);
  const anneesAuDela = Math.max(0, ancienneteTotale - 10);

  const part1 = p.salaire_reference * periode.taux_jusqua_10_ans * anneesJusqua10;
  const part2 = p.salaire_reference * periode.taux_au_dela_10_ans * anneesAuDela;
  const total = Math.round((part1 + part2) * 100) / 100;

  const etapes: ResultatCalcul["etapes"] = [
    {
      libelle: "Ancienneté retenue",
      formule: `${p.anciennete_annees} an(s) + ${p.anciennete_mois} mois ÷ 12`,
      valeur: `${ancienneteTotale.toFixed(2)} an(s)`,
    },
    {
      libelle: "Jusqu'à 10 ans d'ancienneté",
      formule: `${euros(p.salaire_reference)} × ${periode.taux_jusqua_10_ans === 0.25 ? "1/4" : "1/5"} × ${anneesJusqua10.toFixed(2)}`,
      valeur: euros(part1),
    },
  ];
  if (anneesAuDela > 0) {
    etapes.push({
      libelle: "Au-delà de 10 ans",
      formule: `${euros(p.salaire_reference)} × 1/3 × ${anneesAuDela.toFixed(2)}`,
      valeur: euros(part2),
    });
  }

  return {
    resultat: [{ libelle: "Indemnité légale de licenciement", valeur: euros(total), accent: true }],
    etapes,
    sources: [
      { libelle: "Indemnité légale", reference: bareme.source },
      { libelle: "Période de barème appliquée", reference: periode.note },
      { libelle: "Ancienneté et salaire de référence", reference: "art. L. 1234-9, R. 1234-1 et R. 1234-4 c. trav." },
    ],
    avertissements,
  };
}
