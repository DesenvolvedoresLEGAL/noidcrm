import { Layout } from '@/components/Layout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSellerRole, SellerRole } from '@/hooks/useSellerRole';
import { RepDashboard } from '@/components/dashboards/rep/RepDashboard';
import { ManagerDashboard } from '@/components/dashboards/manager/ManagerDashboard';
import { AdminDashboard } from '@/components/dashboards/admin/AdminDashboard';
import { OwnerDashboard } from '@/components/dashboards/owner/OwnerDashboard';
import { CSDashboard } from '@/components/dashboards/cs/CSDashboard';
import { FinanceDashboard } from '@/components/dashboards/finance/FinanceDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { lazy, Suspense } from 'react';

// Lazy load GTM dashboards (from pages/gtm)
const SDRCommandCenter = lazy(() => import('@/pages/gtm/SDRCommandCenter'));
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

export default function Dashboard() {
  const { membership, loading: userLoading } = useCurrentUser();
  const { sellerRole, isLoading: sellerLoading } = useSellerRole();

  const loading = userLoading || sellerLoading;

  if (loading) {
    return (
      <Layout>
        <DashboardLoader />
      </Layout>
    );
  }

  const orgRole = membership?.org_role;

  /**
   * Dashboard Routing Logic:
   * 
   * org_role based:
   * - owner → OwnerDashboard (CEO Cockpit)
   * - admin → AdminDashboard (Operações)
   * - manager → ManagerDashboard (Gerente Comercial)
   * - cs → CSDashboard (Customer Success)
   * 
   * seller_role based (for sales/viewer org_roles):
   * - SDR/BDR → SDRCommandCenter
   * - AE/Closer/Hunter → AEDashboard
   * - CS → CSEngineDashboard (GTM version)
   * - AM/Farmer → RepDashboard (gestão de carteira)
   * - null/default → RepDashboard
   */
  
  const renderDashboard = () => {
    // Priority 1: org_role based routing
    switch (orgRole) {
      case 'owner':
        return <OwnerDashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'manager':
        return <ManagerDashboard />;
      case 'finance':
        return <FinanceDashboard />;
      case 'cs':
        // CS org_role uses GTM CS Engine
        return (
          <Suspense fallback={<DashboardLoader />}>
            <CSEngineDashboard />
          </Suspense>
        );
    }

    // Priority 2: seller_role based routing (for sales/viewer org_roles)
    const role = sellerRole as SellerRole;
    
    switch (role) {
      case 'SDR':
      case 'BDR':
        return (
          <Suspense fallback={<DashboardLoader />}>
            <SDRCommandCenter />
          </Suspense>
        );
      case 'AE':
      case 'Closer':
      case 'Hunter':
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
      {renderDashboard()}
    </Layout>
  );
}
