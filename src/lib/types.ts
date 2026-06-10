export type ContractStatus =
  | "draft"
  | "active"
  | "expired"
  | "renewed"
  | "terminated"
  | "archived";

export type ContractRisk = "green" | "orange" | "red" | "unknown";

export type ContractType =
  | "nda"
  | "prestataire"
  | "bail"
  | "cdi"
  | "cdd"
  | "cgv"
  | "cgu"
  | "cession"
  | "licence"
  | "pacte"
  | "autre";

export type Contract = {
  id: string;
  org_id: string;
  title: string;
  contract_type: ContractType | null;
  counterparty: string | null;
  status: ContractStatus;
  signed_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  renewal_at: string | null;
  amount_cents: number | null;
  currency: string | null;
  tags: string[];
  storage_path: string | null;
  original_filename: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  risk_level: ContractRisk;
  risk_score: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AnalysisStatus = "pending" | "running" | "done" | "error";

export type ContractAnalysis = {
  id: string;
  org_id: string;
  contract_id: string;
  status: AnalysisStatus;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  executive_summary: string | null;
  extracted_clauses: Record<string, unknown> | null;
  improvement_suggestions: unknown[] | null;
  global_risk: ContractRisk | null;
  global_risk_score: number | null;
  confidence_level: "green" | "orange" | "red" | null;
  created_by: string;
  created_at: string;
};

export const CONTRACT_TYPES: { value: ContractType; label: string; description: string }[] = [
  { value: "nda", label: "Accord de confidentialité (NDA)", description: "Unilatéral ou mutuel" },
  { value: "prestataire", label: "Contrat de prestataire", description: "Mission, régie, forfait" },
  { value: "bail", label: "Bail commercial / habitation", description: "3-6-9, sous-location…" },
  { value: "cdi", label: "Contrat de travail (CDI)", description: "Cadre ou non-cadre" },
  { value: "cdd", label: "Contrat de travail (CDD)", description: "Avec terme précis ou non" },
  { value: "cgv", label: "CGV / CGU", description: "Conditions générales" },
  { value: "cession", label: "Cession de droits / parts", description: "PI, BSPCE, cession d'actions" },
  { value: "licence", label: "Licence", description: "Exclusive ou non-exclusive" },
  { value: "pacte", label: "Pacte d'actionnaires", description: "Gouvernance, sortie" },
  { value: "autre", label: "Autre contrat", description: "Type non listé" },
];

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 Mo

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export function isAllowedFile(file: File): boolean {
  if (file.size > MAX_UPLOAD_BYTES) return false;
  if (ALLOWED_MIME_TYPES.includes(file.type)) return true;
  // Fallback : checker l'extension si le MIME est vide (cas Windows)
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
