import { BAREMES } from "../baremes.generated";
import type { ResultatCalcul } from "./types";
import { euros } from "./types";

export type ParamsPension = {
  /** Pension mensuelle fixée par la décision (€/mois). */
  pension_initiale: number;
  /** Année de la décision fixant la pension. */
  annee_fixation: number;
  /** Montant réellement payé chaque mois sur la période (€/mois, 0 si rien). */
  paye_mensuel: number;
  /** Période de calcul des arriérés. */
  date_debut: string;
  date_fin: string;
};

/**
 * Revalorisation annuelle simplifiée : la pension due pendant l'année civile Y
 * est la pension initiale multipliée par IPC(Y-1) / IPC(année de fixation - 1)
 * — revalorisation au 1er janvier sur le dernier indice annuel connu.
 * La clause du jugement (date anniversaire, indice précis) peut différer.
 */
export function calculerPensionArrieres(p: ParamsPension): ResultatCalcul {
  const ipc = BAREMES.ipc.valeurs as Record<string, number>;
  const avertissements: string[] = [
    "Revalorisation simplifiée au 1er janvier sur l'indice annuel moyen (IPC hors tabac) — vérifiez la clause d'indexation exacte de votre jugement (date anniversaire, série d'indice).",
    "Les valeurs d'indices doivent être vérifiées sur insee.fr avant tout usage officiel.",
  ];

  const refIndice = ipc[String(p.annee_fixation - 1)] ?? ipc[String(p.annee_fixation)];
  if (!refIndice) throw new Error(`Indice IPC indisponible pour ${p.annee_fixation}`);

  const debut = new Date(p.date_debut + "T00:00:00");
  const fin = new Date(p.date_fin + "T00:00:00");
  if (fin < debut) throw new Error("La date de fin doit suivre la date de début");

  // Prescription : 5 ans en arrière depuis la fin de période (art. 2224 c. civ.)
  const limite = new Date(fin);
  limite.setFullYear(limite.getFullYear() - 5);
  let debutEffectif = debut;
  if (debut < limite) {
    debutEffectif = limite;
    avertissements.push(
      `Les mensualités antérieures au ${limite.toLocaleDateString("fr-FR")} sont prescrites (5 ans, art. 2224 c. civ.) : période tronquée.`
    );
  }

  const etapes: ResultatCalcul["etapes"] = [];
  const parAnnee = new Map<number, { mois: number; due: number }>();
  let totalDu = 0;
  let totalPaye = 0;
  let nbMois = 0;

  const curseur = new Date(debutEffectif.getFullYear(), debutEffectif.getMonth(), 1);
  const finMois = new Date(fin.getFullYear(), fin.getMonth(), 1);
  while (curseur <= finMois) {
    const annee = curseur.getFullYear();
    const indice = ipc[String(annee - 1)] ?? null;
    const due = indice
      ? Math.round(p.pension_initiale * (indice / refIndice) * 100) / 100
      : p.pension_initiale;
    if (!indice && !avertissements.some((a) => a.includes(String(annee - 1)))) {
      avertissements.push(`Indice IPC ${annee - 1} indisponible : pension non revalorisée pour ${annee}.`);
    }
    totalDu += due;
    totalPaye += p.paye_mensuel;
    nbMois += 1;
    const agg = parAnnee.get(annee) ?? { mois: 0, due };
    agg.mois += 1;
    agg.due = due;
    parAnnee.set(annee, agg);
    curseur.setMonth(curseur.getMonth() + 1);
  }

  for (const [annee, { mois, due }] of [...parAnnee.entries()].sort((a, b) => a[0] - b[0])) {
    const indice = ipc[String(annee - 1)];
    etapes.push({
      libelle: `Année ${annee} (${mois} mois)`,
      formule: indice
        ? `${euros(p.pension_initiale)} × ${indice} / ${refIndice} = ${euros(due)} par mois`
        : `${euros(due)} par mois (non revalorisé)`,
      valeur: euros(due * mois),
    });
  }

  const arrieres = Math.max(0, Math.round((totalDu - totalPaye) * 100) / 100);
  etapes.push({
    libelle: "Total payé sur la période",
    formule: `${euros(p.paye_mensuel)} × ${nbMois} mois`,
    valeur: euros(totalPaye),
  });

  return {
    resultat: [
      { libelle: "Arriérés de pension (dû − payé)", valeur: euros(arrieres), accent: true },
      { libelle: "Total dû revalorisé sur la période", valeur: euros(totalDu) },
      {
        libelle: "Pension mensuelle revalorisée (dernière année)",
        valeur: euros([...parAnnee.values()].at(-1)?.due ?? p.pension_initiale),
      },
    ],
    etapes,
    sources: [
      { libelle: "Indexation des pensions alimentaires", reference: "art. 208 c. civ. (révision) ; clause d'indexation du jugement" },
      { libelle: "Indice utilisé", reference: BAREMES.ipc.nom + " — " + BAREMES.ipc.source },
      { libelle: "Prescription des arriérés", reference: "art. 2224 c. civ. (5 ans)" },
    ],
    avertissements,
  };
}
