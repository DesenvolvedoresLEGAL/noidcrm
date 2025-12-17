import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import React, { Suspense, lazy } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingPage } from "@/components/LoadingPage";

// Public routes - loaded immediately
import Index from "./pages/Index";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import AcceptInvitation from "./pages/AcceptInvitation";
import ProposalPublicView from "./pages/ProposalPublicView";
import NotFoundPage from "./pages/NotFoundPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";

// Protected routes - lazy loaded
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Opportunities = lazy(() => import("./pages/Opportunities"));
const Activities = lazy(() => import("./pages/Activities"));
const Proposals = lazy(() => import("./pages/Proposals"));
const Products = lazy(() => import("./pages/Products"));
const Accounts = lazy(() => import("./pages/Accounts"));
const AccountDetail = lazy(() => import("./pages/AccountDetail"));
const AccountEditor = lazy(() => import("./pages/AccountEditor"));
const OpportunityDetail = lazy(() => import("./pages/OpportunityDetail"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Contracts = lazy(() => import("./pages/Contracts"));
const Sequences = lazy(() => import("./pages/Sequences"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout"));
const ProfileSettings = lazy(() => import("./pages/settings/ProfileSettings"));
const SecuritySettings = lazy(() => import("./pages/settings/SecuritySettings"));
const OrganizationSettings = lazy(() => import("./pages/settings/OrganizationSettings"));
const BillingOverview = lazy(() => import("./pages/settings/billing/BillingOverview"));
const BillingInvoices = lazy(() => import("./pages/settings/billing/BillingInvoices"));
const BillingPaymentMethod = lazy(() => import("./pages/settings/billing/BillingPaymentMethod"));
const AccountSettings = lazy(() => import("./pages/settings/Account"));
const SystemSettings = lazy(() => import("./pages/settings/system/SystemSettings"));
const UsersSettings = lazy(() => import("./pages/settings/Users"));
const EditUser = lazy(() => import("./pages/settings/EditUser"));
const TeamsSettings = lazy(() => import("./pages/settings/Teams"));
const Insights = lazy(() => import("./pages/Insights"));
const AutomationAndSequences = lazy(() => import("./pages/AutomationAndSequences"));
const Automation = lazy(() => import("./pages/Automation"));
const PipelineSettings = lazy(() => import("./pages/PipelineSettings"));
const BusinessUnits = lazy(() => import("./pages/settings/BusinessUnits"));
const Roleplay = lazy(() => import("./pages/Roleplay"));
const NewRoleplay = lazy(() => import("./pages/roleplay/NewRoleplay"));
const ChatView = lazy(() => import("./pages/roleplay/ChatView"));
const SessionSummary = lazy(() => import("./pages/roleplay/SessionSummary"));
const MySessions = lazy(() => import("./pages/roleplay/MySessions"));
const Ranking = lazy(() => import("./pages/roleplay/Ranking"));
const VideoLibrary = lazy(() => import("./pages/roleplay/VideoLibrary"));
const RoleplayAdmin = lazy(() => import("./pages/roleplay/RoleplayAdmin"));
const Scoring = lazy(() => import("./pages/Scoring"));
const RoleplayReports = lazy(() => import("./pages/roleplay/RoleplayReports"));
const Forecast = lazy(() => import("./pages/Forecast"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const Territories = lazy(() => import("./pages/Territories"));
const Integrations = lazy(() => import("./pages/settings/Integrations"));
const DataManagement = lazy(() => import("./pages/settings/DataManagement"));
const ProductCategories = lazy(() => import("./pages/settings/ProductCategories"));
const ProductSettingsPage = lazy(() => import("./pages/settings/ProductSettings"));
const Origins = lazy(() => import("./pages/settings/Origins"));
const LossReasons = lazy(() => import("./pages/settings/LossReasons"));
const ProposalLayouts = lazy(() => import("./pages/settings/ProposalLayouts"));
const ProposalSettings = lazy(() => import("./pages/settings/ProposalSettings"));
const ProposalTemplateEditor = lazy(() => import("./pages/settings/ProposalTemplateEditor"));
const ReleaseNotes = lazy(() => import("./pages/ReleaseNotes"));
const ProposalEditor = lazy(() => import("./pages/ProposalEditor"));
const CustomFields = lazy(() => import("./pages/settings/CustomFields"));
const CustomForms = lazy(() => import("./pages/settings/CustomForms"));
const PermissionSettings = lazy(() => import("./pages/settings/PermissionSettings"));
const Industries = lazy(() => import("./pages/settings/Industries"));
const AIOperations = lazy(() => import("./pages/AIOperations"));
const SalesConfigPage = lazy(() => import("./pages/settings/SalesConfigPage"));
const SellerTargetsPage = lazy(() => import("./pages/settings/SellerTargetsPage"));

// GTM Routes - Revenue Operating System
const SDRCommandCenter = lazy(() => import("./pages/gtm/SDRCommandCenter"));
const AEDashboard = lazy(() => import("./pages/gtm/AEDashboard"));
const CSDashboard = lazy(() => import("./pages/gtm/CSDashboard"));
const RevOpsCockpit = lazy(() => import("./pages/gtm/RevOpsCockpit"));
const ManagerDashboard = lazy(() => import("./pages/gtm/ManagerDashboard"));
const CEODashboard = lazy(() => import("./pages/gtm/CEODashboard"));
const PlaybookBoard = lazy(() => import("./pages/gtm/PlaybookBoard"));
const PlaybookLeaderboard = lazy(() => import("./pages/gtm/PlaybookLeaderboard"));
const WinLossHub = lazy(() => import("./pages/intelligence/WinLossHub"));
const KnowledgeGraph = lazy(() => import("./pages/app/intelligence/KnowledgeGraph"));
const Memories = lazy(() => import("./pages/app/intelligence/Memories"));
const OTEReport = lazy(() => import("./pages/OTEReport"));

// Admin Panel Routes
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const CommandCenter = lazy(() => import("./pages/admin/CommandCenter"));
const AdminOrganizations = lazy(() => import("./pages/admin/Organizations"));
const OrganizationDetail = lazy(() => import("./pages/admin/OrganizationDetail"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const RevenueBilling = lazy(() => import("./pages/admin/RevenueBilling"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminLogs = lazy(() => import("./pages/admin/Logs"));
const AdminAudit = lazy(() => import("./pages/admin/Audit"));
const AdminAIControl = lazy(() => import("./pages/admin/AIControl"));
const AdminInfrastructure = lazy(() => import("./pages/admin/Infrastructure"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const ControlRoom = lazy(() => import("./pages/admin/ControlRoom"));
const TraceViewer = lazy(() => import("./pages/admin/TraceViewer"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
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

// Suspense wrapper for lazy routes
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingPage message="Carregando módulo..." />}>
      <ErrorBoundary section="módulo">
        {children}
      </ErrorBoundary>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary section="aplicação">
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
              <Route path="/p/:token" element={<ProposalPublicView />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              
              {/* Protected Routes - Lazy Loaded */}
              <Route path="/app" element={<ProtectedRoute><LazyRoute><Dashboard /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/dashboard" element={<ProtectedRoute><LazyRoute><Dashboard /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/leads" element={<ProtectedRoute><LazyRoute><Leads /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/opportunities" element={<ProtectedRoute><LazyRoute><Opportunities /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/opportunities/:id" element={<ProtectedRoute><LazyRoute><OpportunityDetail /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/activities" element={<ProtectedRoute><LazyRoute><Activities /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/proposals" element={<ProtectedRoute><LazyRoute><Proposals /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/proposals/new" element={<ProtectedRoute><LazyRoute><ProposalEditor /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/proposals/:id/edit" element={<ProtectedRoute><LazyRoute><ProposalEditor /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/products" element={<ProtectedRoute><LazyRoute><Products /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/accounts" element={<ProtectedRoute><LazyRoute><Accounts /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/accounts/:id" element={<ProtectedRoute><LazyRoute><AccountDetail /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/accounts/:id/edit" element={<ProtectedRoute><LazyRoute><AccountEditor /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/contracts" element={<ProtectedRoute><LazyRoute><Contracts /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/forecast" element={<ProtectedRoute><LazyRoute><Forecast /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/email-templates" element={<ProtectedRoute><LazyRoute><EmailTemplates /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/territories" element={<ProtectedRoute><LazyRoute><Territories /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/automation" element={<ProtectedRoute><LazyRoute><AutomationAndSequences /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/reports" element={<ProtectedRoute><LazyRoute><Reports /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/reports/ote" element={<ProtectedRoute><LazyRoute><OTEReport /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/insights" element={<ProtectedRoute><LazyRoute><Insights /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/scoring" element={<ProtectedRoute><LazyRoute><Scoring /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay" element={<ProtectedRoute><LazyRoute><Roleplay /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay/new" element={<ProtectedRoute><LazyRoute><NewRoleplay /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay/chat/:sessionId" element={<ProtectedRoute><LazyRoute><ChatView /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay/summary/:sessionId" element={<ProtectedRoute><LazyRoute><SessionSummary /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay/sessions" element={<ProtectedRoute><LazyRoute><MySessions /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay/ranking" element={<ProtectedRoute><LazyRoute><Ranking /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay/videos" element={<ProtectedRoute><LazyRoute><VideoLibrary /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay/reports" element={<ProtectedRoute><LazyRoute><RoleplayReports /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/roleplay/admin" element={<ProtectedRoute><LazyRoute><RoleplayAdmin /></LazyRoute></ProtectedRoute>} />
              {/* Settings V2 - Layout with nested routes */}
              <Route path="/app/settings" element={<ProtectedRoute><LazyRoute><SettingsLayout /></LazyRoute></ProtectedRoute>}>
                <Route index element={<ProfileSettings />} />
                <Route path="profile" element={<ProfileSettings />} />
                <Route path="security" element={<SecuritySettings />} />
                <Route path="organization" element={<OrganizationSettings />} />
                <Route path="billing" element={<BillingOverview />} />
                <Route path="billing/invoices" element={<BillingInvoices />} />
                <Route path="billing/payment" element={<BillingPaymentMethod />} />
                <Route path="account" element={<AccountSettings />} />
                <Route path="system" element={<SystemSettings />} />
                <Route path="users" element={<UsersSettings />} />
                <Route path="users/:userId/edit" element={<EditUser />} />
                <Route path="teams" element={<TeamsSettings />} />
                <Route path="pipelines" element={<PipelineSettings />} />
                <Route path="business-units" element={<BusinessUnits />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="data-management" element={<DataManagement />} />
                <Route path="product-categories" element={<ProductCategories />} />
                <Route path="product-settings" element={<ProductSettingsPage />} />
                <Route path="origins" element={<Origins />} />
                <Route path="industries" element={<Industries />} />
                <Route path="loss-reasons" element={<LossReasons />} />
                <Route path="proposal-layouts" element={<ProposalLayouts />} />
                <Route path="proposal-settings" element={<ProposalSettings />} />
                <Route path="proposal-templates" element={<ProposalLayouts />} />
                <Route path="proposal-templates/new" element={<ProposalTemplateEditor />} />
                <Route path="proposal-templates/:id/edit" element={<ProposalTemplateEditor />} />
                <Route path="custom-fields" element={<CustomFields />} />
                <Route path="custom-forms" element={<CustomForms />} />
                <Route path="permissions" element={<PermissionSettings />} />
                <Route path="sales-config" element={<SalesConfigPage />} />
                <Route path="seller-targets" element={<SellerTargetsPage />} />
              </Route>
              <Route path="/app/release-notes" element={<ProtectedRoute><LazyRoute><ReleaseNotes /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/ai-operations" element={<ProtectedRoute><LazyRoute><AIOperations /></LazyRoute></ProtectedRoute>} />
              
              {/* GTM Routes - Revenue Operating System */}
              <Route path="/app/gtm/sdr" element={<ProtectedRoute><LazyRoute><SDRCommandCenter /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/gtm/ae" element={<ProtectedRoute><LazyRoute><AEDashboard /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/gtm/cs" element={<ProtectedRoute><LazyRoute><CSDashboard /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/gtm/revops" element={<ProtectedRoute><LazyRoute><RevOpsCockpit /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/gtm/manager" element={<ProtectedRoute><LazyRoute><ManagerDashboard /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/gtm/ceo" element={<ProtectedRoute><LazyRoute><CEODashboard /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/gtm/playbooks" element={<ProtectedRoute><LazyRoute><PlaybookBoard /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/gtm/playbooks/leaderboard" element={<ProtectedRoute><LazyRoute><PlaybookLeaderboard /></LazyRoute></ProtectedRoute>} />
              
              {/* Intelligence Routes */}
              <Route path="/app/intelligence/winloss" element={<ProtectedRoute><LazyRoute><WinLossHub /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/intelligence/graph" element={<ProtectedRoute><LazyRoute><KnowledgeGraph /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/intelligence/memories" element={<ProtectedRoute><LazyRoute><Memories /></LazyRoute></ProtectedRoute>} />
              
{/* Admin Panel Routes */}
              <Route path="/admin/login" element={<LazyRoute><AdminLogin /></LazyRoute>} />
              <Route path="/admin" element={<LazyRoute><AdminLayout /></LazyRoute>}>
                <Route index element={<CommandCenter />} />
                <Route path="organizations" element={<AdminOrganizations />} />
                <Route path="organizations/:id" element={<OrganizationDetail />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="revenue" element={<RevenueBilling />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="logs" element={<AdminLogs />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="ai" element={<AdminAIControl />} />
                <Route path="infrastructure" element={<AdminInfrastructure />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="control-room" element={<ControlRoom />} />
                <Route path="trace/:traceId" element={<TraceViewer />} />
              </Route>
              
              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
