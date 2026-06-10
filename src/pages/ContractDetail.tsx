import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  AlertTriangle,
  XCircle,
  Lightbulb,
  BookOpen,
  PlayCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatBytes, type Contract, type ContractAnalysis } from "../lib/types";

type AnalysisStep = {
  id: string;
  kind:
    | "contextualization"
    | "decomposition"
    | "sub_analysis"
    | "sub_synthesis"
    | "global_synthesis";
  step_index: number;
  output_text: string | null;
  output_json: any;
  citations: any[];
  confidence_level: string | null;
  status: string;
  created_at: string;
};

type ClauseResult = {
  clause_key: string;
  clause_label: string;
  present: boolean;
  extracted_text: string | null;
  summary: string;
  legal_basis: string;
  evaluation: string;
  risk: "green" | "orange" | "red";
  suggestion: string | null;
  sources: { ref: string; url: string | null; excerpt: string }[];
  confidence: "green" | "orange" | "red";
};

type Suggestion = {
  priority: "high" | "medium" | "low";
  clause: string;
  suggestion: string;
  why: string;
};

const STEP_LABELS: Record<AnalysisStep["kind"], string> = {
  contextualization: "Lecture et compréhension du contrat",
  decomposition: "Identification des clauses à analyser",
  sub_analysis: "Analyse de clause",
  sub_synthesis: "Synthèse de clause",
  global_synthesis: "Synthèse globale et recommandations",
};

const RISK_COLORS: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  green: { bg: "bg-success-50", text: "text-success-700", ring: "ring-success-200", label: "Favorable" },
  orange: { bg: "bg-warning-50", text: "text-warning-700", ring: "ring-warning-200", label: "À surveiller" },
  red: { bg: "bg-error-50", text: "text-error-700", ring: "ring-error-200", label: "Attention requise" },
  unknown: { bg: "bg-gray-100", text: "text-gray-700", ring: "ring-gray-200", label: "—" },
};

function RiskBadge({ risk }: { risk: string }) {
  const c = RISK_COLORS[risk] ?? RISK_COLORS.unknown;
  const Icon = risk === "green" ? Shield : risk === "orange" ? AlertTriangle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${c.bg} ${c.text} ${c.ring}`}>
      <Icon className="size-3" />
      {c.label}
    </span>
  );
}

function ConfidenceBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const map: Record<string, { color: string; label: string }> = {
    green: { color: "bg-success-500", label: "Confiance élevée" },
    orange: { color: "bg-warning-500", label: "Sujet débattu" },
    red: { color: "bg-error-500", label: "Zone d'incertitude" },
  };
  const c = map[level] ?? { color: "bg-gray-400", label: level };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
      <span className={`size-2 rounded-full ${c.color}`} />
      {c.label}
    </span>
  );
}

function RiskGauge({ score, level }: { score: number | null; level: string }) {
  const s = Math.max(0, Math.min(100, score ?? 0));
  const c = RISK_COLORS[level] ?? RISK_COLORS.unknown;
  return (
    <div className={`flex flex-col items-center gap-2 rounded-2xl border p-5 ${c.bg} ring-1 ring-inset ${c.ring}`}>
      <div className="relative size-32">
        <svg viewBox="0 0 100 100" className="size-32 -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-white/60 dark:stroke-gray-800" />
          <circle
            cx="50" cy="50" r="42" fill="none" strokeWidth="10"
            strokeDasharray={`${(s / 100) * 264} 264`}
            strokeLinecap="round"
            className={level === "green" ? "stroke-success-500" : level === "orange" ? "stroke-warning-500" : "stroke-error-500"}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-3xl font-bold ${c.text}`}>{score ?? "—"}</div>
          <div className="text-xs text-gray-500">/ 100</div>
        </div>
      </div>
      <RiskBadge risk={level} />
    </div>
  );
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const autoStart = searchParams.get("autostart") === "1";
  const [contract, setContract] = useState<Contract | null>(null);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggeredRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    const { data: c } = await supabase.from("contracts").select("*").eq("id", id).single();
    setContract(c as Contract | null);

    const { data: a } = await supabase
      .from("contract_analyses")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAnalysis(a as ContractAnalysis | null);

    if (a?.id) {
      const { data: s } = await supabase
        .from("analysis_steps")
        .select("*")
        .eq("analysis_id", a.id)
        .order("step_index", { ascending: true });
      setSteps((s ?? []) as AnalysisStep[]);
    }
  }, [id]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const startAnalysis = useCallback(async () => {
    if (!id || starting) return;
    setStarting(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expirée");
      const res = await fetch("/api/ia/analyze-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contractId: id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setStarting(false);
    }
  }, [id, refresh, starting]);

  // Auto-start from upload redirect
  useEffect(() => {
    if (!loading && autoStart && !analysis && !triggeredRef.current && contract) {
      triggeredRef.current = true;
      startAnalysis();
    }
  }, [loading, autoStart, analysis, contract, startAnalysis]);

  // Poll while running
  useEffect(() => {
    if (analysis?.status === "running" || analysis?.status === "pending") {
      const t = setInterval(refresh, 2500);
      return () => clearInterval(t);
    }
  }, [analysis?.status, refresh]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement…</div>;
  }

  if (!contract) {
    return (
      <div className="space-y-4">
        <Link to="/contrats" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="size-4" /> Retour
        </Link>
        <div className="rounded-lg bg-error-50 p-4 text-sm text-error-700">Contrat introuvable</div>
      </div>
    );
  }

  const running = analysis?.status === "running" || analysis?.status === "pending";
  const done = analysis?.status === "done";
  const errored = analysis?.status === "error";
  const clauses = (analysis?.extracted_clauses as unknown as ClauseResult[]) ?? [];
  const suggestions = (analysis?.improvement_suggestions as unknown as Suggestion[]) ?? [];

  return (
    <div className="space-y-6">
      <Link to="/contrats" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Tous les contrats
      </Link>

      {/* Contract header */}
      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <FileText className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">{contract.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {contract.contract_type && <span className="capitalize">{contract.contract_type}</span>}
            {contract.counterparty && ` • ${contract.counterparty}`}
            {contract.original_filename && ` • ${contract.original_filename}`}
            {contract.file_size_bytes != null && ` • ${formatBytes(contract.file_size_bytes)}`}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-error-50 px-3 py-2.5 text-sm text-error-700">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* No analysis yet */}
      {!analysis && !running && (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-6 dark:border-brand-800/50 dark:bg-brand-500/5 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
            <Sparkles className="size-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Lancer l'analyse IA</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Notre pipeline juridique va contextualiser le contrat, extraire chaque clause, vérifier les sources et produire un rapport structuré.
            </p>
          </div>
          <button
            onClick={startAnalysis}
            disabled={starting}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {starting ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
            {starting ? "Démarrage…" : "Analyser maintenant"}
          </button>
        </div>
      )}

      {/* Running : pipeline progress */}
      {running && (
        <div className="rounded-2xl border border-brand-200 bg-white p-6 dark:border-brand-900 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Loader2 className="size-5 animate-spin text-brand-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Analyse en cours… {steps.length > 0 && <span className="text-gray-500 font-normal">({steps.length} étape{steps.length > 1 ? "s" : ""} terminée{steps.length > 1 ? "s" : ""})</span>}
            </h2>
          </div>
          <ol className="space-y-3">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start gap-3">
                <CheckCircle2 className="size-5 shrink-0 text-success-500 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {STEP_LABELS[s.kind]}
                    {s.kind === "sub_analysis" && s.output_json?.clause_label && (
                      <span className="text-gray-500"> — {s.output_json.clause_label}</span>
                    )}
                  </div>
                  {s.kind === "contextualization" && s.output_text && (
                    <div className="mt-1 text-xs text-gray-500 line-clamp-2">{s.output_text}</div>
                  )}
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3">
              <Loader2 className="size-5 shrink-0 animate-spin text-brand-500 mt-0.5" />
              <div className="text-sm text-gray-700 dark:text-gray-300">Étape suivante…</div>
            </li>
          </ol>
        </div>
      )}

      {/* Error */}
      {errored && (
        <div className="rounded-2xl border border-error-200 bg-error-50 p-5 dark:border-error-800 dark:bg-error-500/10">
          <div className="flex items-start gap-3">
            <XCircle className="size-5 shrink-0 text-error-500 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-error-800 dark:text-error-200">L'analyse a échoué</h2>
              <p className="mt-1 text-sm text-error-700">{analysis.error_message ?? "Une erreur inattendue est survenue."}</p>
            </div>
            <button
              onClick={startAnalysis}
              disabled={starting}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-error-600 px-4 text-sm font-medium text-white hover:bg-error-700 disabled:opacity-50"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Done : full report */}
      {done && analysis && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RiskGauge score={analysis.global_risk_score} level={analysis.global_risk ?? "unknown"} />
            <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-brand-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Résumé exécutif</h2>
                <ConfidenceBadge level={analysis.confidence_level} />
              </div>
              <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">
                {analysis.executive_summary ?? "—"}
              </div>
            </div>
          </div>

          {/* Suggestions prioritaires */}
          {suggestions.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="size-4 text-warning-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recommandations</h2>
              </div>
              <ul className="space-y-3">
                {suggestions.map((s, i) => (
                  <li key={i} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        s.priority === "high" ? "bg-error-100 text-error-700"
                        : s.priority === "medium" ? "bg-warning-100 text-warning-700"
                        : "bg-gray-100 text-gray-700"
                      }`}>
                        {s.priority === "high" ? "Priorité haute" : s.priority === "medium" ? "Priorité moyenne" : "Priorité basse"}
                      </span>
                      <span className="text-xs font-medium text-gray-500">{s.clause}</span>
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{s.suggestion}</div>
                    <div className="mt-1 text-xs text-gray-500">{s.why}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Clauses extraites */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-brand-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Clauses analysées ({clauses.length})
              </h2>
            </div>
            {clauses.map((c, i) => (
              <details key={i} className="group rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{c.clause_label}</span>
                    {!c.present && (
                      <span className="rounded px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600">Absente</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ConfidenceBadge level={c.confidence} />
                    <RiskBadge risk={c.risk} />
                  </div>
                </summary>
                <div className="mt-4 space-y-3 text-sm">
                  {c.extracted_text && (
                    <blockquote className="border-l-2 border-brand-300 pl-3 italic text-gray-600 dark:text-gray-300">
                      {c.extracted_text}
                    </blockquote>
                  )}
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-400">Résumé</div>
                    <p className="mt-1 text-gray-700 dark:text-gray-200">{c.summary}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-400">Rappel juridique</div>
                    <p className="mt-1 text-gray-700 dark:text-gray-200">{c.legal_basis}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-400">Évaluation</div>
                    <p className="mt-1 text-gray-700 dark:text-gray-200">{c.evaluation}</p>
                  </div>
                  {c.suggestion && (
                    <div className="rounded-lg bg-warning-50 p-3 text-warning-800 dark:bg-warning-500/10 dark:text-warning-200">
                      <div className="text-xs font-semibold uppercase">Suggestion</div>
                      <p className="mt-1 text-sm">{c.suggestion}</p>
                    </div>
                  )}
                  {Array.isArray(c.sources) && c.sources.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-gray-400">Sources</div>
                      <ul className="mt-1 space-y-1">
                        {c.sources.map((src, j) => (
                          <li key={j} className="text-xs text-gray-600 dark:text-gray-300">
                            <span className="font-medium">{src.ref}</span>
                            {src.excerpt && <> — <span className="italic">{src.excerpt}</span></>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
