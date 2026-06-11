import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import type {
  AnalyseDossier,
  Document,
  Dossier,
  EvenementChronologie,
  Piece,
} from "@holbert/core";
import { Badge, useToast } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { apiPost, sha256 } from "../../lib/api";
import { telechargerDocx } from "../../lib/docx";
import { useAuth } from "../../context/AuthContext";
import { useOrg } from "../../context/OrgContext";
import RenduTexte from "../../components/RenduTexte";

type Onglet = "chronologie" | "pieces" | "analyses";

const ANALYSES_META: Record<AnalyseDossier["type"], { nom: string; desc: string }> = {
  vices: { nom: "Vices de procédure", desc: "Délais et formalités suspects, calculés sur la chronologie" },
  prescription: { nom: "Prescription", desc: "Délais, interruptions et suspensions repérés dans les pièces" },
  synthese: { nom: "Note de synthèse", desc: "Forces, faiblesses, questions probables — préparation d'audience" },
  conclusions: { nom: "Trame de conclusions", desc: "Faits visés pièce par pièce, discussion, dispositif" },
};

const GRAVITE_COLOR = { majeure: "error", moyenne: "warning", mineure: "light" } as const;

const inputCls =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white";

export default function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [pieces, setPieces] = useState<(Piece & { documents: Document | null })[]>([]);
  const [evenements, setEvenements] = useState<EvenementChronologie[]>([]);
  const [analyses, setAnalyses] = useState<AnalyseDossier[]>([]);
  const [analyseOuverte, setAnalyseOuverte] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("chronologie");
  const [loading, setLoading] = useState(true);
  const [travail, setTravail] = useState<string | null>(null);
  const [nouvelEvenement, setNouvelEvenement] = useState({ date: "", titre: "" });

  const load = useCallback(async () => {
    if (!id || !currentOrg) return;
    const [d, p, e, a] = await Promise.all([
      supabase.from("dossiers").select("*").eq("id", id).maybeSingle(),
      supabase.from("pieces").select("*, documents(*)").eq("dossier_id", id).order("numero"),
      supabase.from("evenements").select("*").eq("dossier_id", id).order("date"),
      supabase.from("analyses_dossier").select("*").eq("dossier_id", id).order("created_at", { ascending: false }),
    ]);
    setDossier((d.data as Dossier) ?? null);
    setPieces((p.data as typeof pieces) ?? []);
    setEvenements((e.data as EvenementChronologie[]) ?? []);
    setAnalyses((a.data as AnalyseDossier[]) ?? []);
    setLoading(false);
  }, [id, currentOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Pièces ---------------------------------------------------------------
  const uploaderPieces = async (files: FileList) => {
    if (!dossier || !user || !currentOrg) return;
    let prochainNumero = Math.max(0, ...pieces.map((p) => p.numero)) + 1;
    for (const file of Array.from(files)) {
      setTravail(`Pièce : ${file.name}`);
      try {
        const docId = crypto.randomUUID();
        const path = `${currentOrg.id}/${docId}/${file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const hash = await sha256(file);
        const { error: e1 } = await supabase.from("documents").insert({
          id: docId,
          org_id: currentOrg.id,
          nom_fichier: file.name,
          mime: file.type || "application/octet-stream",
          taille: file.size,
          hash_sha256: hash,
          storage_path: path,
          uploaded_by: user.id,
        });
        if (e1) throw new Error(e1.message);
        const { error: e2 } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: file.type || undefined });
        if (e2) throw new Error(e2.message);

        const { data: piece, error: e3 } = await supabase
          .from("pieces")
          .insert({
            dossier_id: dossier.id,
            org_id: currentOrg.id,
            document_id: docId,
            numero: prochainNumero,
            intitule: file.name.replace(/\.[^.]+$/, ""),
          })
          .select()
          .single();
        if (e3) throw new Error(e3.message);
        prochainNumero += 1;

        await apiPost("/api/documents/process", { document_id: docId });
        setTravail(`Chronologie : ${file.name}`);
        const r = await apiPost<{ evenements: number }>("/api/pleiter/extraire-evenements", {
          piece_id: (piece as Piece).id,
        });
        toast.success(`${file.name} : ${r.evenements} événement(s) ajoutés à la chronologie`);
      } catch (e) {
        toast.error(`${file.name} : ${(e as Error).message}`);
      }
      await load();
    }
    setTravail(null);
  };

  const renumeroter = async (piece: Piece, direction: -1 | 1) => {
    const tri = [...pieces].sort((a, b) => a.numero - b.numero);
    const idx = tri.findIndex((p) => p.id === piece.id);
    const voisin = tri[idx + direction];
    if (!voisin) return;
    // Échange en trois temps (contrainte d'unicité sur le numéro)
    await supabase.from("pieces").update({ numero: -1 }).eq("id", piece.id);
    await supabase.from("pieces").update({ numero: piece.numero }).eq("id", voisin.id);
    await supabase.from("pieces").update({ numero: voisin.numero }).eq("id", piece.id);
    await load();
  };

  const exporterBordereau = () => {
    if (!dossier) return;
    const md =
      `# Bordereau de pièces\n\n## ${dossier.nom}\n\n` +
      ([dossier.parties.demandeur, dossier.parties.defendeur].filter(Boolean).join(" c/ ") || "") +
      "\n\n" +
      pieces
        .map((p) => `- **Pièce n° ${p.numero}** — ${p.intitule}${p.communiquee ? " *(communiquée)*" : ""}`)
        .join("\n");
    void telechargerDocx(`Bordereau — ${dossier.nom}`, md);
  };

  // ---- Chronologie ----------------------------------------------------------
  const ajouterEvenement = async () => {
    if (!dossier || !currentOrg || !user || !nouvelEvenement.date || !nouvelEvenement.titre.trim()) return;
    const { error } = await supabase.from("evenements").insert({
      dossier_id: dossier.id,
      org_id: currentOrg.id,
      date: nouvelEvenement.date,
      titre: nouvelEvenement.titre.trim(),
      origine: "manuel",
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      setNouvelEvenement({ date: "", titre: "" });
      await load();
    }
  };

  const supprimerEvenement = async (ev: EvenementChronologie) => {
    await supabase.from("evenements").delete().eq("id", ev.id);
    await load();
  };

  // ---- Analyses ---------------------------------------------------------------
  const lancerAnalyse = async (type: AnalyseDossier["type"]) => {
    if (!dossier) return;
    setTravail(ANALYSES_META[type].nom);
    try {
      const r = await apiPost<{ analyse: AnalyseDossier }>("/api/pleiter/analyse", {
        dossier_id: dossier.id,
        type,
      });
      toast.success(`${ANALYSES_META[type].nom} : terminée`);
      setAnalyseOuverte(r.analyse.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTravail(null);
      await load();
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Chargement…</p>;
  if (!dossier) {
    return (
      <div>
        <p className="text-sm text-gray-500">Dossier introuvable.</p>
        <Link to="/pleiter" className="text-sm font-medium text-brand-600">← Pleiter</Link>
      </div>
    );
  }

  const pieceParId = Object.fromEntries(pieces.map((p) => [p.id, p]));
  const analyseAffichee = analyses.find((a) => a.id === analyseOuverte) ?? null;

  return (
    <div>
      <Link to="/pleiter" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Pleiter
      </Link>
      <div className="mt-2 mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">{dossier.nom}</h1>
        <Badge size="sm" color={dossier.statut === "actif" ? "success" : "light"}>
          {dossier.statut === "actif" ? "Actif" : "Clos"}
        </Badge>
      </div>
      <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
        {[dossier.parties.demandeur, dossier.parties.defendeur].filter(Boolean).join(" c/ ") || "Parties non renseignées"}
        {dossier.juridiction && ` · ${dossier.juridiction}`}
        {dossier.type_procedure && ` · ${dossier.type_procedure}`}
        {dossier.enjeu_financier != null && ` · enjeu ${dossier.enjeu_financier.toLocaleString("fr-FR")} €`}
      </p>

      {/* Onglets — pattern Heldert underline */}
      <div className="mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(
          [
            ["chronologie", `Chronologie (${evenements.length})`],
            ["pieces", `Pièces & bordereau (${pieces.length})`],
            ["analyses", `Analyses (${analyses.length})`],
          ] as [Onglet, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setOnglet(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              onglet === key
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {travail && (
        <div className="mb-4 rounded-lg bg-brand-25 px-4 py-2.5 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
          Traitement en cours : {travail}…
        </div>
      )}

      {/* ===================== CHRONOLOGIE ===================== */}
      {onglet === "chronologie" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
              <input
                type="date"
                value={nouvelEvenement.date}
                onChange={(e) => setNouvelEvenement((p) => ({ ...p, date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="min-w-64 flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Événement</label>
              <input
                value={nouvelEvenement.titre}
                onChange={(e) => setNouvelEvenement((p) => ({ ...p, titre: e.target.value }))}
                placeholder="Mise en demeure reçue, paiement partiel…"
                className={`${inputCls} w-full`}
              />
            </div>
            <button
              onClick={() => void ajouterEvenement()}
              disabled={!nouvelEvenement.date || !nouvelEvenement.titre.trim()}
              className="h-[38px] rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              + Ajouter
            </button>
          </div>

          {evenements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
              Chronologie vide. Déposez les pièces du dossier (onglet Pièces) :
              les événements datés en seront extraits automatiquement.
            </p>
          ) : (
            <ol className="relative ml-3 space-y-5 border-l-2 border-gray-200 dark:border-gray-800">
              {evenements.map((ev) => {
                const piece = ev.piece_id ? pieceParId[ev.piece_id] : null;
                return (
                  <li key={ev.id} className="relative pl-6">
                    <span
                      className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-950 ${
                        ev.origine === "ia" ? "bg-brand-500" : "bg-gray-400"
                      }`}
                    />
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {new Date(ev.date + "T00:00:00").toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                          <span className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                            {ev.titre}
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          {piece && (
                            <Badge size="sm" color="primary">
                              Pièce n° {piece.numero}
                            </Badge>
                          )}
                          <Badge size="sm" color={ev.origine === "ia" ? "info" : "light"}>
                            {ev.origine === "ia" ? "Extrait" : "Manuel"}
                          </Badge>
                          <button
                            onClick={() => void supprimerEvenement(ev)}
                            className="text-xs text-gray-400 hover:text-error-500"
                            title="Supprimer cet événement"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                      {ev.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{ev.description}</p>
                      )}
                      {ev.source_passage && (
                        <blockquote className="mt-2 border-l-2 border-brand-200 pl-3 text-xs italic text-gray-500 dark:text-gray-400">
                          « {ev.source_passage.slice(0, 250)} »
                        </blockquote>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* ===================== PIÈCES ===================== */}
      {onglet === "pieces" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="h-11 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              + Ajouter des pièces (PDF, DOCX, mails…)
            </button>
            <button
              onClick={exporterBordereau}
              disabled={pieces.length === 0}
              className="h-11 rounded-lg border border-gray-200 px-5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Exporter le bordereau (DOCX)
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.eml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploaderPieces(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            {pieces.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-500">
                Aucune pièce. Déposez-les en vrac : numérotation automatique du
                bordereau et extraction de la chronologie.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {pieces.map((p, i) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-600 dark:bg-brand-500/10">
                        n° {p.numero}
                      </span>
                      <div className="min-w-0">
                        <Link
                          to={`/documents/${p.document_id}`}
                          className="block truncate text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white"
                        >
                          {p.intitule}
                        </Link>
                        <p className="text-xs text-gray-400">
                          {p.documents?.statut === "ready"
                            ? "Traitée"
                            : p.documents?.statut === "error"
                              ? "Erreur de traitement"
                              : "Traitement en cours"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void renumeroter(p, -1)}
                        disabled={i === 0}
                        className="rounded px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Monter"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => void renumeroter(p, 1)}
                        disabled={i === pieces.length - 1}
                        className="rounded px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Descendre"
                      >
                        ↓
                      </button>
                      <button
                        onClick={async () => {
                          setTravail(`Chronologie : ${p.intitule}`);
                          try {
                            const r = await apiPost<{ evenements: number }>(
                              "/api/pleiter/extraire-evenements",
                              { piece_id: p.id }
                            );
                            toast.success(`${r.evenements} événement(s) extraits`);
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                          setTravail(null);
                          await load();
                        }}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                      >
                        Extraire la chronologie
                      </button>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={p.communiquee}
                          onChange={async (e) => {
                            await supabase
                              .from("pieces")
                              .update({ communiquee: e.target.checked })
                              .eq("id", p.id);
                            await load();
                          }}
                        />
                        Communiquée
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ===================== ANALYSES ===================== */}
      {onglet === "analyses" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(ANALYSES_META) as AnalyseDossier["type"][]).map((type) => (
              <button
                key={type}
                onClick={() => void lancerAnalyse(type)}
                disabled={travail !== null || evenements.length === 0}
                className="rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-theme-md disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {ANALYSES_META[type].nom} →
                </p>
                <p className="mt-1 text-xs text-gray-400">{ANALYSES_META[type].desc}</p>
              </button>
            ))}
          </div>
          {evenements.length === 0 && (
            <p className="text-xs text-gray-400">
              Les analyses se construisent sur la chronologie : extrayez d'abord
              les événements des pièces.
            </p>
          )}

          {analyses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {analyses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAnalyseOuverte(a.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    analyseOuverte === a.id
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                      : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
                  }`}
                >
                  {ANALYSES_META[a.type].nom} · {new Date(a.created_at).toLocaleDateString("fr-FR")}
                </button>
              ))}
            </div>
          )}

          {analyseAffichee && (
            <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {ANALYSES_META[analyseAffichee.type].nom}
                </h2>
                {analyseAffichee.contenu && (
                  <button
                    onClick={() =>
                      void telechargerDocx(
                        `${ANALYSES_META[analyseAffichee.type].nom} — ${dossier.nom}`,
                        analyseAffichee.contenu!
                      )
                    }
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Télécharger en DOCX
                  </button>
                )}
              </div>
              <div className="space-y-4 p-5">
                {analyseAffichee.resultat?.findings?.length ? (
                  <ul className="space-y-3">
                    {analyseAffichee.resultat.findings.map((f, i) => (
                      <li key={i} className="rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{f.titre}</p>
                          <Badge size="sm" color={GRAVITE_COLOR[f.gravite]}>
                            {f.gravite}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{f.explication}</p>
                        {f.fondement && (
                          <p className="mt-1 text-xs font-medium text-gray-400">Fondement : {f.fondement}</p>
                        )}
                        {f.evenements_lies && f.evenements_lies.length > 0 && (
                          <p className="mt-1 text-xs text-gray-400">
                            Événements : {f.evenements_lies.join(", ")}
                          </p>
                        )}
                        {f.action_recommandee && (
                          <p className="mt-2 rounded-lg bg-brand-25 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                            Action recommandée : {f.action_recommandee}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {analyseAffichee.contenu && !analyseAffichee.resultat?.findings?.length && (
                  <RenduTexte texte={analyseAffichee.contenu} />
                )}
                {analyseAffichee.resultat?.findings?.length && analyseAffichee.contenu ? (
                  <p className="border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
                    {analyseAffichee.contenu}
                  </p>
                ) : null}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400">
        Outils d'aide à la préparation du dossier — les analyses sont des
        signalements à vérifier par l'avocat, pas des conclusions définitives.
      </p>
    </div>
  );
}
