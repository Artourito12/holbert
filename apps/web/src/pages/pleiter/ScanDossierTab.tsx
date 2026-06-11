import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanDossier } from "@holbert/core";
import { useToast } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { apiPost } from "../../lib/api";
import { telechargerDocx } from "../../lib/docx";
import RenduTexte from "../../components/RenduTexte";

/**
 * Scan complet du dossier (docs/10 phase 2) : l'utilisateur explique le cas,
 * l'IA lit toutes les pièces, arrête la stratégie séquencée avec délais et
 * traque les vices de procédure dans les deux sens — en asynchrone
 * (progression, on peut quitter et revenir).
 */
export default function ScanDossierTab({ dossierId, nomDossier }: { dossierId: string; nomDossier: string }) {
  const toast = useToast();
  const [scans, setScans] = useState<ScanDossier[]>([]);
  const [scanOuvert, setScanOuvert] = useState<string | null>(null);
  const [contexte, setContexte] = useState("");
  const [lancement, setLancement] = useState(false);
  const compteurPoll = useRef(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("scans_dossier")
      .select("*")
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false });
    const liste = (data as ScanDossier[]) ?? [];
    setScans(liste);
    setScanOuvert((prev) => prev ?? liste[0]?.id ?? null);
  }, [dossierId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scan = scans.find((s) => s.id === scanOuvert) ?? null;

  // Suivi pendant le scan : polling + relance de la chaîne en filet
  useEffect(() => {
    if (scan?.statut !== "en_cours") return;
    const interval = setInterval(() => {
      void load();
      compteurPoll.current += 1;
      if (compteurPoll.current % 4 === 0) {
        void apiPost("/api/dossiers/scan-etape", { scan_id: scan.id }).catch(() => undefined);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [scan?.statut, scan?.id, load]);

  const lancer = async () => {
    setLancement(true);
    try {
      const r = await apiPost<{ scan: ScanDossier }>("/api/dossiers/scan", {
        dossier_id: dossierId,
        contexte,
      });
      setContexte("");
      setScanOuvert(r.scan.id);
      toast.success("Scan lancé — vous pouvez quitter la page, je continue");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLancement(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Lancement */}
      <div className="rounded-xl border border-brand-200 bg-white p-4 dark:border-brand-500/30 dark:bg-gray-900">
        <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
          Lancer un scan complet du dossier
        </p>
        <p className="mb-3 text-xs text-gray-400">
          Expliquez le cas : qui vous défendez, ce que veut le client, où en est
          la procédure, ce qui vous préoccupe. L'IA lira ensuite toutes les
          pièces (les trois camps), arrêtera une stratégie séquencée avec les
          délais de chaque action, et traquera les vices de procédure — contre
          la partie adverse comme sur vos propres actes.
        </p>
        <textarea
          rows={4}
          value={contexte}
          onChange={(e) => setContexte(e.target.value)}
          placeholder="Ex. : Nous défendons SM Studio (créancier). Novaprint refuse de payer 18 000 € malgré une reconnaissance de dette. Le client veut récupérer les fonds vite et éviter un procès long. Aucune assignation délivrée à ce jour…"
          className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <button
          onClick={() => void lancer()}
          disabled={lancement || contexte.trim().length < 20}
          className="mt-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {lancement ? "Lancement…" : "Scanner le dossier"}
        </button>
      </div>

      {/* Historique */}
      {scans.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {scans.map((s) => (
            <button
              key={s.id}
              onClick={() => setScanOuvert(s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                scanOuvert === s.id
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                  : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
              }`}
            >
              Scan du {new Date(s.created_at).toLocaleDateString("fr-FR")}
              {s.statut === "en_cours" ? " · en cours" : s.statut === "erreur" ? " · erreur" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Scan affiché */}
      {scan?.statut === "en_cours" && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Scan en cours…</span>
            <span className="font-semibold text-brand-600">{scan.progression}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-2 rounded-full bg-brand-500 transition-all duration-700"
              style={{ width: `${scan.progression}%` }}
            />
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {scan.etapes.map((e) => (
              <li
                key={e.id}
                className={
                  e.statut === "fait"
                    ? "text-success-600"
                    : e.statut === "en_cours"
                      ? "font-medium text-brand-600"
                      : "text-gray-400"
                }
              >
                {e.statut === "fait" ? "✓" : e.statut === "en_cours" ? "●" : "○"} {e.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-400">
            Vous pouvez quitter cette page : le scan continue et le résultat
            vous attendra ici (et en notification).
          </p>
        </div>
      )}

      {scan?.statut === "erreur" && (
        <div className="rounded-xl bg-error-50 p-4 text-sm text-error-700">
          Le scan a échoué : {scan.erreur ?? "erreur inconnue"}.
          <button
            onClick={() => void apiPost("/api/dossiers/scan-etape", { scan_id: scan.id }).then(load)}
            className="ml-2 font-medium underline"
          >
            Reprendre
          </button>
        </div>
      )}

      {scan?.statut === "terminee" && scan.document && (
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Audit complet du cas
            </p>
            <button
              onClick={() => void telechargerDocx(`Scan — ${nomDossier}`, scan.document!)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Télécharger en DOCX
            </button>
          </div>
          <div className="custom-scrollbar max-h-[75vh] overflow-y-auto px-5 py-4">
            <RenduTexte texte={scan.document} />
          </div>
          {scan.demarche?.length > 0 && (
            <details className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              <summary className="cursor-pointer text-xs font-medium text-brand-600">
                Démarche suivie ({scan.demarche.length} étape(s))
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                {scan.demarche.map((d, i) => (
                  <li key={i}>
                    <span className="font-medium">{d.etape}</span> — {d.detail}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
