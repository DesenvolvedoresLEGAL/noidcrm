import { useRepDashboard } from "@/hooks/useRepDashboard";
import { RepKPICards } from "./RepKPICards";
import { RepPipelineChart } from "./RepPipelineChart";
import { RepActivitiesChart } from "./RepActivitiesChart";
import { RepFunnelChart } from "./RepFunnelChart";
import { RepSmartLists } from "./RepSmartLists";
import { RepQuickActions } from "./RepQuickActions";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RepDashboard() {
  const { data, isLoading, error } = useRepDashboard();

  if (isLoading) {
    return <RepDashboardSkeleton />;
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
        <h1 className="text-2xl font-bold">Meu Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral das suas atividades e oportunidades
        </p>
      </div>

      {/* KPI Cards */}
      <RepKPICards data={data} />

      {/* Quick Actions */}
      <RepQuickActions />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RepPipelineChart data={data.pipelineByStage} />
        <RepActivitiesChart data={data.weeklyActivities} />
        <RepFunnelChart data={data.funnelConversion} />
      </div>

      {/* Smart Lists */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Listas Inteligentes</h2>
        <RepSmartLists data={data} />
      </div>
    </div>
  );
}

function RepDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      
      <Skeleton className="h-24" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}
