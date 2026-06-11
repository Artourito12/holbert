// Généré par scripts/build-referentiels.mjs — NE PAS ÉDITER À LA MAIN.
export type ReferentielQuestion = {
  id: string;
  question: string;
  pourquoi: string;
};

export type ReferentielInfo = {
  id: string;
  nom: string;
  famille: string;
  version: number;
  roles: string[];
  questions: Record<string, ReferentielQuestion[]>;
  faits_requis: { id: string; libelle: string }[];
};

export const REFERENTIELS_REGISTRY: ReferentielInfo[] = [
  {
    "id": "bail-commercial",
    "nom": "Bail commercial",
    "famille": "baux",
    "version": 1,
    "roles": [
      "bailleur",
      "preneur"
    ],
    "questions": {
      "bailleur": [
        {
          "id": "objectif",
          "question": "Souhaitez-vous sécuriser un revenu long terme ou garder la possibilité de récupérer les locaux ?",
          "pourquoi": "Oriente la durée ferme, les garanties et la clause de destination."
        },
        {
          "id": "solvabilite",
          "question": "Quelles garanties le preneur peut-il fournir (caution, garantie bancaire) ?",
          "pourquoi": "Le dépôt de garantie seul couvre rarement plus d'un trimestre d'impayés."
        }
      ],
      "preneur": [
        {
          "id": "evolution_activite",
          "question": "Votre activité peut-elle évoluer dans les 9 prochaines années ?",
          "pourquoi": "Une destination trop étroite bloque toute diversification sans accord du bailleur."
        },
        {
          "id": "sortie",
          "question": "Avez-vous besoin de flexibilité pour quitter les locaux avant 9 ans ?",
          "pourquoi": "Les échéances triennales sont votre seule porte de sortie sans frais — vérifier qu'elles ne sont pas neutralisées."
        }
      ]
    },
    "faits_requis": [
      {
        "id": "parties",
        "libelle": "Bailleur et preneur (identités complètes, SIREN si sociétés)"
      },
      {
        "id": "locaux",
        "libelle": "Désignation des locaux loués (adresse, surface, lots)"
      },
      {
        "id": "destination",
        "libelle": "Destination contractuelle des lieux (activités autorisées)"
      },
      {
        "id": "date_prise_effet",
        "libelle": "Date de prise d'effet du bail"
      },
      {
        "id": "duree",
        "libelle": "Durée du bail (9 ans minimum sauf dérogatoire)"
      },
      {
        "id": "loyer_annuel",
        "libelle": "Loyer annuel HT/HC"
      }
    ]
  },
  {
    "id": "cgv",
    "nom": "Conditions générales de vente (CGV)",
    "famille": "conditions-generales",
    "version": 1,
    "roles": [
      "vendeur",
      "acheteur"
    ],
    "questions": {
      "vendeur": [
        {
          "id": "canal",
          "question": "Vendez-vous en ligne, à distance ou uniquement en face à face ?",
          "pourquoi": "La vente à distance B2C déclenche le formalisme de la rétractation et de l'information précontractuelle."
        },
        {
          "id": "cible",
          "question": "Vos clients sont-ils des particuliers, des professionnels ou les deux ?",
          "pourquoi": "Le droit de la consommation impose des mentions spécifiques ; des CGV mixtes mal séparées sont le défaut le plus fréquent."
        }
      ],
      "acheteur": [
        {
          "id": "negociation",
          "question": "Souhaitez-vous négocier des conditions particulières (les CGV ne sont qu'un socle) ?",
          "pourquoi": "En B2B, les CGV constituent le socle unique de la négociation (L. 441-1) — tout est discutable."
        }
      ]
    },
    "faits_requis": [
      {
        "id": "emetteur",
        "libelle": "Société émettrice des CGV (identité, SIREN, contact)"
      },
      {
        "id": "public_vise",
        "libelle": "Public visé : consommateurs (B2C), professionnels (B2B) ou mixte"
      }
    ]
  },
  {
    "id": "prestation-services",
    "nom": "Contrat de prestation de services",
    "famille": "prestataires",
    "version": 1,
    "roles": [
      "prestataire",
      "client"
    ],
    "questions": {
      "prestataire": [
        {
          "id": "perimetre",
          "question": "Le périmètre peut-il évoluer en cours de mission (avenants, demandes hors forfait) ?",
          "pourquoi": "Sans procédure de gestion des changements, tout ajout est réputé inclus dans le forfait."
        },
        {
          "id": "reutilisation",
          "question": "Souhaitez-vous réutiliser des composants génériques développés pour cette mission ?",
          "pourquoi": "Une cession totale vous interdirait de réutiliser votre propre savoir-faire outillé."
        }
      ],
      "client": [
        {
          "id": "dependance",
          "question": "Que se passe-t-il si le prestataire devient indisponible (réversibilité, documentation) ?",
          "pourquoi": "Sans clause de réversibilité, vous dépendez de lui pour toute la durée de vie du livrable."
        },
        {
          "id": "propriete",
          "question": "Avez-vous besoin de la propriété pleine des livrables ou d'un simple droit d'usage ?",
          "pourquoi": "La cession complète se négocie et se paie ; un droit d'usage suffit souvent."
        }
      ]
    },
    "faits_requis": [
      {
        "id": "parties",
        "libelle": "Prestataire et client (identités, SIREN)"
      },
      {
        "id": "objet",
        "libelle": "Objet de la prestation et livrables attendus"
      },
      {
        "id": "prix",
        "libelle": "Prix (forfait / régie, HT, modalités de facturation)"
      }
    ]
  },
  {
    "id": "generique",
    "nom": "Document juridique (générique)",
    "famille": "autres",
    "version": 1,
    "roles": [],
    "questions": {},
    "faits_requis": []
  }
];

export function referentielNom(id: string | null | undefined): string {
  if (!id) return "Type inconnu";
  return REFERENTIELS_REGISTRY.find((r) => r.id === id)?.nom ?? id;
}
