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
  // Always fetch seller_role so SDR/BDR/Hunter/AE/Closer/CS get GTM dashboards
  // even when their permission_set defaults to RepDashboard.
  const { sellerRole, isLoading: sellerLoading } = useSellerRole(true);

  const loading = userLoading || permLoading || sellerLoading;

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
   * Priority 0: Owner/Admin permission_set ALWAYS wins — executives keep their
   *             executive dashboard even when also flagged as SDR/AE in `sellers`.
   * Priority 1: seller_role (SDR/BDR/Hunter → SDRCommandCenter; AE/Closer → AEDashboard; CS → CSEngine)
   * Priority 2: defaultDashboard from permission_set (Manager/CS/Finance/Rep)
   * Priority 3: GTM dashboards explicitly set via defaultDashboard
   */

  const renderDashboard = () => {
    const role = sellerRole as SellerRole;
    const isExecutive =
      defaultDashboard === 'OwnerDashboard' || defaultDashboard === 'AdminDashboard';

    // Priority 1: seller_role drives GTM routing for sales/CS personas
    // (skipped for Owner/Admin so executives keep the executive dashboard)
    if (!isExecutive) {
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
      }
    }


    // Priority 2: defaultDashboard maps to a direct component
    if (DASHBOARD_COMPONENTS[defaultDashboard]) {
      const DashboardComponent = DASHBOARD_COMPONENTS[defaultDashboard];
      return <DashboardComponent />;
    }

    // Priority 3: lazy-loaded GTM dashboards via defaultDashboard
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

    return <RepDashboard />;
  };


  return (
    <Layout>
      <DynamicDashboardRuntimeGate legacyDashboard={renderDashboard()} />
    </Layout>
  );
}
