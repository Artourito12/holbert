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

export type ChatMessage = {
  id: string;
  conversation_id: string;
  org_id: string;
  role: "user" | "assistant";
  contenu: string;
  intent: Record<string, unknown> | null;
  sources: ChatSource[] | null;
  widget: Record<string, unknown> | null;
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

export type Piece = {
  id: string;
  dossier_id: string;
  org_id: string;
  document_id: string;
  numero: number;
  intitule: string;
  communiquee: boolean;
  created_at: string;
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
