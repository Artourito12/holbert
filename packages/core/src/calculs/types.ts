/** Résultat commun à tous les calculateurs : valeur + détail rejouable + sources. */
export type ResultatCalcul = {
  resultat: { libelle: string; valeur: string; accent?: boolean }[];
  etapes: { libelle: string; formule: string; valeur: string }[];
  sources: { libelle: string; reference: string }[];
  avertissements: string[];
};

export function euros(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

export function dateFr(iso: string): string {
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("fr-FR");
}
