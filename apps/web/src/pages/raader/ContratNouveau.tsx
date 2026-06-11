import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { GeneratedDocument } from "@holbert/core";
import { REFERENTIELS_REGISTRY } from "@holbert/core";
import { useToast } from "@holbert/ui";
import { apiPost } from "../../lib/api";
import { useOrg } from "../../context/OrgContext";

const VARIANTES = [
  { id: "protectrice_a", label: (a: string) => `Protectrice côté ${a}`, desc: "Maximise vos protections — point de départ de négociation" },
  { id: "equilibree", label: () => "Équilibrée", desc: "Standard de marché, acceptable par les deux camps" },
  { id: "protectrice_b", label: (b: string) => `Protectrice côté ${b}`, desc: "Pour anticiper ce que l'autre camp demandera" },
] as const;

export default function ContratNouveau() {
  const { currentOrg } = useOrg();
  const toast = useToast();
  const navigate = useNavigate();
  const types = useMemo(() => REFERENTIELS_REGISTRY.filter((r) => r.id !== "generique"), []);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [variante, setVariante] = useState<string>("equilibree");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [generation, setGeneration] = useState(false);

  const type = types.find((t) => t.id === typeId) ?? null;
  const questions = type && role ? (type.questions[role] ?? []) : [];

  const generer = async () => {
    if (!currentOrg || !type) return;
    setGeneration(true);
    try {
      const r = await apiPost<{ document: GeneratedDocument }>("/api/contrats/generer", {
        org_id: currentOrg.id,
        type: type.id,
        role,
        variante,
        reponses,
      });
      toast.success("Contrat généré");
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
        Créer un contrat
      </h1>
      <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">
        Répondez uniquement aux questions pertinentes pour ce type de contrat —
        chaque choix est expliqué.
      </p>

      {/* Étape 1 — type */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">1. Type de contrat</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTypeId(t.id);
                setRole(t.roles[0] ?? null);
                setReponses({});
              }}
              className={`rounded-xl border p-4 text-left transition ${
                typeId === t.id
                  ? "border-brand-500 bg-brand-25 shadow-focus-ring dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900"
              }`}
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.nom}</p>
              <p className="mt-0.5 text-xs text-gray-400">{t.famille}</p>
            </button>
          ))}
        </div>
      </section>

      {type && (
        <>
          {/* Étape 2 — camp et variante */}
          {type.roles.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">2. Votre camp</h2>
              <div className="flex gap-3">
                {type.roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-medium capitalize transition ${
                      role === r
                        ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                        : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">3. Variante</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {VARIANTES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariante(v.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    variante === v.id
                      ? "border-brand-500 bg-brand-25 dark:bg-brand-500/10"
                      : "border-gray-200 bg-white hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900"
                  }`}
                >
                  <p className="text-sm font-semibold capitalize text-gray-900 dark:text-white">
                    {v.label(
                      v.id === "protectrice_a"
                        ? (type.roles[0] ?? "A")
                        : (type.roles[1] ?? "B")
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{v.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Étape 4 — questionnaire */}
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase text-gray-400">
              4. Les informations du contrat
            </h2>
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              {type.faits_requis.map((f) => (
                <div key={f.id}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {f.libelle}
                  </label>
                  <textarea
                    rows={2}
                    value={reponses[f.id] ?? ""}
                    onChange={(e) => setReponses((p) => ({ ...p, [f.id]: e.target.value }))}
                    placeholder="Laissez vide si inconnu — le contrat contiendra [À COMPLÉTER]"
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              ))}
              {questions.map((q) => (
                <div key={q.id}>
                  <label className="mb-0.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {q.question}
                  </label>
                  <p className="mb-1.5 text-xs text-gray-400">Pourquoi : {q.pourquoi}</p>
                  <textarea
                    rows={2}
                    value={reponses[q.id] ?? ""}
                    onChange={(e) => setReponses((p) => ({ ...p, [q.id]: e.target.value }))}
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
            {generation ? "Rédaction en cours… (jusqu'à une minute)" : "Générer le contrat"}
          </button>
        </>
      )}
    </div>
  );
}
