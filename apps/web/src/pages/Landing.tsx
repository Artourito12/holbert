import { Link } from "react-router";
import { MODULES, PLATFORM_NAME, SUITE_NAME } from "@holbert/core";
import { useAuth } from "../context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Page de garde publique — structure héritée de la landing Heldert
// (hero scène en fond + voile, sections alternées, FAQ, CTA final),
// palette bordeaux Holbert, un bloc différencié par module.
// ─────────────────────────────────────────────────────────────────────────────

const MODULES_LANDING = [
  {
    id: "raader",
    nom: MODULES.raader.name,
    accroche: "Le conseiller juridique du quotidien",
    cible: "Particuliers · TPE · opérationnels",
    couleur: "#b22a45",
    fond: "#fbeaee",
    features: [
      "Posez vos questions : réponses sourcées sur VOS documents, articles vérifiés sur Légifrance",
      "Audit de contrat clause par clause : score de risque, clauses illégales, reformulations prêtes à copier",
      "Création de contrats et courriers avec leurs fondements juridiques, export Word",
      "Calculateurs intégrés : licenciement, pension alimentaire, prescription — détail du calcul inclus",
    ],
  },
  {
    id: "pleiter",
    nom: MODULES.pleiter.name,
    accroche: "Le dossier contentieux augmenté",
    cible: "Avocats · cabinets",
    couleur: "#026aa2",
    fond: "#f0f9ff",
    features: [
      "Déposez les pièces en vrac : chronologie datée et sourcée construite automatiquement",
      "Bordereau de pièces numéroté, réordonnable, exporté en un clic",
      "Vices de procédure et prescription détectés sur la chronologie (interruptions repérées)",
      "Trame de conclusions : faits visés pièce par pièce, discussion, dispositif",
    ],
  },
  {
    id: "normer",
    nom: MODULES.normer.name,
    accroche: "La direction juridique pilotée",
    cible: "Directions juridiques · juristes d'entreprise",
    couleur: "#5b21b6",
    fond: "#ede9fe",
    features: [
      "Front Door : toutes les demandes des opérationnels entrent, sont qualifiées et priorisées",
      "L'IA propose, le juriste valide — chaque réponse part signée par un humain",
      "Base de réponses types : la mémoire de la DJ survit aux départs",
      "Reporting volumes / délais / typologies : le tableau de bord à montrer à la direction générale",
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "Mes documents sont-ils en sécurité ?",
    a: "Vos données sont hébergées en Union européenne, chiffrées, et strictement cloisonnées par organisation : aucune autre organisation — ni même notre équipe — n'accède à vos documents. Chaque action est tracée dans un journal d'audit.",
  },
  {
    q: `${PLATFORM_NAME} remplace-t-il un avocat ?`,
    a: "Non, et il ne le prétend pas : la plateforme fournit de l'information juridique et des outils d'aide à la décision. Quand votre situation exige un conseil individualisé, elle vous le dit honnêtement et vous oriente vers le bon professionnel.",
  },
  {
    q: "Comment l'IA évite-t-elle d'inventer des références ?",
    a: "Chaque article de loi cité dans une réponse est vérifié automatiquement contre la base officielle Légifrance : vous voyez en un coup d'œil s'il est en vigueur, modifié, ou introuvable. Et chaque réponse appuyée sur vos documents cite le passage exact, cliquable.",
  },
  {
    q: "Faut-il prendre les trois modules ?",
    a: `Non. Chaque module fonctionne et se souscrit séparément. Mais ils partagent la même base documentaire : combinés (la suite ${SUITE_NAME}), une question d'opérationnel peut devenir un audit de contrat puis alimenter un dossier contentieux sans jamais ressaisir quoi que ce soit.`,
  },
  {
    q: "Combien de temps prend la mise en place ?",
    a: "Quelques minutes. Vous déposez vos documents en vrac : la plateforme les classe, en extrait les données et les échéances, et vous montre ce qui manque. L'onboarding est lui-même une démonstration du produit.",
  },
];

function SectionHeader({ kicker, titre, sous }: { kicker: string; titre: string; sous?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-500">{kicker}</p>
      <h2 className="text-title-sm font-semibold text-gray-900 sm:text-title-md">{titre}</h2>
      {sous && <p className="mt-3 text-base text-gray-500">{sous}</p>}
    </div>
  );
}

export default function Landing() {
  const { session } = useAuth();

  return (
    <div className="bg-white text-gray-900" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* ── Header marketing ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt={PLATFORM_NAME} className="h-8 w-8 object-contain" />
            <span className="text-lg font-semibold">{PLATFORM_NAME}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
            <a href="#modules" className="hover:text-brand-600">Modules</a>
            <a href="#ia" className="hover:text-brand-600">L'IA & la preuve</a>
            <a href="#securite" className="hover:text-brand-600">Sécurité</a>
            <a href="#faq" className="hover:text-brand-600">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Link
                to="/"
                className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
              >
                Ouvrir mon espace
              </Link>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Se connecter
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── 1. Hero — scène en fond + voile, comme Heldert ───────────── */}
      <section className="relative overflow-hidden bg-brand-25 pb-24 pt-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-bottom bg-no-repeat opacity-50"
          style={{ backgroundImage: "url('/hero-scene.png')" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #fdf6f7EE 0%, #fdf6f799 40%, #fdf6f755 80%, transparent 100%)",
          }}
        />
        {/* Halos bordeaux discrets */}
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-28 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle, #eb9cab66 0%, transparent 70%)", filter: "blur(50px)" }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, #de6c8455 0%, transparent 70%)", filter: "blur(50px)" }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700">
                Plateforme juridique IA française · données hébergées en UE
              </div>
              <h1 className="text-title-md font-semibold leading-tight text-gray-900 sm:text-title-lg">
                Le droit, sans choisir de module.
                <span className="text-brand-600"> Déposez, demandez — la plateforme fait le reste.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-gray-600">
                Vous parlez ou vous déposez un document : {PLATFORM_NAME} comprend
                votre besoin, fouille vos propres documents, calcule, audite,
                rédige — et cite ses sources, vérifiées sur Légifrance.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/signup"
                  className="rounded-lg bg-brand-500 px-6 py-3.5 text-sm font-semibold text-white shadow-theme-sm transition hover:bg-brand-600"
                >
                  Créer mon espace
                </Link>
                <a
                  href="#modules"
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Découvrir les modules
                </a>
              </div>
              <p className="mt-5 text-xs text-gray-500">
                Information juridique et aide à la décision — pas un cabinet d'avocats.
              </p>
            </div>

            {/* Mockup simplifié : conversation + audit */}
            <div className="relative">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-lg">
                <p className="mb-3 text-xs font-medium uppercase text-gray-400">Assistant</p>
                <div className="mb-3 ml-auto w-fit max-w-[80%] rounded-2xl bg-brand-500 px-4 py-2.5 text-sm text-white">
                  Que dit mon bail sur l'indexation du loyer ?
                </div>
                <div className="w-fit max-w-[90%] rounded-2xl bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                  Votre bail prévoit une indexation annuelle sur l'ILC <strong>qui ne
                  joue qu'à la hausse</strong> — une clause réputée non écrite
                  (Cass. 3e civ., 30 juin 2021)…
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-500 text-[10px] font-bold text-white">✓</span>
                    <span className="text-gray-500">art. L. 112-1 c. mon. fin. — vérifié en vigueur</span>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-8 -left-6 hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg sm:block">
                <p className="text-xs font-medium uppercase text-gray-400">Audit — bail commercial</p>
                <p className="mt-1 text-2xl font-semibold text-error-500">72<span className="text-sm text-gray-400"> /100</span></p>
                <p className="text-xs text-gray-500">4 clauses majeures à renégocier</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Le principe ───────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            kicker="Le principe"
            titre="Vous ne choisissez jamais de fonction"
            sous="C'est la plateforme qui identifie votre besoin et mobilise la bonne compétence."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                t: "Déposez en vrac",
                d: "Contrats, courriers, mails, pièces : chaque document est reconnu, classé, ses données et échéances extraites — avec votre confirmation à chaque étape.",
              },
              {
                t: "Demandez normalement",
                d: "Une question, un calcul, un audit, un courrier : l'IA cherche d'abord dans VOS documents, puis ne vous pose que les questions qui manquent vraiment.",
              },
              {
                t: "Recevez du vérifiable",
                d: "Réponses sourcées passage par passage, articles contrôlés sur Légifrance, détail des calculs, reformulations prêtes à l'emploi. Jamais de boîte noire.",
              },
            ].map((b, i) => (
              <div key={b.t} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs">
                <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
                  {i + 1}
                </span>
                <h3 className="text-base font-semibold text-gray-900">{b.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Les modules — différenciés ────────────────────────────── */}
      <section id="modules" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            kicker="Trois modules, une plateforme"
            titre="Chacun se suffit. Ensemble, ils se répondent."
            sous={`Souscrits séparément, ils partagent la même base documentaire. Les trois réunis forment la suite ${SUITE_NAME}.`}
          />
          <div className="space-y-8">
            {MODULES_LANDING.map((m, i) => (
              <div
                key={m.id}
                className={`grid items-center gap-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-xs lg:grid-cols-5 ${
                  i % 2 === 1 ? "lg:[direction:rtl]" : ""
                }`}
              >
                <div className="lg:col-span-2 lg:[direction:ltr]">
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: m.couleur, backgroundColor: m.fond }}
                  >
                    {m.cible}
                  </span>
                  <h3 className="mt-3 text-2xl font-semibold" style={{ color: m.couleur }}>
                    {m.nom}
                  </h3>
                  <p className="mt-1 text-lg font-medium text-gray-900">{m.accroche}</p>
                  <p className="mt-2 text-sm text-gray-500">{MODULES[m.id as keyof typeof MODULES].description}</p>
                </div>
                <ul className="space-y-3 lg:col-span-3 lg:[direction:ltr]">
                  {m.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm leading-relaxed text-gray-700">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: m.couleur }}
                      >
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. IA & preuve — section sombre, comme Heldert ───────────── */}
      <section id="ia" className="bg-gray-900 py-24 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-300">
              L'IA qui montre ses preuves
            </p>
            <h2 className="text-title-sm font-semibold sm:text-title-md">
              Une IA juridique ne vaut que si on peut la vérifier
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                t: "Sources citées",
                d: "Chaque réponse appuyée sur vos documents cite le passage exact — cliquable, vérifiable.",
              },
              {
                t: "Légifrance en direct",
                d: "Les articles cités sont contrôlés contre la base officielle : en vigueur, modifié ou introuvable, vous le voyez.",
              },
              {
                t: "Réflexion en profondeur",
                d: "Les analyses à enjeu (audits, prescriptions, conclusions) mobilisent un raisonnement long — la vitesse est réservée au tri.",
              },
              {
                t: "L'humain décide",
                d: "Audits relus par vous, réponses du Front Door validées par un juriste, chronologies éditables par l'avocat.",
              },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-base font-semibold text-white">{b.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Sécurité ──────────────────────────────────────────────── */}
      <section id="securite" className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            kicker="Sécurité & conformité"
            titre="Conçu pour des données qui ne pardonnent pas"
          />
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                t: "Hébergement UE & RGPD",
                d: "Données hébergées en Union européenne, chiffrées, supprimées sur demande. RGPD par conception, pas par rattrapage.",
              },
              {
                t: "Cloisonnement strict",
                d: "Chaque organisation est isolée au niveau de la base de données elle-même — testé automatiquement. Même notre administration n'accède pas à vos contenus.",
              },
              {
                t: "Journal d'audit complet",
                d: "Qui a fait quoi, quand : chaque action est tracée. Indispensable pour les cabinets et les directions juridiques.",
              },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-base font-semibold text-gray-900">{b.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Tarifs teaser ─────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <SectionHeader
            kicker="Tarifs"
            titre="Un abonnement par module"
            sous={`${MODULES.raader.name}, ${MODULES.pleiter.name} et ${MODULES.normer.name} se souscrivent indépendamment — la suite ${SUITE_NAME} les réunit. Offres en cours de finalisation : créez votre espace pour être recontacté en priorité.`}
          />
          <Link
            to="/signup"
            className="inline-flex rounded-lg bg-brand-500 px-6 py-3.5 text-sm font-semibold text-white shadow-theme-sm transition hover:bg-brand-600"
          >
            Créer mon espace gratuitement
          </Link>
        </div>
      </section>

      {/* ── 7. FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="bg-white py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeader kicker="FAQ" titre="Les questions qu'on nous pose" />
          <div className="space-y-3">
            {FAQ_ITEMS.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-gray-200 bg-white px-5 py-4 open:shadow-theme-xs"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. CTA final + footer ────────────────────────────────────── */}
      <section className="bg-brand-700 py-20 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-title-sm font-semibold sm:text-title-md">
            Déposez votre premier document. Le reste suit.
          </h2>
          <p className="mt-3 text-brand-100">
            L'onboarding est la démonstration : en quelques minutes, vos
            documents sont classés et vos échéances détectées.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            Créer mon espace
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt={PLATFORM_NAME} className="h-6 w-6 object-contain" />
            <span className="text-sm font-semibold text-gray-900">{PLATFORM_NAME}</span>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-gray-400">
            {PLATFORM_NAME} fournit de l'information juridique et des outils
            d'aide à la décision. La plateforme ne délivre pas de conseil
            juridique individualisé, activité réglementée réservée aux
            professionnels du droit — quand votre situation l'exige, elle vous
            oriente vers eux.
          </p>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} {PLATFORM_NAME}</p>
        </div>
      </footer>
    </div>
  );
}
