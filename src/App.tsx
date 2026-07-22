import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import React, { Suspense, lazy } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
// useRealtimeContacts moved to page-scope (Contacts page) — see Fase 1A audit
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingPage } from "@/components/LoadingPage";
import { TrialGuard } from "@/components/trial/TrialGuard";
import { UpdateBanner } from "@/components/UpdateBanner";
import { setupGlobalChunkErrorHandlers, clearRecoveryAttempts } from "@/lib/chunkErrorRecovery";
import { AuthDebugPanel } from "@/components/system/AuthDebugPanel";


// Setup global chunk error handlers immediately
setupGlobalChunkErrorHandlers();

// Clear recovery attempts on successful app load
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    clearRecoveryAttempts();
  });
}

// Analytics Tracking
import { PostHogProvider } from "@/components/PostHogProvider";

// Public routes - loaded immediately
import Index from "./pages/Index";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import AcceptInvitation from "./pages/AcceptInvitation";
import ProposalPublicView from "./pages/ProposalPublicView";
import PublicFormView from "./pages/PublicFormView";
import NotFoundPage from "./pages/NotFoundPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DocsPublic from "./pages/DocsPublic";
import ScheduleDemo from "./pages/ScheduleDemo";
import AuthStatus from "./pages/AuthStatus";

// Protected routes - lazy loaded
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DynamicDashboardPage = lazy(() => import("./pages/DynamicDashboardPage"));
const Leads = lazy(() => import("./pages/Leads"));
const Opportunities = lazy(() => import("./pages/Opportunities"));
const Activities = lazy(() => import("./pages/Activities"));
const Proposals = lazy(() => import("./pages/Proposals"));
const Products = lazy(() => import("./pages/Products"));
const ProductEditorPage = lazy(() => import("./pages/ProductEditorPage"));
const Accounts = lazy(() => import("./pages/Accounts"));
const AccountDetail = lazy(() => import("./pages/AccountDetail"));
const AccountEditor = lazy(() => import("./pages/AccountEditor"));
const OpportunityDetail = lazy(() => import("./pages/OpportunityDetail"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Contracts = lazy(() => import("./pages/Contracts"));
// Inventory operacional removido do menu — reposicionado em Configurações > Propostas > Inventário Eventrix (Sprint NOID-INV-CONNECT 0.1)
// const Inventory = lazy(() => import("./pages/operations/Inventory"));
const Sequences = lazy(() => import("./pages/Sequences"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const SettingsPageV3 = lazy(() => import("./pages/settings/SettingsPageV3"));
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout"));
const ProfileSettings = lazy(() => import("./pages/settings/ProfileSettings"));
const SecuritySettings = lazy(() => import("./pages/settings/SecuritySettings"));
const OrganizationSettings = lazy(() => import("./pages/settings/OrganizationSettings"));
const BillingOverview = lazy(() => import("./pages/settings/billing/BillingOverview"));
const BillingInvoices = lazy(() => import("./pages/settings/billing/BillingInvoices"));
const BillingPaymentMethod = lazy(() => import("./pages/settings/billing/BillingPaymentMethod"));
const BillingContract = lazy(() => import("./pages/settings/billing/BillingContract"));
const AccountSettings = lazy(() => import("./pages/settings/Account"));
const NotificationPreferences = lazy(() => import("./pages/settings/NotificationPreferences"));
// System Settings Pages - Individual routes
const CelebracoesSettingsPage = lazy(() => import("./pages/settings/system/CelebracoesSettingsPage"));
const ForecastSettingsPage = lazy(() => import("./pages/settings/system/ForecastSettingsPage"));
const PricingFactorRulesPage = lazy(() => import("./pages/settings/system/PricingFactorRulesPage"));
const DadosSettingsPage = lazy(() => import("./pages/settings/system/DadosSettingsPage"));
const ExportacoesSettingsPage = lazy(() => import("./pages/settings/system/ExportacoesSettingsPage"));
const OportunidadesCartoesSettingsPage = lazy(() => import("./pages/settings/system/OportunidadesCartoesSettingsPage"));
const RelatoriosSettingsPage = lazy(() => import("./pages/settings/system/RelatoriosSettingsPage"));
const ReportsV2FlagsSettingsPage = lazy(() => import("./pages/settings/system/ReportsV2FlagsSettingsPage"));
const ReportsHealthAdminPage = lazy(() => import("./pages/settings/system/ReportsHealthAdminPage"));
const PriceAuditPage = lazy(() => import("./pages/settings/system/PriceAuditPage"));
const UsersSettings = lazy(() => import("./pages/settings/Users"));
const EditUser = lazy(() => import("./pages/settings/EditUser"));
const TeamsSettings = lazy(() => import("./pages/settings/Teams"));
const TeamsAndUsers = lazy(() => import("./pages/settings/TeamsAndUsers"));
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
const ApiKeysSettings = lazy(() => import("./pages/settings/ApiKeysSettings"));
const DataManagement = lazy(() => import("./pages/settings/DataManagement"));
const ProductCategories = lazy(() => import("./pages/settings/ProductCategories"));
const ProductSettingsPage = lazy(() => import("./pages/settings/ProductSettings"));
const Origins = lazy(() => import("./pages/settings/Origins"));
const WinLossReasons = lazy(() => import("./pages/settings/WinLossReasons"));
const ProposalLayouts = lazy(() => import("./pages/settings/ProposalLayouts"));
const ProposalSettings = lazy(() => import("./pages/settings/ProposalSettings"));
const EventrixInventorySettings = lazy(() => import("./pages/settings/EventrixInventorySettings"));
const InventoryProviderSettingsPage = lazy(() => import("./pages/settings/InventoryProviderSettingsPage"));
const NoidInventoryBackupPage = lazy(() => import("./pages/settings/NoidInventoryBackupPage"));
const ProposalTemplateEditor = lazy(() => import("./pages/settings/ProposalTemplateEditor"));
const ReleaseNotes = lazy(() => import("./pages/ReleaseNotes"));
const NotificationsHistory = lazy(() => import("./pages/NotificationsHistory"));
const Docs = lazy(() => import("./pages/Docs"));
const Support = lazy(() => import("./pages/Support"));
const ProposalEditor = lazy(() => import("./pages/ProposalEditor"));
const CustomFields = lazy(() => import("./pages/settings/CustomFields"));
const CustomForms = lazy(() => import("./pages/settings/CustomForms"));
const QualificationFrameworkPage = lazy(() => import("./pages/settings/QualificationFrameworkPage"));
const TagsManagement = lazy(() => import("./pages/settings/TagsManagement"));
const PermissionSettings = lazy(() => import("./pages/settings/PermissionSettings"));
const Industries = lazy(() => import("./pages/settings/Industries"));
const AIOperations = lazy(() => import("./pages/AIOperations"));
const SalesConfigPage = lazy(() => import("./pages/settings/SalesConfigPage"));
const SellerTargetsPage = lazy(() => import("./pages/settings/SellerTargetsPage"));
const SalesSettings = lazy(() => import("./pages/settings/SalesSettings"));
const Community = lazy(() => import("./pages/Community"));
const Trash = lazy(() => import("./pages/Trash"));
const NoidIntelligenceHub = lazy(() => import("./pages/settings/noid-intelligence/NoidIntelligenceHub"));
const AgentsList = lazy(() => import("./pages/settings/noid-intelligence/AgentsList"));
const CreateAgent = lazy(() => import("./pages/settings/noid-intelligence/CreateAgent"));
const AgentDetail = lazy(() => import("./pages/settings/noid-intelligence/AgentDetail"));
const NoidPlaceholder = lazy(() => import("./pages/settings/noid-intelligence/PlaceholderPage"));
const NoidPermissions = lazy(() => import("./pages/settings/noid-intelligence/PermissionsPage"));
const NoidEnvironments = lazy(() => import("./pages/settings/noid-intelligence/EnvironmentsPage"));
const McpRegistryPage = lazy(() => import("./pages/settings/noid-intelligence/McpRegistryPage"));
const AgentBuilderPage = lazy(() => import("./pages/settings/noid-intelligence/AgentBuilderPage"));
const AgentSimulatorPage = lazy(() => import("./pages/settings/noid-intelligence/AgentSimulatorPage"));
const ApprovalsPage = lazy(() => import("./pages/settings/noid-intelligence/ApprovalsPage"));
const RunDetailPage = lazy(() => import("./pages/settings/noid-intelligence/RunDetailPage"));
const EmailAgentMetricsPage = lazy(() => import("./pages/settings/noid-intelligence/EmailAgentMetricsPage"));
const AgentOutcomesPage = lazy(() => import("./pages/settings/noid-intelligence/AgentOutcomesPage"));
const DecisionRulesPage = lazy(() => import("./pages/settings/noid-intelligence/DecisionRulesPage"));
const LearningPerformancePage = lazy(() => import("./pages/settings/noid-intelligence/LearningPerformancePage"));
const HeadlessHumanoidLabPage = lazy(() => import("./pages/settings/noid-intelligence/HeadlessHumanoidLabPage"));
const SkillsLibraryPage = lazy(() => import("./pages/intelligence/skills/SkillsLibraryPage"));
const SkillDetailPage = lazy(() => import("./pages/intelligence/skills/SkillDetailPage"));
const SkillPlaygroundPage = lazy(() => import("./pages/intelligence/skills/SkillPlaygroundPage"));

// GTM Routes - Revenue Operating System
const SDRCommandCenter = lazy(() => import("./pages/gtm/SDRCommandCenter"));
const AEDashboard = lazy(() => import("./pages/gtm/AEDashboard"));
const CSDashboard = lazy(() => import("./pages/gtm/CSDashboard"));
const RevOpsCockpit = lazy(() => import("./pages/gtm/RevOpsCockpit"));
const ManagerDashboard = lazy(() => import("./pages/gtm/ManagerDashboard"));
const CEODashboard = lazy(() => import("./pages/gtm/CEODashboard"));
const PlaybooksHub = lazy(() => import("./pages/intelligence/PlaybooksHub"));
const KairosHub = lazy(() => import("./pages/intelligence/KairosHub"));
const ApolloRoi = lazy(() => import("./pages/intelligence/ApolloRoi"));
const OptimizationHub = lazy(() => import("./pages/intelligence/OptimizationHub"));
const ExperimentsHub = lazy(() => import("./pages/intelligence/ExperimentsHub"));
const WinLossHub = lazy(() => import("./pages/intelligence/WinLossHub"));
const VibeSelling = lazy(() => import("./pages/intelligence/VibeSelling"));
const KnowledgeGraph = lazy(() => import("./pages/app/intelligence/KnowledgeGraph"));
const Memories = lazy(() => import("./pages/app/intelligence/Memories"));
const OTEReport = lazy(() => import("./pages/OTEReport"));
const DesempenhoPage = lazy(() => import("./pages/DesempenhoPage"));
const RevenueCommandPage = lazy(() => import("./pages/RevenueCommandPage"));
const MigrationAuditPage = lazy(() => import("./pages/MigrationAuditPage"));

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
const AdminTrash = lazy(() => import("./pages/admin/AdminTrash"));
const BackupSettings = lazy(() => import("./pages/admin/BackupSettings"));
const AdminPlans = lazy(() => import("./pages/admin/Plans"));
const PLGScoreConfig = lazy(() => import("./pages/admin/PLGScoreConfig"));
const RevenueIntegrity = lazy(() => import("./pages/admin/RevenueIntegrity"));
const HoneypotDashboard = lazy(() => import("./pages/admin/HoneypotDashboard"));
const UserActivityReport = lazy(() => import("./pages/admin/UserActivityReport"));
const ForensicExport = lazy(() => import("./pages/admin/ForensicExport"));

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
  const queryClient = useQueryClient();
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const {
    user,
    membership,
    isOrgAdmin,
    isOwner,
    loading: userLoading,
    isAuthenticated,
    hasSession,
    sessionChecked,
    error: userError,
  } = useCurrentUser();
  const { onboardingCompleted, status, loading: onboardingLoading, hasActiveMembership } = useOnboardingStatus(user?.id);

  React.useEffect(() => {
    if (userLoading || onboardingLoading) {
      const timer = setTimeout(() => setLoadingTimeout(true), 25000);
      return () => clearTimeout(timer);
    }

    setLoadingTimeout(false);
    return undefined;
  }, [userLoading, onboardingLoading]);

  const retryProfile = React.useCallback(() => {
    setLoadingTimeout(false);
    queryClient.invalidateQueries({ queryKey: ['current-user'] });
  }, [queryClient]);

  // AUTH.1.2: nunca redirecionar para /login antes de o boot da sessão terminar.
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Restaurando sessão...</p>
        </div>
      </div>
    );
  }

  // Boot pronto e SEM sessão Supabase → único caminho válido para /login.
  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-destructive text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold">Tempo esgotado</h2>
          <p className="text-muted-foreground">
            O carregamento está demorando mais do que o esperado. Verifique sua conexão com a internet.
          </p>
          <button
            onClick={retryProfile}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Erro carregando perfil mas sessão segue válida → oferecer retry, NÃO deslogar.
  if (userError && !userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-destructive text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold">Erro ao carregar dados</h2>
          <p className="text-muted-foreground">Ocorreu um erro ao carregar seus dados. Por favor, tente novamente.</p>
          <button
            onClick={retryProfile}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Tentar novamente
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
            {userLoading ? "Carregando perfil..." : "Verificando onboarding..."}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.id) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // **LÓGICA DE ONBOARDING CORRIGIDA**
  // Determinar se o usuário tem organização
  const hasOrganization = !!membership || !!hasActiveMembership;
  
  // Usuário precisa de onboarding se:
  // 1. Não tem organização (precisa criar uma)
  // 2. OU tem organização mas não completou onboarding E é owner/admin
  const needsOnboarding = !hasOrganization || (!onboardingCompleted && (isOwner || isOrgAdmin));
  
  // Se precisa de onboarding e não está na página de onboarding, redirecionar
  if (needsOnboarding && !hasOrganization && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  
  // Se não precisa de onboarding e está tentando acessar página de onboarding, redirecionar para dashboard
  if (hasOrganization && onboardingCompleted && location.pathname === "/onboarding") {
    return <Navigate to="/app/dashboard" replace />;
  }

  // Wrap content with TrialGuard for trial blocking
  return <TrialGuard><GlobalRealtimeListeners />{children}</TrialGuard>;
}

// Global realtime subscriptions removed — page-scoped only (see Contacts/Prospect pages).
function GlobalRealtimeListeners() {
  return null;
}


// Suspense wrapper for lazy routes
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingPage message="Carregando módulo..." />}>
      <ErrorBoundary section="módulo">{children}</ErrorBoundary>
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
          <UpdateBanner />
          
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PostHogProvider />
            <AuthDebugPanel />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/status/auth" element={<AuthStatus />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/accept-invitation/:token" element={<AcceptInvitation />} />
              <Route path="/public/proposal/:token" element={<ProposalPublicView />} />
              <Route path="/p/:token" element={<ProposalPublicView />} />
              <Route path="/f/:token" element={<PublicFormView />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/agendar-demo" element={<ScheduleDemo />} />
              <Route path="/docs" element={<DocsPublic />} />
              <Route path="/docs/:category" element={<DocsPublic />} />
              <Route path="/docs/:category/:slug" element={<DocsPublic />} />

              {/* Protected Routes - Lazy Loaded */}
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Dashboard />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/dashboard"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Dashboard />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/dynamic-dashboard"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <DynamicDashboardPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/leads"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Leads />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/opportunities"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Opportunities />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/opportunities/:id"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <OpportunityDetail />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/activities"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Activities />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/proposals"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Proposals />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/proposals/new"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ProposalEditor />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/proposals/:id/edit"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ProposalEditor />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/products"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Products />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/products/new"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ProductEditorPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/products/:id/edit"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ProductEditorPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/accounts"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Accounts />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/accounts/:id"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <AccountDetail />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/accounts/:id/edit"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <AccountEditor />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/contracts"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Contracts />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/operations/inventory"
                element={<Navigate to="/app/settings/eventrix-inventory" replace />}
              />
              <Route
                path="/app/operations/inventory/*"
                element={<Navigate to="/app/settings/eventrix-inventory" replace />}
              />
              <Route
                path="/app/forecast"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Forecast />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/email-templates"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <EmailTemplates />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/territories"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Territories />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/automation"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <AutomationAndSequences />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/reports"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Reports />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/reports/ote"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <OTEReport />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/objetivos/desempenho"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <DesempenhoPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/revenue-command"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <RevenueCommandPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/revenue-command/migration-audit"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <MigrationAuditPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/sales"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <SalesSettings />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/insights"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Insights />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/scoring"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Scoring />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/docs"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Docs />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/docs/:category"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Docs />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/docs/:category/:slug"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Docs />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/support"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Support />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/support/tickets/:ticketId"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Support />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/community"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Community />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/trash"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Trash />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/intelligence/vibe"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <VibeSelling />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/app/roleplay"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Roleplay />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/roleplay/new"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <NewRoleplay />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/roleplay/chat/:sessionId"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ChatView />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/roleplay/summary/:sessionId"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <SessionSummary />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/roleplay/sessions"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <MySessions />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/roleplay/ranking"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Ranking />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/roleplay/videos"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <VideoLibrary />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/roleplay/reports"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <RoleplayReports />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/roleplay/admin"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <RoleplayAdmin />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              {/* Settings V3 - Main Hub */}
              <Route
                path="/app/settings"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <SettingsPageV3 />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />

              {/* Settings Internal Pages with Layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <SettingsLayout />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              >
                <Route path="/app/settings/profile" element={<ProfileSettings />} />
                <Route path="/app/settings/security" element={<SecuritySettings />} />
                <Route path="/app/settings/organization" element={<OrganizationSettings />} />
                <Route path="/app/settings/billing" element={<BillingOverview />} />
                <Route path="/app/settings/billing/invoices" element={<BillingInvoices />} />
                <Route path="/app/settings/billing/payment" element={<BillingPaymentMethod />} />
                <Route path="/app/settings/billing/contract" element={<BillingContract />} />
                <Route path="/app/settings/account" element={<AccountSettings />} />
                <Route path="/app/settings/users" element={<UsersSettings />} />
                <Route path="/app/settings/users/:userId/edit" element={<EditUser />} />
                <Route path="/app/settings/teams" element={<TeamsSettings />} />
                <Route path="/app/settings/teams-users" element={<TeamsAndUsers />} />
                <Route path="/app/settings/pipelines" element={<PipelineSettings />} />
                <Route path="/app/settings/business-units" element={<BusinessUnits />} />
                <Route path="/app/settings/integrations" element={<Integrations />} />
                <Route path="/app/settings/api-keys" element={<ApiKeysSettings />} />
                <Route path="/app/settings/data-management" element={<DataManagement />} />
                <Route path="/app/settings/product-categories" element={<ProductCategories />} />
                <Route path="/app/settings/product-settings" element={<ProductSettingsPage />} />
                <Route path="/app/settings/origins" element={<Origins />} />
                <Route path="/app/settings/industries" element={<Industries />} />
                <Route path="/app/settings/win-loss-reasons" element={<WinLossReasons />} />
                <Route path="/app/settings/loss-reasons" element={<WinLossReasons />} />
                <Route path="/app/settings/proposal-layouts" element={<ProposalLayouts />} />
                <Route path="/app/settings/proposal-settings" element={<ProposalSettings />} />
                <Route path="/app/settings/eventrix-inventory" element={<EventrixInventorySettings />} />
                <Route path="/app/settings/noid-inventory-backup" element={<NoidInventoryBackupPage />} />
                <Route path="/app/settings/proposal-templates" element={<ProposalLayouts />} />
                <Route path="/app/settings/proposal-templates/new" element={<ProposalTemplateEditor />} />
                <Route path="/app/settings/proposal-templates/:id/edit" element={<ProposalTemplateEditor />} />
                <Route path="/app/settings/custom-fields" element={<CustomFields />} />
                <Route path="/app/settings/custom-forms" element={<CustomForms />} />
                <Route path="/app/settings/qualification" element={<QualificationFrameworkPage />} />
                <Route path="/app/settings/tags" element={<TagsManagement />} />
                <Route path="/app/settings/permissions" element={<PermissionSettings />} />
                <Route path="/app/settings/sales-config" element={<SalesConfigPage />} />
                <Route path="/app/settings/notifications" element={<NotificationPreferences />} />
                <Route path="/app/settings/seller-targets" element={<SellerTargetsPage />} />
                {/* NOID Intelligence */}
                <Route path="/app/settings/noid-intelligence" element={<NoidIntelligenceHub />} />
                <Route path="/app/settings/noid-intelligence/agents" element={<AgentsList />} />
                <Route path="/app/settings/noid-intelligence/agents/new" element={<CreateAgent />} />
                <Route path="/app/settings/noid-intelligence/agents/:id" element={<AgentDetail />} />
                <Route path="/app/settings/noid-intelligence/agents/:id/builder" element={<AgentBuilderPage />} />
                <Route path="/app/settings/noid-intelligence/agents/:id/simulator" element={<AgentSimulatorPage />} />
                <Route path="/app/settings/noid-intelligence/agents/:id/outcomes" element={<AgentOutcomesPage />} />
                <Route path="/app/settings/noid-intelligence/orchestrations" element={<NoidPlaceholder title="Orquestrações" description="Coordene múltiplos agentes para resolver problemas complexos em conjunto." />} />
                <Route path="/app/settings/noid-intelligence/approvals" element={<ApprovalsPage />} />
                <Route path="/app/settings/noid-intelligence/runs/:runId" element={<RunDetailPage />} />
                <Route path="/app/settings/noid-intelligence/logs" element={<NoidPlaceholder title="Logs" description="Acompanhe o histórico completo de execuções dos agentes." />} />
                <Route path="/app/settings/noid-intelligence/metrics" element={<EmailAgentMetricsPage />} />
                <Route path="/app/settings/noid-intelligence/tools" element={<NoidPlaceholder title="Ferramentas" description="Configure as tools e actions disponíveis para os agentes." />} />
                <Route path="/app/settings/noid-intelligence/memories" element={<NoidPlaceholder title="Memórias" description="Gerencie o conhecimento persistente dos agentes." />} />
                <Route path="/app/settings/noid-intelligence/environments" element={<NoidEnvironments />} />
                <Route path="/app/settings/noid-intelligence/permissions" element={<NoidPermissions />} />
                <Route path="/app/settings/noid-intelligence/mcp-registry" element={<McpRegistryPage />} />
                <Route path="/app/settings/noid-intelligence/decision-rules" element={<DecisionRulesPage />} />
                <Route path="/app/settings/noid-intelligence/learning" element={<LearningPerformancePage />} />
                <Route path="/app/settings/noid-intelligence/hh-lab" element={<HeadlessHumanoidLabPage />} />
              </Route>

              {/* NOID Skills Engine */}
              <Route path="/app/intelligence/skills" element={<ProtectedRoute><LazyRoute><SkillsLibraryPage /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/intelligence/skills/:id" element={<ProtectedRoute><LazyRoute><SkillDetailPage /></LazyRoute></ProtectedRoute>} />
              <Route path="/app/intelligence/skills/:id/playground" element={<ProtectedRoute><LazyRoute><SkillPlaygroundPage /></LazyRoute></ProtectedRoute>} />


              {/* Individual System Settings Pages */}
              <Route
                path="/app/settings/celebracoes"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <CelebracoesSettingsPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/forecast"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ForecastSettingsPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/pricing-factor-rules"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <PricingFactorRulesPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/dados"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <DadosSettingsPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/exportacoes"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ExportacoesSettingsPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/oportunidades-cartoes"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <OportunidadesCartoesSettingsPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/relatorios"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <RelatoriosSettingsPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/reports-v2-flags"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ReportsV2FlagsSettingsPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/reports-health"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ReportsHealthAdminPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/settings/auditoria-financeira-propostas"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <PriceAuditPage />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/app/release-notes"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ReleaseNotes />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/notifications"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <NotificationsHistory />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/ai-operations"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <AIOperations />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />

              {/* GTM Routes - Revenue Operating System */}
              <Route
                path="/app/gtm/sdr"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <SDRCommandCenter />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/gtm/ae"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <AEDashboard />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/gtm/cs"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <CSDashboard />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/gtm/revops"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <RevOpsCockpit />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/gtm/manager"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ManagerDashboard />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/gtm/ceo"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <CEODashboard />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/intelligence/playbooks"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <PlaybooksHub />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/intelligence/kairos"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <KairosHub />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/intelligence/optimization"
                element={<Navigate to="/app/intelligence/kairos?tab=optimization" replace />}
              />
              <Route
                path="/app/intelligence/experiments"
                element={<Navigate to="/app/intelligence/kairos?tab=experiments" replace />}
              />
              <Route
                path="/app/intelligence/apollo-roi"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <ApolloRoi />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />


              {/* Intelligence Routes */}
              <Route
                path="/app/intelligence/winloss"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <WinLossHub />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/intelligence/graph"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <KnowledgeGraph />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/app/intelligence/memories"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <Memories />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />

              {/* Admin Panel Routes */}
              <Route
                path="/admin/login"
                element={
                  <LazyRoute>
                    <AdminLogin />
                  </LazyRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <LazyRoute>
                    <AdminLayout />
                  </LazyRoute>
                }
              >
                <Route index element={<CommandCenter />} />
                <Route path="organizations" element={<AdminOrganizations />} />
                <Route path="organizations/:id" element={<OrganizationDetail />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/activity" element={<UserActivityReport />} />
                <Route path="forensic" element={<ForensicExport />} />
                <Route path="revenue" element={<RevenueBilling />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="logs" element={<AdminLogs />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="trash" element={<AdminTrash />} />
                <Route path="backup" element={<BackupSettings />} />
                <Route path="ai" element={<AdminAIControl />} />
                <Route path="infrastructure" element={<AdminInfrastructure />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="control-room" element={<ControlRoom />} />
                <Route path="trace/:traceId" element={<TraceViewer />} />
                <Route path="plans" element={<AdminPlans />} />
                <Route path="plg-score" element={<PLGScoreConfig />} />
                <Route path="revenue-integrity" element={<RevenueIntegrity />} />
              </Route>

              {/* Forensic Security Command Center - Tracking & Honeypots */}
              <Route
                path="/app/forensic-command-center"
                element={
                  <ProtectedRoute>
                    <LazyRoute>
                      <HoneypotDashboard />
                    </LazyRoute>
                  </ProtectedRoute>
                }
              />
              {/* teste */}
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
