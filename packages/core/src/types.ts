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
