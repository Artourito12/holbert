// Généré par scripts/build-baremes.mjs — NE PAS ÉDITER À LA MAIN.
// Source de vérité : les fichiers baremes/*.json à la racine du repo.
export const BAREMES = {
  "indemnite-licenciement": {
    "id": "indemnite-licenciement",
    "nom": "Indemnité légale de licenciement",
    "source": "art. R. 1234-2 du code du travail",
    "periodes": [
      {
        "effective_from": "1900-01-01",
        "effective_to": "2017-09-26",
        "taux_jusqua_10_ans": 0.2,
        "taux_au_dela_10_ans": 0.33333333,
        "note": "1/5 de mois par année + 2/15 au-delà de 10 ans (ancien R. 1234-2) : 1/5 + 2/15 = 1/3"
      },
      {
        "effective_from": "2017-09-27",
        "effective_to": null,
        "taux_jusqua_10_ans": 0.25,
        "taux_au_dela_10_ans": 0.33333333,
        "note": "1/4 de mois par année jusqu'à 10 ans, 1/3 au-delà (décret n° 2017-1398)"
      }
    ],
    "anciennete_minimale_mois": 8
  },
  "ipc": {
    "id": "ipc",
    "nom": "Indice des prix à la consommation — hors tabac, ensemble des ménages (moyenne annuelle, base 2015)",
    "source": "INSEE, série 001763852 — ⚠️ VALEURS À VÉRIFIER sur insee.fr avant production",
    "a_verifier": true,
    "valeurs": {
      "2014": 99.9,
      "2015": 100,
      "2016": 100.2,
      "2017": 101.2,
      "2018": 102.9,
      "2019": 104,
      "2020": 104.5,
      "2021": 106.2,
      "2022": 111.7,
      "2023": 117.1,
      "2024": 119.7,
      "2025": 121
    }
  },
  "prescriptions": {
    "id": "prescriptions",
    "nom": "Délais de prescription",
    "source": "Code civil, code de la consommation, code du travail",
    "delais": [
      {
        "id": "droit_commun",
        "libelle": "Action personnelle ou mobilière (droit commun)",
        "annees": 5,
        "fondement": "art. 2224 c. civ."
      },
      {
        "id": "consommation",
        "libelle": "Action d'un professionnel contre un consommateur",
        "annees": 2,
        "fondement": "art. L. 218-2 c. consom."
      },
      {
        "id": "salaires",
        "libelle": "Paiement ou répétition de salaires",
        "annees": 3,
        "fondement": "art. L. 3245-1 c. trav."
      },
      {
        "id": "loyers",
        "libelle": "Loyers et charges (bail d'habitation)",
        "annees": 3,
        "fondement": "art. 7-1 loi du 6 juillet 1989"
      },
      {
        "id": "dommage_corporel",
        "libelle": "Réparation d'un dommage corporel",
        "annees": 10,
        "fondement": "art. 2226 c. civ."
      },
      {
        "id": "immobiliere",
        "libelle": "Action réelle immobilière",
        "annees": 30,
        "fondement": "art. 2227 c. civ."
      },
      {
        "id": "titre_executoire",
        "libelle": "Exécution d'un titre exécutoire (jugement)",
        "annees": 10,
        "fondement": "art. L. 111-4 CPCE"
      }
    ],
    "interruptions": [
      {
        "id": "assignation",
        "libelle": "Demande en justice (assignation, même en référé)",
        "fondement": "art. 2241 c. civ."
      },
      {
        "id": "execution_forcee",
        "libelle": "Acte d'exécution forcée (saisie…)",
        "fondement": "art. 2244 c. civ."
      },
      {
        "id": "reconnaissance",
        "libelle": "Reconnaissance de son droit par le débiteur",
        "fondement": "art. 2240 c. civ."
      }
    ],
    "suspensions": [
      {
        "id": "mediation",
        "libelle": "Médiation ou conciliation",
        "fondement": "art. 2238 c. civ."
      },
      {
        "id": "impossibilite_agir",
        "libelle": "Impossibilité d'agir (force majeure)",
        "fondement": "art. 2234 c. civ."
      }
    ]
  }
} as const;
