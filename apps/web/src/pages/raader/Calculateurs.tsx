import { Link, useParams } from "react-router";
import type { CompetenceCalcul } from "@holbert/core";
import { COMPETENCES_CALCUL } from "@holbert/core";
import CalculatriceWidget from "../../widgets/CalculatriceWidget";

export function CalculateursListe() {
  return (
    <div>
      <Link to="/raader" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Raader
      </Link>
      <h1 className="mt-2 text-title-sm font-semibold text-gray-900 dark:text-white">
        Calculateurs
      </h1>
      <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">
        Chaque résultat est accompagné du détail du calcul et de ses sources.
        Vous pouvez aussi simplement poser votre question à l'Assistant.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(COMPETENCES_CALCUL) as CompetenceCalcul[]).map((id) => (
          <Link
            key={id}
            to={`/calculateurs/${id}`}
            className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white">
              {COMPETENCES_CALCUL[id].nom} →
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {COMPETENCES_CALCUL[id].description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CalculateurPage() {
  const { competence } = useParams<{ competence: string }>();
  const valide = competence && competence in COMPETENCES_CALCUL;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/calculateurs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Calculateurs
      </Link>
      <div className="mt-3">
        {valide ? (
          <CalculatriceWidget competence={competence as CompetenceCalcul} />
        ) : (
          <p className="text-sm text-gray-500">Calculateur introuvable.</p>
        )}
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Simulation à titre d'information — elle ne remplace pas l'analyse d'un
        professionnel sur votre situation précise.
      </p>
    </div>
  );
}
