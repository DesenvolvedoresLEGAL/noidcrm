import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, AlertTriangle, Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAdminCenterProfile } from '@/hooks/dashboard/useDashboardResolver';
import { DynamicDashboardShell } from '@/components/dashboard/dynamic/DynamicDashboardShell';
import { AdminCenterExplainer } from './AdminCenterExplainer';
import { CloserDashboardAuditLog } from './CloserDashboardAuditLog';
import { PilotActivationLog } from './PilotActivationLog';
import { RuntimeAccessLog } from './RuntimeAccessLog';
import { CloserDashboardHealthPanel } from './closerDashboard/CloserDashboardHealthPanel';

export function AdminCenterPage() {
  const { organization, isOrgAdmin, loading: loadingUser } = useCurrentUser();
  const tenantId = organization?.id ?? null;

  const { data: profile, isLoading, error } = useAdminCenterProfile(tenantId);

  if (loadingUser) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOrgAdmin) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Apenas owners e administradores podem acessar o Admin Center.
        </AlertDescription>
      </Alert>
    );
  }

  if (!tenantId) return null;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Não foi possível carregar o Admin Center. As configurações atuais continuam funcionando.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Visão geral</TabsTrigger>
        <TabsTrigger value="closer">Dashboard Comercial</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            O <strong>Admin Center</strong> é uma área de gestão do CRM. O dashboard
            principal dos usuários continua sendo definido por função, área e contexto.
          </AlertDescription>
        </Alert>

        <AdminCenterExplainer />

        {!isLoading && !profile ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Admin Center ainda não foi configurado para esta organização.
            </AlertDescription>
          </Alert>
        ) : (
          <DynamicDashboardShell
            profile={profile ?? null}
            mode="admin_center"
            loading={isLoading}
          />
        )}

        <CloserDashboardAuditLog tenantId={tenantId} />
        <PilotActivationLog tenantId={tenantId} />
        <RuntimeAccessLog tenantId={tenantId} />
      </TabsContent>

      <TabsContent value="closer">
        <CloserDashboardHealthPanel tenantId={tenantId} />
      </TabsContent>
    </Tabs>
  );
}
