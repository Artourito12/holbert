import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SidebarProvider } from "./context/SidebarContext";
import {
  OrganizationProvider,
  useOrganization,
} from "./context/OrganizationContext";
import AppLayout from "./layout/AppLayout";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import CreateOrganization from "./pages/CreateOrganization";
import Dashboard from "./pages/Dashboard";
import ContractUpload from "./pages/ContractUpload";
import ContractDetail from "./pages/ContractDetail";
import ContractsList from "./pages/ContractsList";
import CasesList from "./pages/CasesList";
import CaseCreate from "./pages/CaseCreate";
import CaseDetail from "./pages/CaseDetail";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Chargement…
      </div>
    );
  }
  if (!session) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function OrgRequired({ children }: { children: React.ReactNode }) {
  const { orgs, loading } = useOrganization();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Chargement…
      </div>
    );
  }
  if (orgs.length === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <OrganizationProvider>
            <SidebarProvider>
              <Routes>
                <Route
                  path="/signin"
                  element={
                    <PublicOnlyRoute>
                      <SignIn />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <PublicOnlyRoute>
                      <SignUp />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <CreateOrganization />
                    </ProtectedRoute>
                  }
                />
                <Route
                  element={
                    <ProtectedRoute>
                      <OrgRequired>
                        <AppLayout />
                      </OrgRequired>
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/analyse-contrat" element={<ContractUpload />} />
                  <Route path="/contrats" element={<ContractsList />} />
                  <Route path="/contrats/:id" element={<ContractDetail />} />
                  <Route path="/dossiers" element={<CasesList />} />
                  <Route path="/dossiers/nouveau" element={<CaseCreate />} />
                  <Route path="/dossiers/:id" element={<CaseDetail />} />
                  <Route path="/modeles" element={<Placeholder title="Modèles" />} />
                  <Route path="/veille" element={<Placeholder title="Veille juridique" />} />
                  <Route path="/parametres" element={<Placeholder title="Paramètres" />} />
                </Route>
              </Routes>
            </SidebarProvider>
          </OrganizationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
        {title}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Page en construction.
      </p>
    </div>
  );
}
