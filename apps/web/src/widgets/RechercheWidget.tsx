import { useCallback, useEffect, useRef, useState } from "react";
import type { Recherche, RechercheQuestion } from "@holbert/core";
import { useToast } from "@holbert/ui";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";
import { telechargerDocx } from "../lib/docx";
import RenduTexte from "../components/RenduTexte";

/**
 * Widget unique du cycle de recherche approfondie :
 *  - attente_validation → encarts éditables + bouton de lancement ;
 *  - en_cours → barre de progression (on peut quitter, ça continue) ;
 *  - terminee → document de synthèse + sources + démarche + export DOCX.
 */
export default function RechercheWidget({ rechercheId }: { rechercheId: string }) {
  const toast = useToast();
  const [recherche, setRecherche] = useState<Recherche | null>(null);
  const [questions, setQuestions] = useState<RechercheQuestion[]>([]);
  const [editees, setEditees] = useState(false);
  const [lancement, setLancement] = useState(false);
  const compteurPoll = useRef(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("recherches")
      .select("*")
      .eq("id", rechercheId)
      .maybeSingle();
    if (data) {
      setRecherche(data as Recherche);
      setQuestions((prev) =>
        editees && prev.length ? prev : (data as Recherche).questions
      );
    }
  }, [rechercheId, editees]);

  useEffect(() => {
    void load();
  }, [load]);

  // Suivi pendant la recherche : polling + relance de la chaîne en filet
  useEffect(() => {
    if (recherche?.statut !== "en_cours") return;
    const interval = setInterval(() => {
      void load();
      compteurPoll.current += 1;
      if (compteurPoll.current % 4 === 0) {
        // Filet de sécurité : si la chaîne serveur s'est interrompue, on la relance
        void apiPost("/api/recherche/etape", { recherche_id: rechercheId }).catch(() => undefined);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [recherche?.statut, load, rechercheId]);

  if (!recherche) {
    return <p className="text-xs text-gray-400">Chargement de la recherche…</p>;
  }

  // ---- 1. Validation des questions segmentées ------------------------------
  if (recherche.statut === "attente_validation") {
    const maj = (i: number, valeur: string) => {
      setEditees(true);
      setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, question: valeur } : q)));
    };

    const lancer = async () => {
      setLancement(true);
      try {
        await apiPost("/api/recherche/valider", {
          recherche_id: rechercheId,
          questions: questions.map((q) => ({
            id: q.id,
            question: q.question,
            justification: q.justification,
          })),
        });
        toast.success("Recherche lancée — vous pouvez quitter la page, je continue");
        await load();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLancement(false);
      }
    };

    return (
      <div className="mt-3 space-y-3 rounded-xl border border-brand-200 bg-white p-4 dark:border-brand-500/30 dark:bg-gray-900">
        <p className="text-xs font-semibold uppercase text-brand-600">
          Questions à valider — corrigez directement dans les encarts
        </p>
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-start gap-2">
              <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                {i + 1}
              </span>
              <textarea
                value={q.question}
                onChange={(e) => maj(i, e.target.value)}
                rows={2}
                className="w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-gray-800 outline-none hover:border-gray-200 focus:border-brand-400 dark:text-gray-100 dark:hover:border-gray-700"
              />
              <button
                onClick={() => {
                  setEditees(true);
                  setQuestions((qs) => qs.filter((_, j) => j !== i));
                }}
                className="mt-1 text-xs text-gray-300 hover:text-error-500"
                title="Retirer cette question"
              >
                ✕
              </button>
            </div>
            {q.justification && (
              <p className="ml-7 mt-1 text-xs text-gray-400">Pourquoi : {q.justification}</p>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setEditees(true);
              setQuestions((qs) => [
                ...qs,
                { id: `q${qs.length + 1}-m`, question: "", statut: "a_faire" },
              ]);
            }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            + Ajouter une question
          </button>
          <button
            onClick={() => void lancer()}
            disabled={lancement || questions.every((q) => q.question.trim().length < 6)}
            className="ml-auto rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {lancement ? "Lancement…" : "Valider et lancer la recherche"}
          </button>
        </div>
      </div>
    );
  }

  // ---- 2. En cours : progression --------------------------------------------
  if (recherche.statut === "en_cours") {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            Recherche approfondie en cours…
          </span>
          <span className="font-semibold text-brand-600">{recherche.progression}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-2 rounded-full bg-brand-500 transition-all duration-700"
            style={{ width: `${recherche.progression}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {recherche.etape_courante ?? "préparation"} · Vous pouvez quitter cette
          page : la recherche continue et le résultat vous attendra ici (et en
          notification).
        </p>
      </div>
    );
  }

  // ---- 3. Erreur -------------------------------------------------------------
  if (recherche.statut === "erreur") {
    return (
      <div className="mt-3 rounded-xl bg-error-50 p-4 text-sm text-error-700">
        La recherche a échoué : {recherche.erreur ?? "erreur inconnue"}.
        <button
          onClick={() => void apiPost("/api/recherche/etape", { recherche_id: rechercheId }).then(load)}
          className="ml-2 font-medium underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // ---- 4. Terminée : document de synthèse ------------------------------------
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Document de synthèse
        </p>
        <button
          onClick={() =>
            void telechargerDocx(
              `Synthèse — ${recherche.question_initiale.slice(0, 60)}`,
              recherche.document ?? ""
            )
          }
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
        >
          Télécharger en DOCX
        </button>
      </div>
      <div className="custom-scrollbar max-h-[70vh] overflow-y-auto px-4 py-4">
        <RenduTexte texte={recherche.document ?? ""} />
      </div>
      {recherche.demarche?.length > 0 && (
        <details className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <summary className="cursor-pointer text-xs font-medium text-brand-600">
            Démarche suivie ({recherche.demarche.length} étape(s))
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
            {recherche.demarche.map((d, i) => (
              <li key={i}>
                <span className="font-medium">{d.etape}</span> — {d.detail}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
