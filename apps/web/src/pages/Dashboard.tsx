import { MODULES, MODULE_IDS, PLATFORM_NAME } from "@holbert/core";
import { useOrg } from "../context/OrgContext";

export default function Dashboard() {
  const { currentOrg, hasModule } = useOrg();
  const activeModules = MODULE_IDS.filter((id) => hasModule(id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          {currentOrg ? `Espace ${currentOrg.name}` : `Bienvenue dans ${PLATFORM_NAME}`}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Votre plateforme d'information juridique et d'aide à la décision.
        </p>
      </div>

      {activeModules.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Aucun module activé pour le moment
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Votre espace est prêt. L'activation des modules ({MODULES.raader.name},{" "}
            {MODULES.normer.name}, {MODULES.pleiter.name}) est gérée par l'équipe{" "}
            {PLATFORM_NAME} — vous serez notifié dès qu'un module sera disponible.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeModules.map((id) => {
            const mod = MODULES[id];
            return (
              <div
                key={id}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400">
                    Actif
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {mod.name}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {mod.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
        {PLATFORM_NAME} fournit de l'information juridique et des outils d'aide à
        la décision, pas du conseil juridique individualisé. Pour un conseil
        adapté à votre situation, rapprochez-vous d'un professionnel du droit.
      </p>
    </div>
  );
}
