import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PLATFORM_NAME } from "@holbert/core";
import { supabase } from "../lib/supabase";

export default function Reinitialiser() {
  const navigate = useNavigate();
  const [pret, setPret] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Le lien de l'email connecte l'utilisateur en mode "récupération" :
  // on attend que la session soit posée avant d'afficher le formulaire.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPret(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setPret(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-md dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png" alt={PLATFORM_NAME} className="h-10 w-10 object-contain" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {PLATFORM_NAME}
          </h1>
        </div>

        <h2 className="mb-1 text-xl font-semibold text-gray-900 dark:text-white">
          Nouveau mot de passe
        </h2>

        {!pret ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ce lien n'est plus valide ou a expiré.{" "}
            <Link to="/mot-de-passe-oublie" className="font-medium text-brand-600 hover:text-brand-700">
              Demandez un nouveau lien
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nouveau mot de passe
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirmez le mot de passe
              </label>
              <input
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? "Enregistrement..." : "Définir le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
