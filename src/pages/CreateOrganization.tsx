import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown } from "lucide-react";
import { useOrganization } from "../context/OrganizationContext";

const LEGAL_FORMS = ["SAS", "SARL", "SA", "SASU", "EURL", "EI", "Cabinet individuel", "Association", "Autre"];
const SIZE_RANGES = [
  { value: "1-10", label: "1 à 10 personnes" },
  { value: "10-50", label: "10 à 50 personnes" },
  { value: "50-250", label: "50 à 250 personnes" },
  { value: "250+", label: "Plus de 250 personnes" },
];

export default function CreateOrganization() {
  const navigate = useNavigate();
  const { createOrg } = useOrganization();
  const [name, setName] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [legalForm, setLegalForm] = useState("");
  const [sector, setSector] = useState("");
  const [sizeRange, setSizeRange] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom de votre organisation est requis");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await createOrg({
      name: name.trim(),
      legal_form: legalForm || undefined,
      sector: sector.trim() || undefined,
      size_range: sizeRange || undefined,
    });
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-md dark:border-gray-800 dark:bg-gray-900 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png" alt="Holbert" className="h-10 w-10 object-contain" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Holbert
          </h1>
        </div>

        <h2 className="mb-1 text-xl font-semibold text-gray-900 dark:text-white">
          Bienvenue !
        </h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Créons votre espace de travail. Vous pourrez inviter votre équipe ensuite.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nom de votre organisation <span className="text-error-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Cabinet Dupont, Startup XYZ…"
              required
              autoFocus
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ChevronDown
              className={`size-4 transition ${showDetails ? "rotate-180" : ""}`}
            />
            Détails complémentaires (optionnel)
          </button>

          {showDetails && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Forme juridique
                </label>
                <select
                  value={legalForm}
                  onChange={(e) => setLegalForm(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">— Sélectionner —</option>
                  {LEGAL_FORMS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Secteur d'activité
                </label>
                <input
                  type="text"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="ex. SaaS B2B, Fintech, Immobilier…"
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Taille de l'équipe
                </label>
                <select
                  value={sizeRange}
                  onChange={(e) => setSizeRange(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">— Sélectionner —</option>
                  {SIZE_RANGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? "Création…" : "Créer mon espace"}
          </button>
        </form>
      </div>
    </div>
  );
}
