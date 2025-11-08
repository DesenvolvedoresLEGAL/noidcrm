import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { LoadingSpinner } from "@/components/LoadingSpinner";
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

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useSupabaseAuth();
  const { onboardingCompleted, currentStep, status, loading: onboardingLoading } = useOnboardingStatus();
  const { isAdmin: isOrgAdmin, isOwner, loading: orgLoading } = useCurrentOrganization();
  const { isAdmin: hasAdminRole, loading: rolesLoading } = useUserRole();

  // Mostra loading se ainda processando ou em transição de auth (session existe mas user ainda não)
  if (loading || onboardingLoading || orgLoading || rolesLoading || (session && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Só redireciona se confirmado que não há sessão
  if (!user && !session) {
    console.log('[ProtectedRoute] Sem usuário/sessão, redirecionando para /login');
    return <Navigate to="/login" replace />;
  }

  console.log('[ProtectedRoute] Verificando onboarding:', {
    onboardingCompleted,
    currentStep,
    userId: user.id,
    status: status
  });

  // GUARD: Onboarding só para owner/admin; demais vão direto pro app
  if (!onboardingCompleted && status !== null) {
    const shouldOnboard = isOwner || isOrgAdmin || hasAdminRole;
    if (shouldOnboard) {
      // Previne loop se já estiver em /onboarding
      if (window.location.pathname === '/onboarding') {
        console.log('[ProtectedRoute] Admin/Owner em /onboarding, permitindo acesso');
        return <>{children}</>;
      }
      console.log('[ProtectedRoute] Admin/Owner sem onboarding, redirecionando para /onboarding');
      return <Navigate to="/onboarding" replace />;
    } else {
      // Usuários não-admin/owner nunca veem onboarding
      if (window.location.pathname === '/onboarding') {
        console.log('[ProtectedRoute] Membro sem permissão em /onboarding, redirecionando para /app/dashboard');
        return <Navigate to="/app/dashboard" replace />;
      }
      console.log('[ProtectedRoute] Onboarding pendente, mas usuário não-adm → permitir acesso ao app');
      // Sem redirecionar; segue para o app
    }
  }

  // Se status ainda é null, manter loading (não redirecionar)
  if (status === null) {
    console.log('[ProtectedRoute] Status ainda não carregado, mantendo loading');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  console.log('[ProtectedRoute] Acesso permitido ao app');

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
        <Route path="/app/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/app/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
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
          
          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
