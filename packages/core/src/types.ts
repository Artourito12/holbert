import type { ModuleId } from "./modules";

export type OrgRole = "owner" | "admin" | "member";

export type Org = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type OrgMember = {
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
};

export type Profile = {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

export type Entitlement = {
  org_id: string;
  module: ModuleId;
  options: Record<string, unknown>;
  active: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type DocumentStatut =
  | "uploaded"
  | "processing"
  | "classified"
  | "extracting"
  | "ready"
  | "error";

export type Document = {
  id: string;
  org_id: string;
  nom_fichier: string;
  mime: string;
  taille: number;
  hash_sha256: string | null;
  storage_path: string;
  statut: DocumentStatut;
  erreur: string | null;
  type_detecte: string | null;
  type_confiance: number | null;
  indices: string[];
  type_confirme: string | null;
  referentiel_version: number | null;
  version_de: string | null;
  texte: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export type Audit = {
  id: string;
  org_id: string;
  document_id: string;
  role: string;
  objectif: "signer" | "renegocier" | "sortir" | "comprendre";
  referentiel_id: string;
  referentiel_version: number;
  statut: "running" | "done" | "error";
  erreur: string | null;
  score: number | null;
  synthese: string | null;
  created_by: string;
  created_at: string;
};

export type AuditFinding = {
  id: string;
  audit_id: string;
  org_id: string;
  categorie: "manquante" | "illegale" | "defavorable" | "incoherence";
  titre: string;
  passage: string | null;
  gravite: "mineure" | "moyenne" | "majeure";
  fondement: string | null;
  explication: string | null;
  reformulation: string | null;
  ordre: number;
};

export type GeneratedDocument = {
  id: string;
  org_id: string;
  type: string;
  role: string | null;
  variante: "protectrice_a" | "equilibree" | "protectrice_b";
  titre: string;
  reponses: Record<string, string>;
  contenu: string;
  created_by: string;
  created_at: string;
};

export type ExtractedFact = {
  id: string;
  document_id: string;
  org_id: string;
  fait_id: string;
  type: string;
  valeur: {
    texte: string;
    date: string | null;
    montant: number | null;
    items: { libelle: string; date?: string; montant?: number }[] | null;
  };
  passage_source: string | null;
  confiance: number | null;
};

export type Deadline = {
  id: string;
  org_id: string;
  document_id: string | null;
  fait_id: string | null;
  titre: string;
  date_echeance: string;
  paliers_alerte: number[];
  statut: "a_venir" | "traitee" | "ignoree";
  created_at: string;
};

export type AppNotification = {
  id: string;
  org_id: string;
  user_id: string;
  titre: string;
  corps: string | null;
  lien: string | null;
  lue: boolean;
  created_at: string;
};

export type Conversation = {
  id: string;
  org_id: string;
  created_by: string;
  titre: string;
  created_at: string;
};

export type ChatSource = {
  n: number;
  document_id: string;
  nom_fichier: string;
  position: number;
  extrait: string;
};

export type SourceLoi = {
  citation: string;
  code: string;
  trouve: boolean;
  etat: string | null;
  url: string | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  org_id: string;
  role: "user" | "assistant";
  contenu: string;
  intent: Record<string, unknown> | null;
  sources: ChatSource[] | null;
  widget: Record<string, unknown> | null;
  sources_loi: SourceLoi[] | null;
  created_at: string;
};

export type Dossier = {
  id: string;
  org_id: string;
  nom: string;
  parties: { demandeur?: string; defendeur?: string; autres?: string };
  juridiction: string | null;
  type_procedure: string | null;
  enjeu_financier: number | null;
  statut: "actif" | "clos";
  created_by: string;
  created_at: string;
};

/** Camp d'une pièce : les nôtres (bordereau), celles de l'adversaire, les actes de procédure. */
export type CampPiece = "nous" | "adverse" | "procedure";

export type Piece = {
  id: string;
  dossier_id: string;
  org_id: string;
  document_id: string;
  camp: CampPiece;
  numero: number;
  intitule: string;
  /** Intitulé de bordereau proposé par l'IA après lecture de la pièce. */
  titre_propose: string | null;
  /** Date portée par la pièce (extraite par l'IA, sinon saisie par l'utilisateur). */
  date_piece: string | null;
  communiquee: boolean;
  created_at: string;
};

/** Scan complet d'un dossier contentieux par l'IA (docs/10 phase 2). */
export type ScanDossier = {
  id: string;
  org_id: string;
  dossier_id: string;
  created_by: string;
  contexte: string;
  etapes: { id: string; label: string; statut: "a_faire" | "en_cours" | "fait" }[];
  statut: "en_cours" | "terminee" | "erreur";
  etape_courante: string | null;
  progression: number;
  document: string | null;
  demarche: { etape: string; detail: string }[];
  erreur: string | null;
  created_at: string;
  updated_at: string;
};

export type EvenementChronologie = {
  id: string;
  dossier_id: string;
  org_id: string;
  date: string;
  titre: string;
  description: string | null;
  piece_id: string | null;
  source_passage: string | null;
  origine: "ia" | "manuel";
  created_by: string | null;
  created_at: string;
};

export type AnalyseDossier = {
  id: string;
  dossier_id: string;
  org_id: string;
  type: "vices" | "prescription" | "synthese" | "conclusions";
  statut: "running" | "done" | "error";
  resultat: { findings?: AnalyseFinding[] } | null;
  contenu: string | null;
  created_by: string;
  created_at: string;
};

export type AnalyseFinding = {
  titre: string;
  gravite: "mineure" | "moyenne" | "majeure";
  explication: string;
  fondement?: string;
  evenements_lies?: string[];
  action_recommandee?: string;
};

export type Demande = {
  id: string;
  org_id: string;
  created_by: string;
  objet: string;
  description: string | null;
  categorie: string | null;
  priorite: "basse" | "normale" | "haute" | "critique";
  statut: "nouvelle" | "a_valider" | "repondue" | "cloturee";
  reponse_ia: string | null;
  reponse_finale: string | null;
  validee_par: string | null;
  validee_at: string | null;
  created_at: string;
};

export type ReponseType = {
  id: string;
  org_id: string;
  question: string;
  reponse: string;
  categorie: string | null;
  valide_par: string | null;
  usage_count: number;
  created_at: string;
};

export type OrgProfil = {
  org_id: string;
  activite: string | null;
  forme_juridique: string | null;
  effectif: string | null;
  convention_collective: string | null;
  implantations: string | null;
  contexte_ia: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type Invitation = {
  id: string;
  org_id: string;
  email: string;
  role: "admin" | "member";
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
};

export type SourceRecherche = {
  type: "jurisprudence" | "texte" | "document" | "eu";
  titre: string;
  reference: string;
  url: string | null;
  extrait?: string;
};

export type RechercheQuestion = {
  id: string;
  question: string;
  justification?: string;
  statut: "a_faire" | "fait";
  section?: string;
  sources?: SourceRecherche[];
};

export type Recherche = {
  id: string;
  org_id: string;
  conversation_id: string;
  created_by: string;
  question_initiale: string;
  comprehension: string | null;
  questions: RechercheQuestion[];
  statut: "attente_validation" | "en_cours" | "terminee" | "erreur";
  etape_courante: string | null;
  progression: number;
  document: string | null;
  demarche: { etape: string; detail: string }[];
  erreur: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogEntry = {
  id: number;
  org_id: string | null;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
