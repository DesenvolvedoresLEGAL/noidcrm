import { Layout } from '@/components/Layout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { RepDashboard } from '@/components/dashboards/rep/RepDashboard';
import { ManagerDashboard } from '@/components/dashboards/manager/ManagerDashboard';
import { AdminDashboard } from '@/components/dashboards/admin/AdminDashboard';
import { OwnerDashboard } from '@/components/dashboards/owner/OwnerDashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { membership, loading } = useCurrentUser();

  if (loading) {
    return (
      <Layout>
        <div className="p-4 md:p-8 space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </Layout>
    );
  }

  const orgRole = membership?.org_role;

  // Roteamento por role:
  // owner -> OwnerDashboard (CEO Cockpit)
  // admin -> AdminDashboard (Operações)
  // manager -> ManagerDashboard (Gerente Comercial)
  // sales/viewer/null -> RepDashboard (Vendedor)
  
  const renderDashboard = () => {
    switch (orgRole) {
      case 'owner':
        return <OwnerDashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'manager':
        return <ManagerDashboard />;
      case 'sales':
      case 'viewer':
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
