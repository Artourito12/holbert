import { useCallback, useEffect, useState } from "react";
import type { Entitlement, ModuleId, Profile } from "@holbert/core";
import { MODULES, ACTIVABLE_MODULE_IDS, PLATFORM_NAME } from "@holbert/core";
import { supabase } from "../../lib/supabase";
import { useOrg } from "../../context/OrgContext";

type AdminOrg = {
  id: string;
  name: string;
  created_at: string;
  org_members: { user_id: string }[];
  entitlements: Entitlement[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminPage() {
  const { refresh } = useOrg();
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [orgsRes, profilesRes] = await Promise.all([
      supabase
        .from("orgs")
        .select("id, name, created_at, org_members(user_id), entitlements(*)")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (orgsRes.error || profilesRes.error) {
      setError(
        orgsRes.error?.message ?? profilesRes.error?.message ?? "Erreur inconnue"
      );
    } else {
      setOrgs((orgsRes.data as AdminOrg[]) ?? []);
      setProfiles((profilesRes.data as Profile[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleModule = async (org: AdminOrg, module: ModuleId) => {
    const existing = org.entitlements.find((e) => e.module === module);
    const nextActive = existing ? !existing.active : true;
    setPending(`${org.id}:${module}`);

    const { error } = await supabase
      .from("entitlements")
      .upsert(
        { org_id: org.id, module, active: nextActive },
        { onConflict: "org_id,module" }
      );

    setPending(null);
    if (error) {
      setError(`Impossible de modifier ${MODULES[module].name} : ${error.message}`);
      return;
    }
    await load();
    await refresh(); // si l'admin modifie sa propre org, la sidebar suit
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          Administration {PLATFORM_NAME}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Organisations inscrites et activation des modules. Chaque modification
          est tracée dans le journal d'audit.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700"
        >
          {error}
        </div>
      )}

      <section className="mb-8 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Organisations
            <span className="ml-2 text-sm font-normal text-gray-400">
              {orgs.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-gray-500">Chargement…</p>
        ) : orgs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500">
            Aucune organisation pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="px-5 py-3 text-theme-xs font-medium uppercase text-gray-400">
                    Organisation
                  </th>
                  <th className="px-5 py-3 text-theme-xs font-medium uppercase text-gray-400">
                    Créée le
                  </th>
                  <th className="px-5 py-3 text-theme-xs font-medium uppercase text-gray-400">
                    Membres
                  </th>
                  <th className="px-5 py-3 text-theme-xs font-medium uppercase text-gray-400">
                    Modules
                  </th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr
                    key={org.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {org.name}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(org.created_at)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {org.org_members.length}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {ACTIVABLE_MODULE_IDS.map((module) => {
                          const active = org.entitlements.some(
                            (e) => e.module === module && e.active
                          );
                          const isPending = pending === `${org.id}:${module}`;
                          return (
                            <button
                              key={module}
                              onClick={() => toggleModule(org, module)}
                              disabled={isPending}
                              title={
                                active
                                  ? `Désactiver ${MODULES[module].name}`
                                  : `Activer ${MODULES[module].name}`
                              }
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
                                active
                                  ? "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/[0.12] dark:text-brand-400"
                                  : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                              }`}
                            >
                              {MODULES[module].name}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Derniers inscrits
            <span className="ml-2 text-sm font-normal text-gray-400">
              {profiles.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-gray-500">Chargement…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="px-5 py-3 text-theme-xs font-medium uppercase text-gray-400">
                    Nom
                  </th>
                  <th className="px-5 py-3 text-theme-xs font-medium uppercase text-gray-400">
                    Email
                  </th>
                  <th className="px-5 py-3 text-theme-xs font-medium uppercase text-gray-400">
                    Inscrit le
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr
                    key={p.user_id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {p.full_name ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {p.email}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
