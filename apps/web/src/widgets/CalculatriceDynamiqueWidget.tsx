import { useMemo, useState } from "react";
import type { CalculatriceDynamiqueSpec } from "@holbert/core";
import { evaluerFormule } from "@holbert/core";

function formater(valeur: number, format?: string): string {
  if (format === "euros") {
    return valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  }
  if (format === "pourcent") return `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
  return valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/** Calculateur ad hoc généré par l'IA — formules évaluées par le moteur sûr de core. */
export default function CalculatriceDynamiqueWidget({ spec }: { spec: CalculatriceDynamiqueSpec }) {
  const [valeurs, setValeurs] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      spec.champs.map((c) => [c.id, c.defaut ?? c.options?.[0]?.valeur ?? c.min ?? 0])
    )
  );

  const resultats = useMemo(
    () =>
      spec.resultats.map((r) => {
        try {
          return { ...r, valeur: formater(evaluerFormule(r.formule, valeurs), r.format), erreur: null };
        } catch (e) {
          return { ...r, valeur: null, erreur: (e as Error).message };
        }
      }),
    [spec.resultats, valeurs]
  );

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{spec.titre}</h3>
        <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-medium uppercase text-warning-700">
          Généré par l'IA — vérifiez les barèmes
        </span>
      </div>
      {spec.description && <p className="mb-3 text-xs text-gray-500">{spec.description}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          {spec.champs.map((c) => (
            <div key={c.id}>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {c.label}
                </label>
                {c.type !== "choix" && (
                  <span className="text-sm font-semibold text-brand-600">
                    {valeurs[c.id]?.toLocaleString("fr-FR")} {c.unite ?? ""}
                  </span>
                )}
              </div>
              {c.type === "curseur" && (
                <input
                  type="range"
                  min={c.min ?? 0}
                  max={c.max ?? 100}
                  step={c.step ?? 1}
                  value={valeurs[c.id] ?? 0}
                  onChange={(e) =>
                    setValeurs((v) => ({ ...v, [c.id]: Number(e.target.value) }))
                  }
                  className="w-full accent-brand-500"
                />
              )}
              {c.type === "nombre" && (
                <input
                  type="number"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={valeurs[c.id] ?? 0}
                  onChange={(e) =>
                    setValeurs((v) => ({ ...v, [c.id]: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              )}
              {c.type === "choix" && (
                <select
                  value={valeurs[c.id] ?? 0}
                  onChange={(e) =>
                    setValeurs((v) => ({ ...v, [c.id]: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  {(c.options ?? []).map((o) => (
                    <option key={o.valeur} value={o.valeur}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {resultats.map((r) => (
            <div
              key={r.id}
              className={
                r.accent
                  ? "rounded-xl bg-brand-50 px-4 py-3 dark:bg-brand-500/10"
                  : "px-4"
              }
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">{r.label}</p>
              {r.erreur ? (
                <p className="text-xs text-error-600">Formule invalide : {r.erreur}</p>
              ) : (
                <p
                  className={`font-semibold ${
                    r.accent
                      ? "text-2xl text-brand-700 dark:text-brand-400"
                      : "text-base text-gray-900 dark:text-white"
                  }`}
                >
                  {r.valeur}
                </p>
              )}
            </div>
          ))}

          <div className="text-[11px] text-gray-400">
            <p className="font-medium uppercase">Sources</p>
            <ul className="mt-0.5 space-y-0.5">
              {spec.sources.map((s) => (
                <li key={s.libelle}>
                  {s.libelle} — {s.reference}
                </li>
              ))}
            </ul>
            {spec.date_validite && <p className="mt-1">Établi le {spec.date_validite}</p>}
          </div>

          {(spec.avertissements ?? []).length > 0 && (
            <ul className="space-y-1 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:bg-warning-500/10">
              {spec.avertissements!.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
