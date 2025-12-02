import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import React from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import Index from "./pages/Index";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import AcceptInvitation from "./pages/AcceptInvitation";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Opportunities from "./pages/Opportunities";
import Activities from "./pages/Activities";
import Proposals from "./pages/Proposals";
import Products from "./pages/Products";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Contacts from "./pages/Contacts";
import Contracts from "./pages/Contracts";
import Sequences from "./pages/Sequences";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AccountSettings from "./pages/settings/Account";
import SystemSettings from "./pages/settings/system/SystemSettings";
import UsersSettings from "./pages/settings/Users";
import EditUser from "./pages/settings/EditUser";
import TeamsSettings from "./pages/settings/Teams";
import Insights from "./pages/Insights";
import AutomationAndSequences from "./pages/AutomationAndSequences";
import Automation from "./pages/Automation";
import PipelineSettings from "./pages/PipelineSettings";
import BusinessUnits from "./pages/settings/BusinessUnits";
import NotFoundPage from "./pages/NotFoundPage";
import Roleplay from "./pages/Roleplay";
import NewRoleplay from "./pages/roleplay/NewRoleplay";
import ChatView from "./pages/roleplay/ChatView";
import SessionSummary from "./pages/roleplay/SessionSummary";
import MySessions from "./pages/roleplay/MySessions";
import Ranking from "./pages/roleplay/Ranking";
import VideoLibrary from "./pages/roleplay/VideoLibrary";
import RoleplayAdmin from "./pages/roleplay/RoleplayAdmin";
import RoleplayReports from "./pages/roleplay/RoleplayReports";
import ProposalPublicView from "./pages/ProposalPublicView";
import Forecast from "./pages/Forecast";
import EmailTemplates from "./pages/EmailTemplates";
import Territories from "./pages/Territories";
import Integrations from "./pages/settings/Integrations";
import DataManagement from "./pages/settings/DataManagement";
import ProductCategories from "./pages/settings/ProductCategories";
import ProductSettingsPage from "./pages/settings/ProductSettings";
import Origins from "./pages/settings/Origins";
import LossReasons from "./pages/settings/LossReasons";
import ProposalLayouts from "./pages/settings/ProposalLayouts";
import ProposalSettings from "./pages/settings/ProposalSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos - dados considerados "fresh"
      refetchOnWindowFocus: false, // NÃO refetch ao voltar para a aba
      refetchOnMount: false, // NÃO refetch se dados estão fresh
      refetchOnReconnect: false, // NÃO refetch ao reconectar
      retry: 1, // Apenas 1 retry em caso de erro
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const {
    user,
    isOrgAdmin,
    isOwner,
    loading: userLoading,
    isAuthenticated,
    error: userError,
  } = useCurrentUser();
  const {
    onboardingCompleted,
    status,
    loading: onboardingLoading,
  } = useOnboardingStatus(user?.id);

  React.useEffect(() => {
    if (userLoading || onboardingLoading) {
      const timer = setTimeout(() => setLoadingTimeout(true), 10000);
      return () => clearTimeout(timer);
    }

    setLoadingTimeout(false);
    return undefined;
  }, [userLoading, onboardingLoading]);

  if (loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-destructive text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold">Tempo esgotado</h2>
          <p className="text-muted-foreground">
            O carregamento está demorando mais do que o esperado.
            Verifique sua conexão com a internet.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (userError && !userLoading) {
    console.error('[ProtectedRoute] Erro ao carregar usuário:', userError);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-destructive text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold">Erro ao carregar dados</h2>
          <p className="text-muted-foreground">
            Ocorreu um erro ao carregar seus dados. Por favor, tente novamente.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }

  if (userLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
          <p className="text-xs text-muted-foreground/60">
            {userLoading ? 'Carregando perfil...' : 'Verificando onboarding...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.id) {
    return <Navigate to="/login" replace />;
  }

  if (!onboardingCompleted && status !== null) {
    const shouldOnboard = isOwner || isOrgAdmin;

    if (shouldOnboard && location.pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }

    if (!shouldOnboard && location.pathname === "/onboarding") {
      return <Navigate to="/app/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="legal-crm-theme"
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/accept-invitation/:token" element={<AcceptInvitation />} />
          <Route path="/public/proposal/:token" element={<ProposalPublicView />} />
          
          {/* Protected Routes */}
          <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/app/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/app/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
          <Route path="/app/opportunities" element={<ProtectedRoute><Opportunities /></ProtectedRoute>} />
          <Route path="/app/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
        <Route path="/app/proposals" element={<ProtectedRoute><Proposals /></ProtectedRoute>} />
        <Route path="/app/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/app/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
        <Route path="/app/accounts/:id" element={<ProtectedRoute><AccountDetail /></ProtectedRoute>} />
          <Route path="/app/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
          <Route path="/app/forecast" element={<ProtectedRoute><Forecast /></ProtectedRoute>} />
          <Route path="/app/email-templates" element={<ProtectedRoute><EmailTemplates /></ProtectedRoute>} />
          <Route path="/app/territories" element={<ProtectedRoute><Territories /></ProtectedRoute>} />
          <Route path="/app/automation" element={<ProtectedRoute><AutomationAndSequences /></ProtectedRoute>} />
          <Route path="/app/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/app/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/app/roleplay" element={<ProtectedRoute><Roleplay /></ProtectedRoute>} />
          <Route path="/app/roleplay/new" element={<ProtectedRoute><NewRoleplay /></ProtectedRoute>} />
          <Route path="/app/roleplay/chat/:sessionId" element={<ProtectedRoute><ChatView /></ProtectedRoute>} />
          <Route path="/app/roleplay/summary/:sessionId" element={<ProtectedRoute><SessionSummary /></ProtectedRoute>} />
          <Route path="/app/roleplay/sessions" element={<ProtectedRoute><MySessions /></ProtectedRoute>} />
          <Route path="/app/roleplay/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
          <Route path="/app/roleplay/videos" element={<ProtectedRoute><VideoLibrary /></ProtectedRoute>} />
          <Route path="/app/roleplay/reports" element={<ProtectedRoute><RoleplayReports /></ProtectedRoute>} />
          <Route path="/app/roleplay/admin" element={<ProtectedRoute><RoleplayAdmin /></ProtectedRoute>} />
          <Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/app/settings/account" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
          <Route path="/app/settings/system" element={<ProtectedRoute><SystemSettings /></ProtectedRoute>} />
          <Route path="/app/settings/users" element={<ProtectedRoute><UsersSettings /></ProtectedRoute>} />
          <Route path="/app/settings/users/:userId/edit" element={<ProtectedRoute><EditUser /></ProtectedRoute>} />
          <Route path="/app/settings/teams" element={<ProtectedRoute><TeamsSettings /></ProtectedRoute>} />
          <Route path="/app/settings/pipelines" element={<ProtectedRoute><PipelineSettings /></ProtectedRoute>} />
          <Route path="/app/settings/business-units" element={<ProtectedRoute><BusinessUnits /></ProtectedRoute>} />
          <Route path="/app/settings/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
          <Route path="/app/settings/data-management" element={<ProtectedRoute><DataManagement /></ProtectedRoute>} />
          <Route path="/app/settings/product-categories" element={<ProtectedRoute><ProductCategories /></ProtectedRoute>} />
          <Route path="/app/settings/product-settings" element={<ProtectedRoute><ProductSettingsPage /></ProtectedRoute>} />
          <Route path="/app/settings/origins" element={<ProtectedRoute><Origins /></ProtectedRoute>} />
          <Route path="/app/settings/loss-reasons" element={<ProtectedRoute><LossReasons /></ProtectedRoute>} />
          <Route path="/app/settings/proposal-layouts" element={<ProtectedRoute><ProposalLayouts /></ProtectedRoute>} />
          <Route path="/app/settings/proposal-settings" element={<ProtectedRoute><ProposalSettings /></ProtectedRoute>} />
          
          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
