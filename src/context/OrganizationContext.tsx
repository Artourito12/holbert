import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  legal_form: string | null;
  siren: string | null;
  sector: string | null;
  size_range: string | null;
  created_by: string;
  created_at: string;
};

export type OrgRole = "owner" | "admin" | "member" | "viewer";

type OrgMembership = {
  org_id: string;
  role: OrgRole;
  organizations: Organization;
};

type OrganizationContextType = {
  orgs: Organization[];
  currentOrg: Organization | null;
  currentRole: OrgRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  switchOrg: (orgId: string) => void;
  createOrg: (input: {
    name: string;
    legal_form?: string;
    sector?: string;
    size_range?: string;
  }) => Promise<{ org: Organization | null; error: string | null }>;
};

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined,
);

const CURRENT_ORG_KEY = "holbert.currentOrgId";

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setMemberships([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(*)")
      .eq("user_id", user.id);

    if (error) {
      console.error("[Holbert] fetchOrgs:", error);
      setOrgs([]);
      setMemberships([]);
    } else {
      const ms = (data ?? []) as unknown as OrgMembership[];
      setMemberships(ms);
      const list = ms.map((m) => m.organizations).filter(Boolean);
      setOrgs(list);
      const stored = localStorage.getItem(CURRENT_ORG_KEY);
      const valid = list.find((o) => o.id === stored);
      setCurrentOrgId(valid?.id ?? list[0]?.id ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const switchOrg = (orgId: string) => {
    setCurrentOrgId(orgId);
    localStorage.setItem(CURRENT_ORG_KEY, orgId);
  };

  const createOrg: OrganizationContextType["createOrg"] = async (input) => {
    if (!user) return { org: null, error: "Non connecté" };

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: input.name,
        legal_form: input.legal_form || null,
        sector: input.sector || null,
        size_range: input.size_range || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (orgErr || !org) {
      return { org: null, error: orgErr?.message ?? "Création échouée" };
    }

    const { error: memberErr } = await supabase.from("org_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberErr) {
      return { org: null, error: memberErr.message };
    }

    await fetchOrgs();
    switchOrg(org.id);
    return { org, error: null };
  };

  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? null;
  const currentRole =
    memberships.find((m) => m.org_id === currentOrgId)?.role ?? null;

  return (
    <OrganizationContext.Provider
      value={{
        orgs,
        currentOrg,
        currentRole,
        loading,
        refresh: fetchOrgs,
        switchOrg,
        createOrg,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
};
