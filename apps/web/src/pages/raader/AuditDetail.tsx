import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import type { Audit, AuditFinding, Document } from "@holbert/core";
import { referentielNom } from "@holbert/core";
import { Badge, ScoreGauge, useToast } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { useOrg } from "../../context/OrgContext";

const CATEGORIES: Record<AuditFinding["categorie"], { titre: string; desc: string }> = {
  illegale: { titre: "Clauses illégales ou réputées non écrites", desc: "À corriger impérativement" },
  manquante: { titre: "Clauses manquantes", desc: "Attendues pour ce type de contrat" },
  defavorable: { titre: "Clauses défavorables à votre camp", desc: "Licites mais déséquilibrées" },
  incoherence: { titre: "Incohérences internes", desc: "Contradictions dans le document" },
};

const GRAVITE_COLOR: Record<AuditFinding["gravite"], "error" | "warning" | "light"> = {
  majeure: "error",
  moyenne: "warning",
  mineure: "light",
};

const OBJECTIFS: Record<string, string> = {
  signer: "avant signature",
  renegocier: "pour renégociation",
  sortir: "pour sortie du contrat",
  comprendre: "pour compréhension",
};

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentOrg } = useOrg();
  const toast = useToast();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [passageActif, setPassageActif] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !currentOrg) return;
    void (async () => {
      const { data: a } = await supabase.from("audits").select("*").eq("id", id).maybeSingle();
      setAudit((a as Audit) ?? null);
      if (a) {
        const [f, d] = await Promise.all([
          supabase.from("audit_findings").select("*").eq("audit_id", id).order("ordre"),
          supabase.from("documents").select("*").eq("id", a.document_id).maybeSingle(),
        ]);
        setFindings((f.data as AuditFinding[]) ?? []);
        setDoc((d.data as Document) ?? null);
      }
      setLoading(false);
    })();
  }, [id, currentOrg]);

  const texteAnnote = useMemo(() => {
    if (!doc?.texte) return null;
    const morceaux: { texte: string; finding?: AuditFinding }[] = [];
    type Zone = { debut: number; fin: number; finding: AuditFinding };
    const zones: Zone[] = [];
    for (const f of findings) {
      if (!f.passage || f.passage.length < 12) continue;
      const idx = doc.texte.indexOf(f.passage.slice(0, 120));
      if (idx >= 0) {
        zones.push({ debut: idx, fin: idx + Math.min(f.passage.length, 600), finding: f });
      }
    }
    zones.sort((a, b) => a.debut - b.debut);
    let curseur = 0;
    for (const z of zones) {
      if (z.debut < curseur) continue; // chevauchement : on garde la première
      if (z.debut > curseur) morceaux.push({ texte: doc.texte.slice(curseur, z.debut) });
      morceaux.push({ texte: doc.texte.slice(z.debut, z.fin), finding: z.finding });
      curseur = z.fin;
    }
    if (curseur < doc.texte.length) morceaux.push({ texte: doc.texte.slice(curseur) });
    return morceaux;
  }, [doc, findings]);

  if (loading) return <p className="text-sm text-gray-500">Chargement…</p>;
  if (!audit) {
    return (
      <div>
        <p className="text-sm text-gray-500">Audit introuvable.</p>
        <Link to="/raader" className="text-sm font-medium text-brand-600">← Raader</Link>
      </div>
    );
  }

  const groupes = (Object.keys(CATEGORIES) as AuditFinding["categorie"][])
    .map((cat) => ({ cat, items: findings.filter((f) => f.categorie === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <Link to="/raader" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Raader
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          Audit — {doc?.nom_fichier ?? referentielNom(audit.referentiel_id)}
        </h1>
        <Badge color="primary">{referentielNom(audit.referentiel_id)}</Badge>
        <Badge color="light">côté {audit.role}</Badge>
        <Badge color="light">{OBJECTIFS[audit.objectif] ?? audit.objectif}</Badge>
      </div>

      {audit.statut === "error" && (
        <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
          {audit.erreur ?? "L'audit a échoué."}
        </div>
      )}

      {audit.statut === "done" && (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <section className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <ScoreGauge score={audit.score ?? 0} label="Score de risque" />
            </section>
            <section className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                Synthèse exécutive
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {audit.synthese}
              </p>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Constats */}
            <div className="space-y-6">
              {groupes.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
                  Aucun constat : le contrat est conforme au référentiel pour votre camp.
                </div>
              )}
              {groupes.map(({ cat, items }) => (
                <section
                  key={cat}
                  className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      {CATEGORIES[cat].titre}
                      <span className="ml-2 text-sm font-normal text-gray-400">{items.length}</span>
                    </h2>
                    <p className="text-xs text-gray-400">{CATEGORIES[cat].desc}</p>
                  </div>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((f) => (
                      <li key={f.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {f.titre}
                          </p>
                          <Badge size="sm" color={GRAVITE_COLOR[f.gravite]}>
                            {f.gravite}
                          </Badge>
                        </div>
                        {f.explication && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {f.explication}
                          </p>
                        )}
                        {f.fondement && (
                          <p className="mt-1 text-xs font-medium text-gray-400">
                            Fondement : {f.fondement}
                          </p>
                        )}
                        {f.passage && (
                          <button
                            onClick={() => {
                              setPassageActif(f.id);
                              window.document
                                .getElementById(`passage-${f.id}`)
                                ?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                            className="mt-2 block w-full rounded-lg border-l-2 border-brand-300 bg-gray-50 px-3 py-2 text-left text-xs italic text-gray-500 hover:bg-brand-25 dark:bg-white/5 dark:text-gray-400"
                            title="Voir dans le document"
                          >
                            « {f.passage.slice(0, 220)}{f.passage.length > 220 ? "…" : ""} »
                          </button>
                        )}
                        {f.reformulation && (
                          <div className="mt-2 rounded-lg bg-success-50 px-3 py-2 dark:bg-success-500/10">
                            <p className="text-xs font-medium text-success-700">
                              Reformulation proposée
                            </p>
                            <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">
                              {f.reformulation}
                            </p>
                            <button
                              onClick={() => {
                                void navigator.clipboard.writeText(f.reformulation!);
                                toast.success("Reformulation copiée");
                              }}
                              className="mt-1 text-xs font-medium text-success-700 hover:underline"
                            >
                              Copier
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {/* Document annoté */}
            <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Document stabiloté
                </h2>
                <p className="text-xs text-gray-400">
                  Cliquez sur un passage surligné : ma note en marge s'épingle
                  ici (analyse, fondement, reformulation proposée).
                </p>
              </div>

              {/* Note en marge épinglée */}
              {passageActif &&
                (() => {
                  const f = findings.find((x) => x.id === passageActif);
                  if (!f) return null;
                  return (
                    <div className="sticky top-16 z-10 border-b border-brand-200 bg-brand-25 px-5 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          📌 {f.titre}
                          <Badge size="sm" color={GRAVITE_COLOR[f.gravite]}>
                            {f.gravite}
                          </Badge>
                        </p>
                        <button
                          onClick={() => setPassageActif(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Fermer ✕
                        </button>
                      </div>
                      {f.explication && (
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {f.explication}
                        </p>
                      )}
                      {f.fondement && (
                        <p className="mt-1 text-xs font-medium text-gray-500">
                          Fondement : {f.fondement}
                        </p>
                      )}
                      {f.reformulation && (
                        <div className="mt-2 rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                          <p className="text-xs font-medium text-success-700">
                            Reformulation proposée
                          </p>
                          <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">
                            {f.reformulation}
                          </p>
                          <button
                            onClick={() => {
                              void navigator.clipboard.writeText(f.reformulation!);
                              toast.success("Reformulation copiée");
                            }}
                            className="mt-1 text-xs font-medium text-success-700 hover:underline"
                          >
                            Copier
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              <div className="custom-scrollbar max-h-[75vh] overflow-y-auto px-5 py-4">
                {texteAnnote ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {texteAnnote.map((m, i) =>
                      m.finding ? (
                        <mark
                          key={i}
                          id={`passage-${m.finding.id}`}
                          onClick={() => setPassageActif(m.finding!.id)}
                          className={`cursor-pointer rounded px-0.5 transition hover:ring-2 hover:ring-brand-300 ${
                            passageActif === m.finding.id
                              ? "bg-brand-100 ring-2 ring-brand-300"
                              : m.finding.gravite === "majeure"
                                ? "bg-error-100"
                                : m.finding.gravite === "moyenne"
                                  ? "bg-warning-100"
                                  : "bg-gray-100 dark:bg-white/10"
                          }`}
                          title={`${m.finding.titre} — cliquez pour la note`}
                        >
                          {m.texte}
                        </mark>
                      ) : (
                        <span key={i}>{m.texte}</span>
                      )
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Texte du document indisponible (document traité avant cette
                    version — relancez l'analyse depuis Documents).
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <p className="mt-8 text-xs text-gray-400">
        Audit réalisé avec le référentiel {referentielNom(audit.referentiel_id)} v
        {audit.referentiel_version}. Information juridique et aide à la décision —
        pas un conseil juridique individualisé.
      </p>
    </div>
  );
}
