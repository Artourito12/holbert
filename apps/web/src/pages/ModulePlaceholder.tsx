import { Navigate } from "react-router";
import type { ModuleId } from "@holbert/core";
import { MODULES } from "@holbert/core";
import { useOrg } from "../context/OrgContext";

const ETAPES: Record<ModuleId, string> = {
  raader: "L'audit de contrats arrive au jalon 3, le chat au jalon 4.",
  pleiter: "La gestion de dossiers arrive au jalon 5.",
  normer: "Le Front Door arrive au jalon 6.",
};

export default function ModulePlaceholder({ module }: { module: ModuleId }) {
  const { hasModule, loading } = useOrg();
  const mod = MODULES[module];

  if (!loading && !hasModule(module)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
        {mod.name}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {mod.description}
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Module activé — en cours de construction
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
          {ETAPES[module]}
        </p>
      </div>
    </div>
  );
}
