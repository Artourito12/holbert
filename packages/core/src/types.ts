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
  uploaded_by: string;
  created_at: string;
  updated_at: string;
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
