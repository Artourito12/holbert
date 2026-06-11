// Généré par scripts/build-referentiels.mjs — NE PAS ÉDITER À LA MAIN.
export type ReferentielInfo = {
  id: string;
  nom: string;
  famille: string;
  version: number;
  roles: string[];
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
    ]
  },
  {
    "id": "generique",
    "nom": "Document juridique (générique)",
    "famille": "autres",
    "version": 1,
    "roles": []
  }
];

export function referentielNom(id: string | null | undefined): string {
  if (!id) return "Type inconnu";
  return REFERENTIELS_REGISTRY.find((r) => r.id === id)?.nom ?? id;
}
