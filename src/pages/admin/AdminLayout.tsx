import { Outlet, Navigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useCurrentOrganization } from "@/hooks/useCurrentOrganization";
import { Loader2 } from "lucide-react";

export default function AdminLayout() {
  const { profile, loading: profileLoading } = useUserProfile();
  const { userRole, loading: orgLoading } = useCurrentOrganization();

  if (profileLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Verificar se é super admin (owner ou admin)
  const isSuperAdmin = userRole === 'owner' || userRole === 'admin';

  if (!profile || !isSuperAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
