import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router";
import { MessageSquare, Search, PlusCircle, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useOrganization } from "../context/OrganizationContext";
import {
  LEGAL_DOMAINS,
  type LegalCase,
  type CaseStatus,
  type LegalDomain,
} from "../lib/types";

const STATUS_LABEL: Record<CaseStatus, string> = {
  open: "En cours",
  pending: "En attente",
  resolved: "Traité",
  escalated: "Transmis avocat",
  archived: "Archivé",
};

const STATUS_COLOR: Record<CaseStatus, string> = {
  open: "bg-brand-100 text-brand-700",
  pending: "bg-warning-100 text-warning-700",
  resolved: "bg-success-100 text-success-700",
  escalated: "bg-blue-light-100 text-blue-light-700",
  archived: "bg-gray-100 text-gray-600",
};

function domainLabel(d: LegalDomain): string {
  return LEGAL_DOMAINS.find((x) => x.value === d)?.label ?? d;
}

function formatRelative(d: string): string {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CasesList() {
  const { currentOrg } = useOrganization();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("cases")
        .select("*")
        .eq("org_id", currentOrg.id)
        .order("updated_at", { ascending: false });
      setCases((data as LegalCase[]) ?? []);
      setLoading(false);
    })();
  }, [currentOrg]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !c.title.toLowerCase().includes(q) &&
          !c.initial_question?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [cases, query, statusFilter]);

  const openCount = cases.filter((c) => c.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            Dossiers de cas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vos analyses juridiques approfondies — chaque dossier est isolé et persistant.
          </p>
        </div>
        <Link
          to="/dossiers/nouveau"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <PlusCircle className="size-4" />
          <span className="hidden sm:inline">Nouveau dossier</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un dossier…"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "all")}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="all">Tous statuts {cases.length > 0 && `(${cases.length})`}</option>
          {(Object.keys(STATUS_LABEL) as CaseStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
              {s === "open" && openCount > 0 && ` (${openCount})`}
            </option>
          ))}
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <MessageSquare className="size-7" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {cases.length === 0 ? "Pas encore de dossier" : "Aucun résultat"}
          </h3>
          <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {cases.length === 0
              ? "Ouvrez un dossier pour faire analyser un cas juridique par votre assistant IA, joindre vos pièces et générer un mémo."
              : "Ajustez votre recherche ou vos filtres."}
          </p>
          {cases.length === 0 && (
            <Link
              to="/dossiers/nouveau"
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              <Sparkles className="size-4" />
              Ouvrir mon premier dossier
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                to={`/dossiers/${c.id}`}
                className="group block rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white">
                        {c.title}
                      </h3>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {domainLabel(c.domain)} • Mis à jour {formatRelative(c.updated_at)}
                    </p>
                    {c.initial_question && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                        {c.initial_question}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
