import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  MessageSquare,
  User as UserIcon,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  Shield,
  AlertTriangle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  LEGAL_DOMAINS,
  ANALYSIS_MODES,
  type LegalCase,
  type CaseMessage,
  type AnalysisMode,
  type LegalDomain,
} from "../lib/types";

type PipelineStep = {
  id: string;
  kind: string;
  step_index: number;
  output_text: string | null;
  output_json: any;
  status: string;
  created_at: string;
};

const STEP_LABELS: Record<string, string> = {
  contextualization: "Lecture du contexte",
  decomposition: "Décomposition de la question",
  sub_analysis: "Analyse approfondie",
  global_synthesis: "Synthèse finale",
  memo_generation: "Rédaction du mémo",
  clarification: "Questions de clarification",
};

function ConfidenceBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const map: Record<string, { color: string; label: string; Icon: typeof Shield }> = {
    green: { color: "text-success-600", label: "Confiance élevée", Icon: Shield },
    orange: { color: "text-warning-600", label: "Sujet débattu", Icon: AlertTriangle },
    red: { color: "text-error-600", label: "Zone d'incertitude", Icon: XCircle },
  };
  const c = map[level];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${c.color}`}>
      <c.Icon className="size-3" /> {c.label}
    </span>
  );
}

function MarkdownLite({ text }: { text: string }) {
  // Light markdown : **bold**, _italic_, lines starting with -
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const isBullet = line.trim().startsWith("- ");
        const content = (isBullet ? line.trim().slice(2) : line).split(/(\*\*[^*]+\*\*|_[^_]+_)/).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith("_") && part.endsWith("_")) {
            return <em key={j} className="text-gray-500">{part.slice(1, -1)}</em>;
          }
          return <span key={j}>{part}</span>;
        });
        return (
          <div key={i} className={isBullet ? "flex gap-2 pl-1" : ""}>
            {isBullet && <span className="text-brand-500 shrink-0">•</span>}
            <span>{content}</span>
          </div>
        );
      })}
    </div>
  );
}

function domainLabel(d: LegalDomain): string {
  return LEGAL_DOMAINS.find((x) => x.value === d)?.label ?? d;
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const autoStart = searchParams.get("autostart") === "1";
  const { user } = useAuth();

  const [theCase, setTheCase] = useState<LegalCase | null>(null);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState("");
  const [mode, setMode] = useState<AnalysisMode>("standard");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const triggeredRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("cases").select("*").eq("id", id).single(),
      supabase.from("case_messages").select("*").eq("case_id", id).order("position", { ascending: true }),
    ]);
    setTheCase(c as LegalCase | null);
    setMessages((m as CaseMessage[]) ?? []);
  }, [id]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Detect pending assistant message (content = "…" placeholder)
  useEffect(() => {
    const pending = messages.find((m) => m.role === "assistant" && m.content === "…");
    setPendingMessageId(pending?.id ?? null);
  }, [messages]);

  // Poll pipeline steps while pending
  useEffect(() => {
    if (!pendingMessageId) {
      setPipelineSteps([]);
      return;
    }
    let cancelled = false;
    const fetchSteps = async () => {
      const { data } = await supabase
        .from("case_message_steps")
        .select("*")
        .eq("message_id", pendingMessageId)
        .order("step_index", { ascending: true });
      if (!cancelled) setPipelineSteps((data as PipelineStep[]) ?? []);
    };
    fetchSteps();
    const stepsInterval = setInterval(fetchSteps, 2000);
    const msgInterval = setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      clearInterval(stepsInterval);
      clearInterval(msgInterval);
    };
  }, [pendingMessageId, refresh]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, pipelineSteps.length]);

  const triggerAnalysis = useCallback(async (currentMode: AnalysisMode = "standard") => {
    if (!id) return;
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Session expirée");
      const res = await fetch("/api/ia/case-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caseId: id, mode: currentMode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }, [id, refresh]);

  // Auto-start from creation (first user message already inserted)
  useEffect(() => {
    if (
      !loading &&
      autoStart &&
      !triggeredRef.current &&
      theCase &&
      messages.length === 1 &&
      messages[0].role === "user"
    ) {
      triggeredRef.current = true;
      triggerAnalysis("standard");
    }
  }, [loading, autoStart, theCase, messages, triggerAnalysis]);

  const sendMessage = async () => {
    if (!composer.trim() || !theCase || !user || sending) return;
    setSending(true);
    setError(null);
    try {
      // Insert user message
      const nextPosition = messages.length;
      const { error: insertErr } = await supabase.from("case_messages").insert({
        case_id: theCase.id,
        org_id: theCase.org_id,
        role: "user",
        content: composer.trim(),
        position: nextPosition,
        created_by: user.id,
      });
      if (insertErr) throw new Error(insertErr.message);
      setComposer("");
      await refresh();
      // Trigger IA
      await triggerAnalysis(mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement…</div>;
  }

  if (!theCase) {
    return (
      <div className="space-y-4">
        <Link to="/dossiers" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="size-4" /> Retour
        </Link>
        <div className="rounded-lg bg-error-50 p-4 text-sm text-error-700">Dossier introuvable</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div>
        <Link to="/dossiers" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
          <ArrowLeft className="size-4" /> Tous les dossiers
        </Link>
        <div className="mt-2 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <MessageSquare className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{theCase.title}</h1>
            <p className="mt-0.5 text-xs text-gray-500">{domainLabel(theCase.domain)}</p>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  m.role === "user"
                    ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                    : "bg-brand-500 text-white"
                }`}
              >
                {m.role === "user" ? <UserIcon className="size-5" /> : <Sparkles className="size-5" />}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                }`}
              >
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                ) : m.content === "…" ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Analyse en cours…</span>
                  </div>
                ) : (
                  <>
                    <MarkdownLite text={m.content} />
                    {m.confidence_level && (
                      <div className="mt-3 border-t border-gray-200 pt-2 dark:border-gray-700">
                        <ConfidenceBadge level={m.confidence_level} />
                      </div>
                    )}
                    {Array.isArray(m.citations) && m.citations.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                          {m.citations.length} source{m.citations.length > 1 ? "s" : ""} citée{m.citations.length > 1 ? "s" : ""}
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {m.citations.map((s: any, j: number) => (
                            <li key={j} className="text-xs text-gray-600 dark:text-gray-300">
                              <span className="font-medium">{s.ref}</span>
                              {s.excerpt && <> — <span className="italic">{s.excerpt}</span></>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Pipeline progress (while pending) */}
          {pendingMessageId && pipelineSteps.length > 0 && (
            <div className="ml-12 max-w-[85%] rounded-2xl border border-brand-200 bg-brand-50/30 p-3 text-xs dark:border-brand-900 dark:bg-brand-500/5">
              <ol className="space-y-1.5">
                {pipelineSteps.map((s) => (
                  <li key={s.id} className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-success-500 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-200">
                      {STEP_LABELS[s.kind] ?? s.kind}
                      {s.kind === "sub_analysis" && s.output_json?.question_label && (
                        <span className="text-gray-500"> — {s.output_json.question_label}</span>
                      )}
                    </span>
                  </li>
                ))}
                <li className="flex items-start gap-2">
                  <Loader2 className="size-4 shrink-0 animate-spin text-brand-500 mt-0.5" />
                  <span className="text-gray-500">Étape suivante…</span>
                </li>
              </ol>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Composer */}
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as AnalysisMode)}
            disabled={!!pendingMessageId || sending}
            className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {ANALYSIS_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                Mode : {m.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400 truncate">
            {ANALYSIS_MODES.find((m) => m.value === mode)?.description}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={!!pendingMessageId || sending}
            placeholder={pendingMessageId ? "Analyse en cours…" : "Posez une question, approfondissez un point…"}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:bg-white disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
          />
          <button
            onClick={sendMessage}
            disabled={!composer.trim() || !!pendingMessageId || sending}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-50"
            aria-label="Envoyer"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        <div className="hidden text-xs text-gray-400 sm:block">
          Ctrl + Entrée pour envoyer
        </div>
      </div>
    </div>
  );
}
