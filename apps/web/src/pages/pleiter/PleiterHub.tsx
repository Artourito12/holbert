import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { Dossier } from "@holbert/core";
import { MODULES } from "@holbert/core";
import { Badge, Modal, useModal, useToast } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";

const inputCls =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white";

export default function PleiterHub() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const toast = useToast();
  const creation = useModal();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nom: "",
    demandeur: "",
    defendeur: "",
    juridiction: "",
    type_procedure: "",
    enjeu: "",
  });
  const [enregistrement, setEnregistrement] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setDossiers((data as Dossier[]) ?? []);
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  const creer = async () => {
    if (!currentOrg || !user || form.nom.trim().length < 2) return;
    setEnregistrement(true);
    const { error } = await supabase.from("dossiers").insert({
      org_id: currentOrg.id,
      nom: form.nom.trim(),
      parties: {
        demandeur: form.demandeur.trim() || undefined,
        defendeur: form.defendeur.trim() || undefined,
      },
      juridiction: form.juridiction.trim() || null,
      type_procedure: form.type_procedure.trim() || null,
      enjeu_financier: form.enjeu ? Number(form.enjeu) : null,
      created_by: user.id,
    });
    setEnregistrement(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dossier créé");
    creation.closeModal();
    setForm({ nom: "", demandeur: "", defendeur: "", juridiction: "", type_procedure: "", enjeu: "" });
    await load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            {MODULES.pleiter.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vos dossiers contentieux : pièces en vrac, chronologie sourcée,
            bordereau et analyses.
          </p>
        </div>
        <button
          onClick={creation.openModal}
          className="h-11 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          + Nouveau dossier
        </button>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <p className="px-5 py-8 text-sm text-gray-500">Chargement…</p>
        ) : dossiers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            Aucun dossier. Créez le premier et déposez ses pièces en vrac — la
            chronologie se construit automatiquement.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {dossiers.map((d) => (
              <li key={d.id}>
                <Link
                  to={`/dossiers/${d.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{d.nom}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {[d.parties.demandeur, d.parties.defendeur].filter(Boolean).join(" c/ ") || "Parties non renseignées"}
                      {d.juridiction && ` · ${d.juridiction}`}
                      {d.enjeu_financier != null && ` · enjeu ${d.enjeu_financier.toLocaleString("fr-FR")} €`}
                    </p>
                  </div>
                  <Badge size="sm" color={d.statut === "actif" ? "success" : "light"}>
                    {d.statut === "actif" ? "Actif" : "Clos"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal isOpen={creation.isOpen} onClose={creation.closeModal} className="max-w-lg p-8">
        <h3 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">
          Nouveau dossier
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nom du dossier
            </label>
            <input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Dupont c/ SARL Martin — impayés"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Demandeur
              </label>
              <input
                value={form.demandeur}
                onChange={(e) => setForm({ ...form, demandeur: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Défendeur
              </label>
              <input
                value={form.defendeur}
                onChange={(e) => setForm({ ...form, defendeur: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Juridiction
              </label>
              <input
                value={form.juridiction}
                onChange={(e) => setForm({ ...form, juridiction: e.target.value })}
                placeholder="TJ de Lyon"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Enjeu financier (€)
              </label>
              <input
                type="number"
                value={form.enjeu}
                onChange={(e) => setForm({ ...form, enjeu: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Type de procédure
            </label>
            <input
              value={form.type_procedure}
              onChange={(e) => setForm({ ...form, type_procedure: e.target.value })}
              placeholder="Fond, référé, injonction de payer…"
              className={inputCls}
            />
          </div>
          <button
            onClick={() => void creer()}
            disabled={enregistrement || form.nom.trim().length < 2}
            className="h-11 w-full rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {enregistrement ? "Création…" : "Créer le dossier"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
