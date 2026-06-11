import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { PLATFORM_NAME } from "@holbert/core";
import { useAuth } from "../context/AuthContext";

export default function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate("/");
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
          Connexion
        </h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Accédez à votre espace juridique
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Pas encore de compte ?{" "}
          <Link
            to="/signup"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
