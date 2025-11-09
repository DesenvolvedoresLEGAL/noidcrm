import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
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
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  
  // Hook unificado que substitui 4 hooks anteriores (1 request em vez de 4)
  const { user, isOrgAdmin, isOwner, hasAdminRole, loading: userLoading, isAuthenticated, error: userError } = useCurrentUser();
  const { onboardingCompleted, currentStep, status, loading: onboardingLoading } = useOnboardingStatus();

  // Timeout de segurança: se demorar mais de 10 segundos, mostra erro
  React.useEffect(() => {
    if (userLoading || onboardingLoading) {
      const timer = setTimeout(() => {
        console.error('[ProtectedRoute] TIMEOUT: Carregamento demorou mais de 10 segundos');
        setLoadingTimeout(true);
      }, 10000);
      
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [userLoading, onboardingLoading]);

  // Logs detalhados para debug
  console.log('[ProtectedRoute] Estado detalhado:', {
    timestamp: new Date().toISOString(),
    userLoading,
    onboardingLoading,
    isAuthenticated,
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    isOwner,
    isOrgAdmin,
    hasAdminRole,
    onboardingCompleted,
    currentStep,
    onboardingStatus: status,
    pathname: window.location.pathname,
    userError: userError?.message,
  });

  // Se timeout, mostrar erro com opção de retry
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

  // Se erro ao carregar usuário, mostrar mensagem apropriada
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

  // Mostra loading enquanto carrega dados
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

  // Validação crítica: deve ter usuário autenticado
  if (!isAuthenticated || !user) {
    console.log('[ProtectedRoute] ❌ REDIRECIONAMENTO: Sem autenticação', {
      isAuthenticated,
      hasUser: !!user,
      pathname: window.location.pathname,
    });
    return <Navigate to="/login" replace />;
  }

  console.log('[ProtectedRoute] ✅ Usuário autenticado:', {
    userId: user.id,
    email: user.email,
  });

  console.log('[ProtectedRoute] 🔍 Verificando onboarding:', {
    onboardingCompleted,
    currentStep,
    status,
    isOwner,
    isOrgAdmin,
    hasAdminRole,
  });

  // GUARD: Onboarding só para owner/org-admin; demais vão direto pro app
  // IMPORTANTE: hasAdminRole removido para evitar loop com comerciais que têm role 'admin'
  if (!onboardingCompleted && status !== null) {
    const shouldOnboard = isOwner || isOrgAdmin;
    
    console.log('[ProtectedRoute] 📋 Decisão de onboarding:', {
      shouldOnboard,
      reason: shouldOnboard 
        ? (isOwner ? 'É owner' : 'É org admin') 
        : 'Não é owner nem org admin',
    });
    
    if (shouldOnboard) {
      // Previne loop se já estiver em /onboarding
      if (window.location.pathname === '/onboarding') {
        console.log('[ProtectedRoute] ✅ Owner/Admin já em /onboarding, permitindo acesso');
        return <>{children}</>;
      }
      console.log('[ProtectedRoute] ➡️ REDIRECIONAMENTO: Owner/Admin sem onboarding → /onboarding');
      return <Navigate to="/onboarding" replace />;
    } else {
      // Usuários não-admin/owner nunca veem onboarding
      if (window.location.pathname === '/onboarding') {
        console.log('[ProtectedRoute] ⚠️ REDIRECIONAMENTO: Membro sem permissão tentando acessar /onboarding → /app/dashboard');
        return <Navigate to="/app/dashboard" replace />;
      }
      console.log('[ProtectedRoute] ✅ Comercial: onboarding pendente mas acesso ao app permitido');
    }
  }

  // Se status ainda é null, manter loading (não redirecionar)
  if (status === null) {
    console.log('[ProtectedRoute] ⏳ Status de onboarding ainda não carregado, mantendo loading');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  console.log('[ProtectedRoute] ✅ ACESSO PERMITIDO:', {
    pathname: window.location.pathname,
    userId: user.id,
    roles: { isOwner, isOrgAdmin, hasAdminRole },
  });

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
