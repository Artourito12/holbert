import { describe, expect, it } from "vitest";
import { calculerIndemniteLicenciement } from "../licenciement";
import { calculerPensionArrieres } from "../pension";
import { calculerPrescription } from "../prescription";

/** Normalise un montant formaté fr-FR ("5 000,00 €") en "5000,00". */
function montant(valeur: string): string {
  return valeur.replace(/[^\d,]/g, "");
}

describe("Indemnité légale de licenciement (golden)", () => {
  it("10 ans pile, 2 000 €, barème post-2017 : 1/4 × 10 = 5 000 €", () => {
    const r = calculerIndemniteLicenciement({
      salaire_reference: 2000,
      anciennete_annees: 10,
      anciennete_mois: 0,
      date_notification: "2020-06-01",
    });
    expect(montant(r.resultat[0].valeur)).toBe("5000,00");
  });

  it("12 ans et 6 mois, 3 000 € : 7 500 + 2 500 = 10 000 €", () => {
    const r = calculerIndemniteLicenciement({
      salaire_reference: 3000,
      anciennete_annees: 12,
      anciennete_mois: 6,
      date_notification: "2023-01-10",
    });
    expect(montant(r.resultat[0].valeur)).toBe("10000,00");
    expect(r.etapes).toHaveLength(3); // ancienneté + tranche ≤10 + tranche >10
  });

  it("rejouable à date : ancien barème (1/5) avant le 27/09/2017", () => {
    const r = calculerIndemniteLicenciement({
      salaire_reference: 1000,
      anciennete_annees: 6,
      anciennete_mois: 0,
      date_notification: "2015-01-01",
    });
    expect(montant(r.resultat[0].valeur)).toBe("1200,00");
  });

  it("signale l'ancienneté insuffisante (< 8 mois)", () => {
    const r = calculerIndemniteLicenciement({
      salaire_reference: 2000,
      anciennete_annees: 0,
      anciennete_mois: 5,
      date_notification: "2024-01-01",
    });
    expect(r.avertissements.some((a) => a.includes("8 mois"))).toBe(true);
  });
});

describe("Pension alimentaire — revalorisation et arriérés (golden)", () => {
  it("500 € fixés en 2020, rien payé, année 2024 : 500 × 117,1/104,0 × 12 = 6 755,76 €", () => {
    const r = calculerPensionArrieres({
      pension_initiale: 500,
      annee_fixation: 2020,
      paye_mensuel: 0,
      date_debut: "2024-01-01",
      date_fin: "2024-12-01",
    });
    expect(montant(r.resultat[0].valeur)).toBe("6755,76");
  });

  it("déduit ce qui a été payé", () => {
    const r = calculerPensionArrieres({
      pension_initiale: 500,
      annee_fixation: 2020,
      paye_mensuel: 500,
      date_debut: "2024-01-01",
      date_fin: "2024-12-01",
    });
    // dû 6 755,76 − payé 6 000 = 755,76
    expect(montant(r.resultat[0].valeur)).toBe("755,76");
  });

  it("tronque la période au-delà de la prescription de 5 ans", () => {
    const r = calculerPensionArrieres({
      pension_initiale: 300,
      annee_fixation: 2016,
      paye_mensuel: 0,
      date_debut: "2017-01-01",
      date_fin: "2025-06-01",
    });
    expect(r.avertissements.some((a) => a.includes("prescrites"))).toBe(true);
  });
});

describe("Prescription (golden)", () => {
  it("droit commun 5 ans sans événement : acquise après l'échéance", () => {
    const r = calculerPrescription({
      type_action: "droit_commun",
      point_depart: "2020-01-15",
      date_reference: "2026-06-11",
    });
    expect(r.resultat[0].libelle).toContain("ACQUISE");
    expect(r.resultat[0].valeur).toContain("15/01/2025");
  });

  it("une reconnaissance de dette interrompt : nouveau délai complet", () => {
    const r = calculerPrescription({
      type_action: "droit_commun",
      point_depart: "2020-01-15",
      date_reference: "2026-06-11",
      evenements: [
        { type: "interruption", cause: "Reconnaissance de dette", date: "2023-03-01" },
      ],
    });
    expect(r.resultat[0].libelle).toContain("possible");
    expect(r.resultat[0].valeur).toContain("01/03/2028");
  });

  it("une médiation suspend : le délai est reporté de la durée de la cause", () => {
    const r = calculerPrescription({
      type_action: "droit_commun",
      point_depart: "2022-01-01",
      date_reference: "2026-06-11",
      evenements: [
        { type: "suspension", cause: "Médiation", date: "2023-01-01", date_fin: "2023-03-02" },
      ],
    });
    // échéance 01/01/2027 + 60 jours = 02/03/2027
    expect(r.resultat[0].valeur).toContain("02/03/2027");
  });

  it("un événement postérieur à l'acquisition est sans effet", () => {
    const r = calculerPrescription({
      type_action: "consommation", // 2 ans
      point_depart: "2020-01-01",
      date_reference: "2026-06-11",
      evenements: [
        { type: "interruption", cause: "Mise en demeure tardive", date: "2023-06-01" },
      ],
    });
    expect(r.resultat[0].libelle).toContain("ACQUISE");
    expect(r.resultat[0].valeur).toContain("01/01/2022");
  });
});
