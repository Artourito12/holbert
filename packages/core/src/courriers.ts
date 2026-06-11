/** Catalogue des courriers simples générables (Raader, brief §3.3 — extensible). */
export type CourrierChamp = {
  id: string;
  libelle: string;
  placeholder?: string;
  multiligne?: boolean;
};

export type CourrierType = {
  id: string;
  nom: string;
  description: string;
  champs: CourrierChamp[];
};

export const COURRIERS: CourrierType[] = [
  {
    id: "mise_en_demeure_paiement",
    nom: "Mise en demeure de payer",
    description:
      "Dernier avertissement avant action : fait courir les intérêts de retard (art. 1344-1 c. civ.) et interrompt certaines démarches amiables.",
    champs: [
      { id: "expediteur", libelle: "Vous (nom, adresse)", multiligne: true },
      { id: "destinataire", libelle: "Débiteur (nom, adresse)", multiligne: true },
      { id: "creance", libelle: "Origine de la créance", placeholder: "Facture n°123 du 5 mars 2026, prestation de…", multiligne: true },
      { id: "montant", libelle: "Montant dû (€)" },
      { id: "delai_jours", libelle: "Délai accordé (jours)", placeholder: "8" },
    ],
  },
  {
    id: "resiliation_bail_locataire",
    nom: "Congé du locataire (résiliation de bail)",
    description:
      "Préavis de 3 mois (1 mois en zone tendue ou cas légaux — art. 15 loi du 6 juillet 1989). LRAR, acte d'huissier ou remise en main propre.",
    champs: [
      { id: "locataire", libelle: "Locataire (nom, adresse du logement)", multiligne: true },
      { id: "bailleur", libelle: "Bailleur (nom, adresse)", multiligne: true },
      { id: "date_entree", libelle: "Date d'entrée dans les lieux" },
      { id: "motif_preavis_reduit", libelle: "Motif de préavis réduit (le cas échéant)", placeholder: "Zone tendue, mutation, perte d'emploi… ou laisser vide" },
    ],
  },
  {
    id: "resiliation_assurance",
    nom: "Résiliation d'un contrat d'assurance",
    description:
      "À échéance (loi Chatel) ou à tout moment après un an (loi Hamon, art. L. 113-15-2 c. assur.).",
    champs: [
      { id: "assure", libelle: "Vous (nom, adresse, n° de contrat)", multiligne: true },
      { id: "assureur", libelle: "Assureur (nom, adresse)", multiligne: true },
      { id: "type_contrat", libelle: "Type de contrat", placeholder: "Auto, habitation, complémentaire santé…" },
      { id: "date_souscription", libelle: "Date de souscription" },
    ],
  },
  {
    id: "restitution_depot_garantie",
    nom: "Demande de restitution du dépôt de garantie",
    description:
      "Délai de 1 mois (état des lieux conforme) ou 2 mois, majoration de 10 % du loyer par mois de retard (art. 22 loi du 6 juillet 1989).",
    champs: [
      { id: "locataire", libelle: "Vous (nom, nouvelle adresse)", multiligne: true },
      { id: "bailleur", libelle: "Bailleur (nom, adresse)", multiligne: true },
      { id: "logement", libelle: "Logement quitté (adresse)", multiligne: true },
      { id: "date_etat_lieux", libelle: "Date de l'état des lieux de sortie" },
      { id: "montant_depot", libelle: "Montant du dépôt de garantie (€)" },
    ],
  },
];
