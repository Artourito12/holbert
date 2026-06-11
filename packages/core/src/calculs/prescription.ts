import { BAREMES } from "../baremes.generated";
import type { ResultatCalcul } from "./types";
import { dateFr } from "./types";

export type EvenementPrescription = {
  type: "interruption" | "suspension";
  cause: string;
  date: string;
  /** Pour une suspension : date de fin de la cause (reprise du délai). */
  date_fin?: string;
};

export type ParamsPrescription = {
  type_action: string;
  /** Point de départ : jour où le titulaire a connu ou aurait dû connaître les faits. */
  point_depart: string;
  evenements?: EvenementPrescription[];
  /** Date à laquelle on évalue la prescription (en général : aujourd'hui). */
  date_reference: string;
};

/** Format ISO local (sans conversion UTC — évite les décalages de fuseau). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ajouterAnnees(iso: string, annees: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setFullYear(d.getFullYear() + annees);
  return isoLocal(d);
}

function ajouterJours(iso: string, jours: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + jours);
  return isoLocal(d);
}

function joursEntre(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000
  );
}

export function calculerPrescription(p: ParamsPrescription): ResultatCalcul {
  const cat = BAREMES.prescriptions;
  const delai = cat.delais.find((d) => d.id === p.type_action);
  if (!delai) throw new Error(`Type d'action inconnu : ${p.type_action}`);

  const avertissements: string[] = [
    "Le point de départ exact (connaissance des faits) est souvent l'enjeu central du débat : ce calcul suppose celui que vous avez indiqué.",
    "Délai butoir : le report du point de départ ou les suspensions ne peuvent étendre la prescription au-delà de 20 ans après la naissance du droit (art. 2232 c. civ.).",
  ];

  const etapes: ResultatCalcul["etapes"] = [
    {
      libelle: "Délai applicable",
      formule: `${delai.libelle}`,
      valeur: `${delai.annees} ans (${delai.fondement})`,
    },
    {
      libelle: "Point de départ",
      formule: "Connaissance des faits permettant d'agir (art. 2224 c. civ.)",
      valeur: dateFr(p.point_depart),
    },
  ];

  let echeance = ajouterAnnees(p.point_depart, delai.annees);
  const evenements = [...(p.evenements ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  for (const ev of evenements) {
    if (ev.date > echeance) {
      etapes.push({
        libelle: `${ev.cause} (${dateFr(ev.date)})`,
        formule: "Sans effet : la prescription était déjà acquise à cette date",
        valeur: `échéance inchangée : ${dateFr(echeance)}`,
      });
      continue;
    }
    if (ev.type === "interruption") {
      echeance = ajouterAnnees(ev.date, delai.annees);
      etapes.push({
        libelle: `Interruption — ${ev.cause} (${dateFr(ev.date)})`,
        formule: `Un nouveau délai complet de ${delai.annees} ans court (art. 2231 c. civ.)`,
        valeur: `nouvelle échéance : ${dateFr(echeance)}`,
      });
    } else {
      const fin = ev.date_fin ?? p.date_reference;
      const jours = Math.max(0, joursEntre(ev.date, fin));
      echeance = ajouterJours(echeance, jours);
      etapes.push({
        libelle: `Suspension — ${ev.cause} (${dateFr(ev.date)} → ${dateFr(fin)})`,
        formule: `Le délai est gelé ${jours} jour(s) (art. 2230 c. civ.)`,
        valeur: `échéance reportée : ${dateFr(echeance)}`,
      });
    }
  }

  const acquise = p.date_reference > echeance;
  const joursRestants = joursEntre(p.date_reference, echeance);

  return {
    resultat: [
      {
        libelle: acquise ? "Prescription ACQUISE" : "Action encore possible",
        valeur: acquise
          ? `depuis le ${dateFr(echeance)}`
          : `jusqu'au ${dateFr(echeance)} (${joursRestants} jours restants)`,
        accent: true,
      },
    ],
    etapes,
    sources: [
      { libelle: "Délai", reference: delai.fondement },
      { libelle: "Interruption", reference: "art. 2240, 2241 et 2244 c. civ." },
      { libelle: "Suspension", reference: "art. 2230, 2234 et 2238 c. civ." },
    ],
    avertissements,
  };
}

/** Catalogue pour les interfaces (sélecteur de type d'action). */
export function typesActionsPrescription() {
  return BAREMES.prescriptions.delais.map((d) => ({
    id: d.id,
    libelle: d.libelle,
    annees: d.annees,
    fondement: d.fondement,
  }));
}
