import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { GeneratedDocument } from "@holbert/core";
import { COURRIERS } from "@holbert/core";
import { useToast } from "@holbert/ui";
import { apiPost } from "../../lib/api";
import { useOrg } from "../../context/OrgContext";

export default function CourrierNouveau() {
  const { currentOrg } = useOrg();
  const toast = useToast();
  const navigate = useNavigate();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [generation, setGeneration] = useState(false);

  const type = COURRIERS.find((c) => c.id === typeId) ?? null;

  const generer = async () => {
    if (!currentOrg || !type) return;
    setGeneration(true);
    try {
      const r = await apiPost<{ document: GeneratedDocument }>("/api/courriers/generer", {
        org_id: currentOrg.id,
        type: type.id,
        reponses,
      });
      toast.success("Courrier généré");
      navigate(`/contrats/${r.document.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGeneration(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/raader" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Raader
      </Link>
      <h1 className="mt-2 text-title-sm font-semibold text-gray-900 dark:text-white">
        Rédiger un courrier
      </h1>
      <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">
        Des courriers qui citent leurs fondements juridiques — c'est ce qui leur
        donne du poids.
      </p>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">1. Type de courrier</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {COURRIERS.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setTypeId(c.id);
                setReponses({});
              }}
              className={`rounded-xl border p-4 text-left transition ${
                typeId === c.id
                  ? "border-brand-500 bg-brand-25 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900"
              }`}
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.nom}</p>
              <p className="mt-1 text-xs text-gray-400">{c.description}</p>
            </button>
          ))}
        </div>
      </section>

      {type && (
        <>
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">2. Les informations</h2>
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              {type.champs.map((champ) => (
                <div key={champ.id}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {champ.libelle}
                  </label>
                  <textarea
                    rows={champ.multiligne ? 2 : 1}
                    value={reponses[champ.id] ?? ""}
                    onChange={(e) => setReponses((p) => ({ ...p, [champ.id]: e.target.value }))}
                    placeholder={champ.placeholder ?? "Laissez vide si inconnu — le courrier contiendra [À COMPLÉTER]"}
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          </section>

          <button
            onClick={() => void generer()}
            disabled={generation}
            className="h-11 w-full rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {generation ? "Rédaction en cours…" : "Générer le courrier"}
          </button>
        </>
      )}
    </div>
  );
}
