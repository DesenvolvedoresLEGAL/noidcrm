import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import Index from "./pages/Index";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Opportunities from "./pages/Opportunities";
import Activities from "./pages/Activities";
import Proposals from "./pages/Proposals";
import Contracts from "./pages/Contracts";
import Sequences from "./pages/Sequences";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Insights from "./pages/Insights";
import Automation from "./pages/Automation";
import PipelineSettings from "./pages/PipelineSettings";
import NotFoundPage from "./pages/NotFoundPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseAuth();
  const { onboardingCompleted, loading: onboardingLoading } = useOnboardingStatus();

  if (loading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
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
          
          {/* Protected Routes */}
          <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/app/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/app/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
          <Route path="/app/opportunities" element={<ProtectedRoute><Opportunities /></ProtectedRoute>} />
          <Route path="/app/activities" element={<ProtectedRoute><Activities /></ProtectedRoute>} />
          <Route path="/app/proposals" element={<ProtectedRoute><Proposals /></ProtectedRoute>} />
          <Route path="/app/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
          <Route path="/app/sequences" element={<ProtectedRoute><Sequences /></ProtectedRoute>} />
          <Route path="/app/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/app/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/app/automation" element={<ProtectedRoute><Automation /></ProtectedRoute>} />
          <Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/app/settings/pipelines" element={<ProtectedRoute><PipelineSettings /></ProtectedRoute>} />
          
          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
