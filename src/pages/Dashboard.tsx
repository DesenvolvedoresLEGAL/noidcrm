import { Layout } from '@/components/Layout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSellerRole, SellerRole } from '@/hooks/useSellerRole';
import { usePermissions } from '@/hooks/usePermissions';
import { RepDashboard } from '@/components/dashboards/rep/RepDashboard';
import { ManagerDashboard } from '@/components/dashboards/manager/ManagerDashboard';
import { AdminDashboard } from '@/components/dashboards/admin/AdminDashboard';
import { OwnerDashboard } from '@/components/dashboards/owner/OwnerDashboard';
import { CSDashboard } from '@/components/dashboards/cs/CSDashboard';
import { FinanceDashboard } from '@/components/dashboards/finance/FinanceDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { lazy, Suspense } from 'react';
import { DynamicDashboardRuntimeGate } from '@/components/dashboard/runtime/DynamicDashboardRuntimeGate';

// Lazy load GTM dashboards (from pages/gtm)
const SDRCommandCenter = lazy(() => import('@/components/dashboards/sdr/SDRCommandCenterDashboard'));
const AEDashboard = lazy(() => import('@/pages/gtm/AEDashboard'));
const CSEngineDashboard = lazy(() => import('@/pages/gtm/CSDashboard'));

function DashboardLoader() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// Dashboard component map for dynamic rendering
const DASHBOARD_COMPONENTS: Record<string, React.ComponentType> = {
  OwnerDashboard,
  AdminDashboard,
  ManagerDashboard,
  RepDashboard,
  FinanceDashboard,
  CSDashboard,
};

export default function Dashboard() {
  const { loading: userLoading } = useCurrentUser();
  const { defaultDashboard, loading: permLoading } = usePermissions();
  const needsSellerRole = !permLoading && !DASHBOARD_COMPONENTS[defaultDashboard] && !['SDRCommandCenter', 'AEDashboard', 'CSEngineDashboard'].includes(defaultDashboard);
  const { sellerRole, isLoading: sellerLoading } = useSellerRole(needsSellerRole);

  const loading = userLoading || permLoading || (needsSellerRole && sellerLoading);

  if (loading) {
    return (
      <Layout>
        <DashboardLoader />
      </Layout>
    );
  }

  /**
   * Dashboard Routing Logic:
   * 
   * Priority 1: Use defaultDashboard from permission_set (configurable via Settings)
   * Priority 2: Fallback to seller_role based routing for lazy-loaded GTM dashboards
   */
  
  const renderDashboard = () => {
    // Check if defaultDashboard maps to a direct component
    if (DASHBOARD_COMPONENTS[defaultDashboard]) {
      const DashboardComponent = DASHBOARD_COMPONENTS[defaultDashboard];
      return <DashboardComponent />;
    }

    // Handle lazy-loaded GTM dashboards based on defaultDashboard
    switch (defaultDashboard) {
      case 'SDRCommandCenter':
        return (
          <Suspense fallback={<DashboardLoader />}>
            <SDRCommandCenter />
          </Suspense>
        );
      case 'AEDashboard':
        return (
          <Suspense fallback={<DashboardLoader />}>
            <AEDashboard />
          </Suspense>
        );
      case 'CSEngineDashboard':
        return (
          <Suspense fallback={<DashboardLoader />}>
            <CSEngineDashboard />
          </Suspense>
        );
    }

    // Fallback: seller_role based routing for GTM dashboards
    const role = sellerRole as SellerRole;
    
    switch (role) {
      case 'SDR':
      case 'BDR':
      case 'Hunter':
        return (
          <Suspense fallback={<DashboardLoader />}>
            <SDRCommandCenter />
          </Suspense>
        );
      case 'AE':
      case 'Closer':
        return (
          <Suspense fallback={<DashboardLoader />}>
            <AEDashboard />
          </Suspense>
        );
      case 'CS':
        return (
          <Suspense fallback={<DashboardLoader />}>
            <CSEngineDashboard />
          </Suspense>
        );
      case 'AM':
      case 'Farmer':
      default:
        return <RepDashboard />;
    }
  };

  return (
    <Layout>
      <DynamicDashboardRuntimeGate legacyDashboard={renderDashboard()} />
    </Layout>
  );
}
