import { useMemo, useState } from "react";
import type { CompetenceCalcul, ResultatCalcul, EvenementPrescription } from "@holbert/core";
import {
  COMPETENCES_CALCUL,
  calculerIndemniteLicenciement,
  calculerPensionArrieres,
  calculerPrescription,
  typesActionsPrescription,
} from "@holbert/core";

const AUJOURDHUI = new Date().toLocaleDateString("fr-CA"); // AAAA-MM-JJ local

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white";

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function Slider({
  label, value, min, max, step = 1, unite, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; unite: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
        <span className="text-sm font-semibold text-brand-600">
          {value.toLocaleString("fr-FR")} {unite}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
    </div>
  );
}

function Resultats({ r }: { r: ResultatCalcul | { erreur: string } }) {
  if ("erreur" in r) {
    return <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{r.erreur}</p>;
  }
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {r.resultat.map((res) => (
          <div
            key={res.libelle}
            className={
              res.accent
                ? "rounded-xl bg-brand-50 px-4 py-3 dark:bg-brand-500/10"
                : "px-4"
            }
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{res.libelle}</p>
            <p
              className={`font-semibold ${
                res.accent ? "text-2xl text-brand-700 dark:text-brand-400" : "text-base text-gray-900 dark:text-white"
              }`}
            >
              {res.valeur}
            </p>
          </div>
        ))}
      </div>

      <details>
        <summary className="cursor-pointer text-xs font-medium text-brand-600">
          Détail du calcul
        </summary>
        <table className="mt-2 w-full text-xs">
          <tbody>
            {r.etapes.map((e, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                <td className="py-1.5 pr-2 font-medium text-gray-700 dark:text-gray-300">{e.libelle}</td>
                <td className="py-1.5 pr-2 text-gray-400">{e.formule}</td>
                <td className="py-1.5 text-right font-medium text-gray-900 dark:text-white">{e.valeur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="text-[11px] text-gray-400">
        <p className="font-medium uppercase">Sources</p>
        <ul className="mt-0.5 space-y-0.5">
          {r.sources.map((s) => (
            <li key={s.libelle}>{s.libelle} — {s.reference}</li>
          ))}
        </ul>
      </div>

      {r.avertissements.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:bg-warning-500/10">
          {r.avertissements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CalcLicenciement({ params }: { params?: Record<string, string | number> }) {
  const [salaire, setSalaire] = useState(Number(params?.salaire_reference) || 2500);
  const [annees, setAnnees] = useState(Number(params?.anciennete_annees) || 5);
  const [mois, setMois] = useState(Number(params?.anciennete_mois) || 0);
  const [date, setDate] = useState(String(params?.date_notification || AUJOURDHUI));

  const r = useMemo(() => {
    try {
      return calculerIndemniteLicenciement({
        salaire_reference: salaire,
        anciennete_annees: annees,
        anciennete_mois: mois,
        date_notification: date,
      });
    } catch (e) {
      return { erreur: (e as Error).message };
    }
  }, [salaire, annees, mois, date]);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-4">
        <Slider label="Salaire mensuel brut de référence" value={salaire} min={1000} max={12000} step={50} unite="€" onChange={setSalaire} />
        <Slider label="Ancienneté (années pleines)" value={annees} min={0} max={45} unite="an(s)" onChange={setAnnees} />
        <Slider label="Mois supplémentaires" value={mois} min={0} max={11} unite="mois" onChange={setMois} />
        <Champ label="Date de notification du licenciement">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Champ>
      </div>
      <Resultats r={r} />
    </div>
  );
}

function CalcPension({ params }: { params?: Record<string, string | number> }) {
  const [pension, setPension] = useState(Number(params?.pension_initiale) || 400);
  const [annee, setAnnee] = useState(Number(params?.annee_fixation) || 2020);
  const [paye, setPaye] = useState(Number(params?.paye_mensuel) || 0);
  const [debut, setDebut] = useState(String(params?.date_debut || "2023-01-01"));
  const [fin, setFin] = useState(String(params?.date_fin || AUJOURDHUI));

  const r = useMemo(() => {
    try {
      return calculerPensionArrieres({
        pension_initiale: pension,
        annee_fixation: annee,
        paye_mensuel: paye,
        date_debut: debut,
        date_fin: fin,
      });
    } catch (e) {
      return { erreur: (e as Error).message };
    }
  }, [pension, annee, paye, debut, fin]);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-4">
        <Slider label="Pension mensuelle fixée" value={pension} min={50} max={3000} step={10} unite="€" onChange={setPension} />
        <Slider label="Année de la décision" value={annee} min={2015} max={2026} unite="" onChange={setAnnee} />
        <Slider label="Montant réellement payé par mois" value={paye} min={0} max={3000} step={10} unite="€" onChange={setPaye} />
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Début des arriérés">
            <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={inputCls} />
          </Champ>
          <Champ label="Fin des arriérés">
            <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={inputCls} />
          </Champ>
        </div>
      </div>
      <Resultats r={r} />
    </div>
  );
}

function CalcPrescription({ params }: { params?: Record<string, string | number> }) {
  const types = useMemo(() => typesActionsPrescription(), []);
  const [type, setType] = useState(String(params?.type_action || "droit_commun"));
  const [depart, setDepart] = useState(String(params?.point_depart || "2021-01-01"));
  const [evenements, setEvenements] = useState<EvenementPrescription[]>([]);

  const r = useMemo(() => {
    try {
      return calculerPrescription({
        type_action: type,
        point_depart: depart,
        evenements,
        date_reference: AUJOURDHUI,
      });
    } catch (e) {
      return { erreur: (e as Error).message };
    }
  }, [type, depart, evenements]);

  const majEvenement = (i: number, patch: Partial<EvenementPrescription>) =>
    setEvenements((evs) => evs.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-4">
        <Champ label="Nature de l'action">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.libelle} ({t.annees} ans)
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Point de départ (connaissance des faits)">
          <input type="date" value={depart} onChange={(e) => setDepart(e.target.value)} className={inputCls} />
        </Champ>

        <div>
          <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            Événements (interruptions / suspensions)
          </p>
          <div className="space-y-2">
            {evenements.map((ev, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={ev.type}
                    onChange={(e) => majEvenement(i, { type: e.target.value as EvenementPrescription["type"] })}
                    className={inputCls}
                  >
                    <option value="interruption">Interruption (assignation, reconnaissance…)</option>
                    <option value="suspension">Suspension (médiation…)</option>
                  </select>
                  <input
                    type="text"
                    value={ev.cause}
                    placeholder="Cause"
                    onChange={(e) => majEvenement(i, { cause: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    type="date"
                    value={ev.date}
                    onChange={(e) => majEvenement(i, { date: e.target.value })}
                    className={inputCls}
                  />
                  {ev.type === "suspension" && (
                    <input
                      type="date"
                      value={ev.date_fin ?? ""}
                      onChange={(e) => majEvenement(i, { date_fin: e.target.value })}
                      className={inputCls}
                    />
                  )}
                </div>
                <button
                  onClick={() => setEvenements((evs) => evs.filter((_, j) => j !== i))}
                  className="mt-1 text-xs text-gray-400 hover:text-error-500"
                >
                  Retirer
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setEvenements((evs) => [
                  ...evs,
                  { type: "interruption", cause: "Reconnaissance de dette", date: AUJOURDHUI },
                ])
              }
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + Ajouter un événement
            </button>
          </div>
        </div>
      </div>
      <Resultats r={r} />
    </div>
  );
}

export default function CalculatriceWidget({
  competence,
  params,
}: {
  competence: CompetenceCalcul;
  params?: Record<string, string | number>;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
        {COMPETENCES_CALCUL[competence].nom}
      </h3>
      {competence === "licenciement" && <CalcLicenciement params={params} />}
      {competence === "pension" && <CalcPension params={params} />}
      {competence === "prescription" && <CalcPrescription params={params} />}
    </div>
  );
}
