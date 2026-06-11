import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { ChatMessage, Conversation, Widget } from "@holbert/core";
import { useToast } from "@holbert/ui";
import CalculatriceWidget from "../widgets/CalculatriceWidget";
import RechercheWidget from "../widgets/RechercheWidget";
import AuditContexteWidget from "../widgets/AuditContexteWidget";
import ContratAssistantWidget from "../widgets/ContratAssistantWidget";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";
import { useOrg } from "../context/OrgContext";
import RenduTexte from "../components/RenduTexte";

export default function Assistant() {
  const { currentOrg } = useOrg();
  const toast = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [modeApprofondi, setModeApprofondi] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setConversations((data as Conversation[]) ?? []);
  }, [currentOrg]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!convId) {
      setMessages([]);
      return;
    }
    void supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at")
      .then(({ data }) => setMessages((data as ChatMessage[]) ?? []));
  }, [convId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, envoi]);

  const envoyer = async () => {
    const texte = saisie.trim();
    if (!texte || !currentOrg || envoi) return;
    setSaisie("");
    setEnvoi(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        conversation_id: convId ?? "",
        org_id: currentOrg.id,
        role: "user",
        contenu: texte,
        intent: null,
        sources: null,
        widget: null,
        sources_loi: null,
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const r = await apiPost<{ conversation_id: string; message: ChatMessage }>(
        "/api/chat/message",
        {
          org_id: currentOrg.id,
          conversation_id: convId,
          message: texte,
          mode: modeApprofondi ? "approfondie" : undefined,
        }
      );
      setModeApprofondi(false);
      if (!convId) {
        setConvId(r.conversation_id);
        await loadConversations();
      }
      setMessages((prev) => [...prev, r.message]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4">
      {/* Conversations */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:flex">
        <div className="border-b border-gray-200 p-3 dark:border-gray-800">
          <button
            onClick={() => setConvId(null)}
            className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + Nouvelle conversation
          </button>
        </div>
        <ul className="custom-scrollbar flex-1 overflow-y-auto p-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setConvId(c.id)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                  c.id === convId
                    ? "bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                {c.titre}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Conversation active */}
      <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && !envoi && (
            <div className="mx-auto mt-12 max-w-md text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Posez votre question juridique
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Je cherche d'abord dans les documents de votre organisation,
                puis je réponds en citant mes sources.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  "Quelle est la durée de mon bail commercial ?",
                  "Quelles échéances arrivent dans les 6 prochains mois ?",
                  "Que disent mes CGV sur les délais de paiement ?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSaisie(s)}
                    className="block w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-white/5"
                }`}
              >
                {m.role === "user" ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.contenu}</p>
                ) : (
                  <>
                    <RenduTexte texte={m.contenu} />
                    {m.widget &&
                      (m.widget as unknown as Widget).type === "calculatrice" &&
                      (() => {
                        const w = m.widget as unknown as Extract<Widget, { type: "calculatrice" }>;
                        return (
                          <div className="mt-3">
                            <CalculatriceWidget competence={w.competence} params={w.params} />
                          </div>
                        );
                      })()}
                    {m.widget &&
                      ["recherche_validation", "recherche_resultat"].includes(
                        (m.widget as unknown as Widget).type
                      ) && (
                        <RechercheWidget
                          rechercheId={(m.widget as unknown as { recherche_id: string }).recherche_id}
                        />
                      )}
                    {m.widget && (m.widget as unknown as Widget).type === "audit_contexte" && (
                      <AuditContexteWidget
                        prefill={(m.widget as unknown as Extract<Widget, { type: "audit_contexte" }>).prefill}
                      />
                    )}
                    {m.widget && (m.widget as unknown as Widget).type === "contrat_assistant" && (
                      <ContratAssistantWidget
                        prefill={(m.widget as unknown as Extract<Widget, { type: "contrat_assistant" }>).prefill}
                      />
                    )}
                    {m.sources_loi && m.sources_loi.length > 0 && (
                      <div className="mt-3 space-y-1.5 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700">
                        <p className="text-xs font-medium uppercase text-gray-400">
                          Textes officiels (vérifiés sur Légifrance)
                        </p>
                        {m.sources_loi.map((s) => (
                          <div key={s.citation} className="flex items-center gap-2 text-xs">
                            <span
                              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                                !s.trouve
                                  ? "bg-error-500"
                                  : s.etat === "VIGUEUR"
                                    ? "bg-success-500"
                                    : "bg-warning-500"
                              }`}
                              title={
                                !s.trouve
                                  ? "Article introuvable dans ce code — référence à vérifier"
                                  : s.etat === "VIGUEUR"
                                    ? "Article en vigueur"
                                    : "Article trouvé — vérifiez la version en vigueur"
                              }
                            >
                              {!s.trouve ? "✕" : "✓"}
                            </span>
                            {s.url ? (
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-700"
                              >
                                {s.citation}
                              </a>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-300">{s.citation}</span>
                            )}
                            {!s.trouve && (
                              <span className="text-error-600">référence à vérifier</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-brand-600">
                          {m.sources.length} source(s) dans vos documents
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {m.sources.map((s) => (
                            <li
                              key={s.n}
                              className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700"
                            >
                              <Link
                                to={`/documents/${s.document_id}`}
                                className="font-medium text-brand-600 hover:text-brand-700"
                              >
                                [{s.n}] {s.nom_fichier}
                              </Link>
                              <p className="mt-1 text-gray-500 dark:text-gray-400">
                                « {s.extrait.slice(0, 200)}… »
                              </p>
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

          {envoi && (
            <div className="flex">
              <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5">
                <span className="text-sm text-gray-400">Recherche et rédaction…</span>
              </div>
            </div>
          )}
          <div ref={finRef} />
        </div>

        <div className="border-t border-gray-200 p-3 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => setModeApprofondi((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                modeApprofondi
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                  : "border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400"
              }`}
              title="Segmentation du cas en questions validables, puis recherche exhaustive (textes, jurisprudence, vos documents) et document de synthèse"
            >
              <span
                className={`h-2 w-2 rounded-full ${modeApprofondi ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}
              />
              Recherche approfondie
            </button>
            {modeApprofondi && (
              <span className="text-xs text-gray-400">
                Je segmenterai votre cas en questions que vous validerez avant la recherche.
              </span>
            )}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void envoyer();
                }
              }}
              rows={2}
              placeholder="Posez votre question juridique… (Entrée pour envoyer)"
              className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <button
              onClick={() => void envoyer()}
              disabled={envoi || !saisie.trim()}
              className="h-11 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              Envoyer
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            Information juridique générale — pas un conseil individualisé.
          </p>
        </div>
      </section>
    </div>
  );
}
