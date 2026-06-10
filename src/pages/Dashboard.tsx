import { Link } from "react-router";
import {
  Sparkles,
  FolderOpen,
  MessageSquare,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { useOrganization } from "../context/OrganizationContext";

const stats = [
  { label: "Contrats actifs", value: "0" },
  { label: "Expirent < 30j", value: "0" },
  { label: "À risque", value: "0" },
  { label: "Valeur engagée", value: "—" },
];

const modules = [
  {
    to: "/contrats",
    icon: FolderOpen,
    title: "Registre des contrats",
    desc: "Centralisez et suivez les échéances de tous vos contrats",
  },
  {
    to: "/dossiers",
    icon: MessageSquare,
    title: "Dossiers de cas",
    desc: "Analysez un cas juridique avec votre assistant IA",
  },
  {
    to: "/modeles",
    icon: BookOpen,
    title: "Générer un document",
    desc: "30 modèles juridiques personnalisables en quelques clics",
  },
];

export default function Dashboard() {
  const { currentOrg } = useOrganization();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          Bonjour
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {currentOrg ? `Espace ${currentOrg.name}` : "Bienvenue dans Holbert"}
        </p>
      </div>

      <Link
        to="/analyse-contrat"
        className="group flex flex-col items-start gap-4 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white p-6 transition hover:border-brand-400 hover:shadow-theme-md dark:border-brand-900 dark:from-brand-500/10 dark:via-gray-900 dark:to-gray-900 sm:flex-row sm:items-center"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
          <Sparkles className="size-7" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Analyser un contrat
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Déposez votre contrat, obtenez un rapport structuré en moins de 60 secondes
            (résumé, clauses extraites, score de risque, suggestions).
          </p>
        </div>
        <ChevronRight className="size-5 text-brand-500 transition group-hover:translate-x-1" />
      </Link>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Vos modules
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {modules.map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15">
                <Icon className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
