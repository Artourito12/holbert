import { Navigate, Outlet, Route, Routes } from "react-router";
import type { ModuleId } from "@holbert/core";
import { useAuth } from "./context/AuthContext";
import { useOrg } from "./context/OrgContext";
import AppLayout from "./layout/AppLayout";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import MotDePasseOublie from "./pages/MotDePasseOublie";
import Reinitialiser from "./pages/Reinitialiser";
import CreateOrganization from "./pages/CreateOrganization";
import Dashboard from "./pages/Dashboard";
import RaaderHub from "./pages/raader/RaaderHub";
import AuditDetail from "./pages/raader/AuditDetail";
import ContratNouveau from "./pages/raader/ContratNouveau";
import ContratGenere from "./pages/raader/ContratGenere";
import CourrierNouveau from "./pages/raader/CourrierNouveau";
import { CalculateursListe, CalculateurPage } from "./pages/raader/Calculateurs";
import PleiterHub from "./pages/pleiter/PleiterHub";
import DossierDetail from "./pages/pleiter/DossierDetail";
import NormerHub from "./pages/normer/NormerHub";
import DemandeNouvelle from "./pages/normer/DemandeNouvelle";
import DemandeDetail from "./pages/normer/DemandeDetail";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import Echeancier from "./pages/Echeancier";
import Assistant from "./pages/Assistant";
import Organisation from "./pages/Organisation";
import UiKit from "./pages/UiKit";
import AdminPage from "./pages/admin/AdminPage";
import NotFound from "./pages/NotFound";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500"
        role="status"
        aria-label="Chargement"
      />
    </div>
  );
}

/** Bloque l'accès aux pages protégées tant que l'utilisateur n'est pas connecté. */
function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/accueil" replace />;
  return <Outlet />;
}

/** Redirige vers la création d'organisation si l'utilisateur n'en a aucune. */
function RequireOrg() {
  const { orgs, loading } = useOrg();
  if (loading) return <LoadingScreen />;
  if (orgs.length === 0) return <Navigate to="/creer-organisation" replace />;
  return <Outlet />;
}

/** Réservé aux organisations dont le module est activé. */
function RequireModule({ module }: { module: ModuleId }) {
  const { hasModule, loading } = useOrg();
  if (loading) return <LoadingScreen />;
  if (!hasModule(module)) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Réservé au super admin plateforme. */
function RequireAdmin() {
  const { isPlatformAdmin, loading } = useOrg();
  if (loading) return <LoadingScreen />;
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/accueil" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
      <Route path="/reinitialiser" element={<Reinitialiser />} />

      <Route element={<RequireAuth />}>
        <Route path="/creer-organisation" element={<CreateOrganization />} />

        <Route element={<RequireOrg />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/:id" element={<DocumentDetail />} />
            <Route path="/echeancier" element={<Echeancier />} />
            <Route path="/organisation" element={<Organisation />} />
            <Route element={<RequireModule module="raader" />}>
              <Route path="/raader" element={<RaaderHub />} />
              <Route path="/audits/:id" element={<AuditDetail />} />
              <Route path="/contrats/nouveau" element={<ContratNouveau />} />
              <Route path="/contrats/:id" element={<ContratGenere />} />
              <Route path="/courriers/nouveau" element={<CourrierNouveau />} />
              <Route path="/calculateurs" element={<CalculateursListe />} />
              <Route path="/calculateurs/:competence" element={<CalculateurPage />} />
            </Route>
            <Route element={<RequireModule module="pleiter" />}>
              <Route path="/pleiter" element={<PleiterHub />} />
              <Route path="/dossiers/:id" element={<DossierDetail />} />
            </Route>
            <Route element={<RequireModule module="normer" />}>
              <Route path="/normer" element={<NormerHub />} />
              <Route path="/demandes/nouvelle" element={<DemandeNouvelle />} />
              <Route path="/demandes/:id" element={<DemandeDetail />} />
            </Route>
            <Route path="/ui-kit" element={<UiKit />} />

            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
