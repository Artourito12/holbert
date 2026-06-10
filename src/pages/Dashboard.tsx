import { FolderOpen, FileText, Users, Bell } from "lucide-react";

const stats = [
  { label: "Dossiers actifs", value: "0", icon: FolderOpen },
  { label: "Documents", value: "0", icon: FileText },
  { label: "Contacts", value: "0", icon: Users },
  { label: "Alertes veille", value: "0", icon: Bell },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Bienvenue dans votre espace Holbert
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                  {value}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="size-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Démarrer
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Votre espace est prêt. Commencez par créer votre premier dossier ou
          importer un document.
        </p>
      </div>
    </div>
  );
}
