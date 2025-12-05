import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminKPICards } from "./AdminKPICards";
import { AutomationFlowChart } from "./AutomationFlowChart";
import { FailureHistoryChart } from "./FailureHistoryChart";
import { VoltsConsumptionChart } from "./VoltsConsumptionChart";
import { LeadsByChannelChart } from "./LeadsByChannelChart";
import { SystemUsageChart } from "./SystemUsageChart";
import { AdminSmartLists } from "./AdminSmartLists";
import { AdminQuickLinks } from "./AdminQuickLinks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

export function AdminDashboard() {
  const { data, isLoading, error } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-lg font-medium">Erro ao carregar dashboard</p>
          <p className="text-sm text-muted-foreground">Tente novamente mais tarde</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard de Operações</h1>
        <p className="text-muted-foreground">
          Governança, qualidade dos dados e automações
        </p>
      </div>

      {/* KPI Cards */}
      <AdminKPICards data={data} />

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="automations">Automações</TabsTrigger>
          <TabsTrigger value="data-quality">Qualidade de Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Quick Links */}
          <AdminQuickLinks />

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AutomationFlowChart data={data.automationFlow} />
            <FailureHistoryChart data={data.failureHistory} />
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <VoltsConsumptionChart data={data.voltsUsage.byOperation} total={data.voltsUsage.total} />
            <LeadsByChannelChart data={data.leadsByChannel} />
            <SystemUsageChart data={data.systemUsage.byRole} totalUsers={data.systemUsage.totalUsers} />
          </div>
        </TabsContent>

        <TabsContent value="automations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AutomationFlowChart data={data.automationFlow} />
            <FailureHistoryChart data={data.failureHistory} />
          </div>
          
          {/* Automation execution stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {data.automations.byStatus.map((status, i) => (
              <div key={i} className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground capitalize">{status.status}</p>
                <p className="text-2xl font-bold">{status.count}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="data-quality" className="space-y-4">
          {/* Smart Lists */}
          <AdminSmartLists data={data} />

          {/* Additional Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LeadsByChannelChart data={data.leadsByChannel} />
            <SystemUsageChart data={data.systemUsage.byRole} totalUsers={data.systemUsage.totalUsers} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
