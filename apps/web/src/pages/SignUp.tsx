import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { PLATFORM_NAME } from "@holbert/core";
import { useAuth } from "../context/AuthContext";

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signUp(email, password, fullName.trim());
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/signin"), 4000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-md dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/logo.png"
            alt={PLATFORM_NAME}
            className="h-10 w-10 object-contain"
          />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {PLATFORM_NAME}
          </h1>
        </div>

        <h2 className="mb-1 text-xl font-semibold text-gray-900 dark:text-white">
          Créer un compte
        </h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Démarrez avec {PLATFORM_NAME} en quelques secondes
        </p>

        {success ? (
          <div
            role="status"
            className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700"
          >
            Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse,
            puis connectez-vous.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nom complet
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Prénom Nom"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vous@entreprise.fr"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Déjà un compte ?{" "}
          <Link
            to="/signin"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
