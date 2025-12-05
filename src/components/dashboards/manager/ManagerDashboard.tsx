import { useManagerDashboard } from "@/hooks/useManagerDashboard";
import { ManagerKPICards } from "./ManagerKPICards";
import { TeamRankingTable } from "./TeamRankingTable";
import { TeamFunnelChart } from "./TeamFunnelChart";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { LossReasonsChart } from "./LossReasonsChart";
import { PipelineAgingChart } from "./PipelineAgingChart";
import { LeadsByOriginChart } from "./LeadsByOriginChart";
import { ManagerSmartLists } from "./ManagerSmartLists";
import { BehaviorMonitor } from "./BehaviorMonitor";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, BarChart3, Users, Brain } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ManagerDashboard() {
  const { data, isLoading, error } = useManagerDashboard();

  if (isLoading) {
    return <ManagerDashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar dashboard: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard do Gerente</h1>
        <p className="text-muted-foreground">
          Performance do time, previsibilidade e coaching
        </p>
      </div>

      {/* KPI Cards */}
      <ManagerKPICards data={data} />

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-2">
            <Brain className="h-4 w-4" />
            Coaching IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TeamFunnelChart data={data.teamFunnel} />
            <LossReasonsChart data={data.lossReasons} />
            <PipelineAgingChart data={data.pipelineAging} />
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TeamRankingTable members={data.teamMembers} />
            <LeadsByOriginChart data={data.leadsByOrigin} />
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {/* Activity Heatmap */}
          <ActivityHeatmap data={data.activityHeatmap} />

          {/* Behavior Monitor */}
          <BehaviorMonitor data={data.behaviorMonitor} />
        </TabsContent>

        <TabsContent value="coaching" className="space-y-4">
          {/* Smart Lists */}
          <ManagerSmartLists data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ManagerDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      
      <Skeleton className="h-10 w-96" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    </div>
  );
}
