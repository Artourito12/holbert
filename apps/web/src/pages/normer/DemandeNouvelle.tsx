import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useToast } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { apiPost } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";

export default function DemandeNouvelle() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const toast = useToast();
  const navigate = useNavigate();
  const [objet, setObjet] = useState("");
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async () => {
    if (!currentOrg || !user || objet.trim().length < 3) return;
    setEnvoi(true);
    try {
      const { data: demande, error } = await supabase
        .from("demandes")
        .insert({
          org_id: currentOrg.id,
          created_by: user.id,
          objet: objet.trim(),
          description: description.trim() || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Qualification automatique (catégorie, priorité, réponse proposée)
      await apiPost("/api/normer/qualifier", { demande_id: demande.id });
      toast.success("Demande transmise à la direction juridique");
      navigate(`/demandes/${demande.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/normer" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Front Door
      </Link>
      <h1 className="mt-2 text-title-sm font-semibold text-gray-900 dark:text-white">
        Nouvelle demande
      </h1>
      <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">
        Décrivez votre besoin avec vos mots : la demande est qualifiée
        automatiquement et un juriste valide la réponse.
      </p>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Objet
          </label>
          <input
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            placeholder="Puis-je signer ce NDA ? Délai de préavis d'un CDD ?…"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Détails (contexte, urgence, pièces concernées…)
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={() => void soumettre()}
          disabled={envoi || objet.trim().length < 3}
          className="h-11 w-full rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {envoi ? "Transmission et qualification…" : "Transmettre à la direction juridique"}
        </button>
      </div>
    </div>
  );
}
