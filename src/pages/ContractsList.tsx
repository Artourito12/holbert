import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router";
import {
  Sparkles,
  Search,
  FileText,
  Shield,
  AlertTriangle,
  XCircle,
  Clock,
  PlusCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useOrganization } from "../context/OrganizationContext";
import {
  CONTRACT_TYPES,
  type Contract,
  type ContractRisk,
  type ContractStatus,
} from "../lib/types";

const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  expired: "Échu",
  renewed: "Renouvelé",
  terminated: "Résilié",
  archived: "Archivé",
};

const RISK_CONFIG: Record<ContractRisk, { color: string; bg: string; label: string; Icon: typeof Shield }> = {
  green: { color: "text-success-700", bg: "bg-success-50", label: "Favorable", Icon: Shield },
  orange: { color: "text-warning-700", bg: "bg-warning-50", label: "À surveiller", Icon: AlertTriangle },
  red: { color: "text-error-700", bg: "bg-error-50", label: "Attention", Icon: XCircle },
  unknown: { color: "text-gray-600", bg: "bg-gray-100", label: "—", Icon: Clock },
};

function typeLabel(value: string | null): string {
  if (!value) return "—";
  return CONTRACT_TYPES.find((t) => t.value === value)?.label ?? value;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ContractsList() {
  const { currentOrg } = useOrganization();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");
  const [riskFilter, setRiskFilter] = useState<ContractRisk | "all">("all");

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("contracts")
        .select("*")
        .eq("org_id", currentOrg.id)
        .order("created_at", { ascending: false });
      setContracts((data as Contract[]) ?? []);
      setLoading(false);
    })();
  }, [currentOrg]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (riskFilter !== "all" && c.risk_level !== riskFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const inTitle = c.title.toLowerCase().includes(q);
        const inCounterparty = c.counterparty?.toLowerCase().includes(q);
        const inFilename = c.original_filename?.toLowerCase().includes(q);
        if (!inTitle && !inCounterparty && !inFilename) return false;
      }
      return true;
    });
  }, [contracts, query, statusFilter, riskFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const active = contracts.filter((c) => c.status === "active").length;
    const expiringSoon = contracts.filter((c) => {
      if (!c.effective_to) return false;
      const end = new Date(c.effective_to);
      return c.status === "active" && end <= in30 && end >= now;
    }).length;
    const atRisk = contracts.filter((c) => c.risk_level === "red" || c.risk_level === "orange").length;
    const totalValue = contracts
      .filter((c) => c.status === "active" && c.amount_cents)
      .reduce((acc, c) => acc + (c.amount_cents ?? 0), 0);
    return { active, expiringSoon, atRisk, totalValue: totalValue / 100 };
  }, [contracts]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            Contrats
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tous vos contrats centralisés, avec leur statut et leur niveau de risque.
          </p>
        </div>
        <Link
          to="/analyse-contrat"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <PlusCircle className="size-4" />
          <span className="hidden sm:inline">Analyser un contrat</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Contrats actifs</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Expirent &lt; 30j</p>
          <p className="mt-2 text-2xl font-semibold text-warning-600">{stats.expiringSoon}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">À risque</p>
          <p className="mt-2 text-2xl font-semibold text-error-600">{stats.atRisk}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Valeur engagée</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {stats.totalValue > 0
              ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(stats.totalValue)
              : "—"}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un contrat, une contrepartie…"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContractStatus | "all")}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="all">Tous statuts</option>
          {(Object.keys(STATUS_LABEL) as ContractStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as ContractRisk | "all")}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="all">Tous risques</option>
          <option value="green">Favorable</option>
          <option value="orange">À surveiller</option>
          <option value="red">Attention</option>
          <option value="unknown">Non analysé</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <FileText className="size-7" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {contracts.length === 0 ? "Pas encore de contrat" : "Aucun résultat"}
          </h3>
          <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {contracts.length === 0
              ? "Déposez votre premier contrat pour le faire analyser par l'IA."
              : "Ajustez vos filtres pour retrouver vos contrats."}
          </p>
          {contracts.length === 0 && (
            <Link
              to="/analyse-contrat"
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              <Sparkles className="size-4" />
              Analyser un contrat
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Contrat</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Risque</th>
                  <th className="px-4 py-3 text-left">Ajouté</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((c) => {
                  const r = RISK_CONFIG[c.risk_level];
                  return (
                    <tr key={c.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <Link to={`/contrats/${c.id}`} className="block">
                          <div className="text-sm font-medium text-gray-900 group-hover:text-brand-600 dark:text-white">
                            {c.title}
                          </div>
                          {c.counterparty && (
                            <div className="mt-0.5 text-xs text-gray-500">{c.counterparty}</div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {typeLabel(c.contract_type)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${r.bg} ${r.color}`}>
                          <r.Icon className="size-3" />
                          {r.label}
                          {c.risk_score != null && c.risk_level !== "unknown" && (
                            <span className="ml-1 opacity-70">{c.risk_score}/100</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-gray-100 md:hidden dark:divide-gray-800">
            {filtered.map((c) => {
              const r = RISK_CONFIG[c.risk_level];
              return (
                <li key={c.id}>
                  <Link to={`/contrats/${c.id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {c.title}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {typeLabel(c.contract_type)}
                          {c.counterparty && ` • ${c.counterparty}`}
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.bg} ${r.color}`}>
                        <r.Icon className="size-3" />
                        {r.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{STATUS_LABEL[c.status]}</span>
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
