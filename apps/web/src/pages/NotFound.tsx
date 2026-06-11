import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-title-md font-semibold text-gray-300 dark:text-gray-700">
        404
      </p>
      <h1 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
        Page introuvable
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
