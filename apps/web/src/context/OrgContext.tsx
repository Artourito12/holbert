import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Entitlement, ModuleId, Org } from "@holbert/core";
import { PLATFORM_NAME } from "@holbert/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const CURRENT_ORG_KEY = "holbert.currentOrgId";

type OrgContextType = {
  orgs: Org[];
  currentOrg: Org | null;
  entitlements: Entitlement[];
  isPlatformAdmin: boolean;
  loading: boolean;
  /** Vrai si le module est actif pour l'organisation courante. */
  hasModule: (module: ModuleId) => boolean;
  switchOrg: (orgId: string) => void;
  createOrganization: (name: string) => Promise<{ error: string | null }>;
  refresh: () => Promise<void>;
};

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() =>
    localStorage.getItem(CURRENT_ORG_KEY)
  );
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setEntitlements([]);
      setIsPlatformAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Rattache les invitations en attente pour cet email (idempotent)
    await supabase.rpc("accepter_invitations").then(({ error }) => {
      if (error) console.error(`[${PLATFORM_NAME}] accepter_invitations:`, error.message);
    });

    const [orgsRes, adminRes] = await Promise.all([
      supabase.from("orgs").select("*").order("created_at"),
      supabase.from("platform_admins").select("user_id").eq("user_id", user.id),
    ]);

    if (orgsRes.error) {
      console.error(`[${PLATFORM_NAME}] fetchOrgs:`, orgsRes.error);
    }
    setOrgs((orgsRes.data as Org[]) ?? []);
    setIsPlatformAdmin((adminRes.data?.length ?? 0) > 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentOrg = useMemo(() => {
    if (orgs.length === 0) return null;
    return orgs.find((o) => o.id === currentOrgId) ?? orgs[0];
  }, [orgs, currentOrgId]);

  useEffect(() => {
    if (currentOrg) localStorage.setItem(CURRENT_ORG_KEY, currentOrg.id);
  }, [currentOrg]);

  useEffect(() => {
    if (!currentOrg) {
      setEntitlements([]);
      return;
    }
    supabase
      .from("entitlements")
      .select("*")
      .eq("org_id", currentOrg.id)
      .then(({ data, error }) => {
        if (error) console.error(`[${PLATFORM_NAME}] fetchEntitlements:`, error);
        setEntitlements((data as Entitlement[]) ?? []);
      });
  }, [currentOrg]);

  const hasModule = useCallback(
    (module: ModuleId) =>
      entitlements.some((e) => e.module === module && e.active),
    [entitlements]
  );

  const switchOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
    localStorage.setItem(CURRENT_ORG_KEY, orgId);
  }, []);

  const createOrganization = useCallback(
    async (name: string) => {
      const { data, error } = await supabase.rpc("create_organization", {
        p_name: name,
      });
      if (error) return { error: error.message };
      await refresh();
      if (data?.id) switchOrg(data.id as string);
      return { error: null };
    },
    [refresh, switchOrg]
  );

  return (
    <OrgContext.Provider
      value={{
        orgs,
        currentOrg,
        entitlements,
        isPlatformAdmin,
        loading,
        hasModule,
        switchOrg,
        createOrganization,
        refresh,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
};
