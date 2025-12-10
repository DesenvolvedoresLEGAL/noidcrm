import { KPICard } from "../shared/KPICard";
import { 
  Target, 
  Brain, 
  TrendingUp, 
  Users,
  DollarSign,
  BarChart3
} from "lucide-react";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";

interface ManagerKPICardsProps {
  data: ManagerDashboardData;
}

export function ManagerKPICards({ data }: ManagerKPICardsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        title="Meta da Equipe"
        value={`${data.teamGoal.percentage}%`}
        subtitle={`${formatCurrency(data.teamGoal.achieved)} de ${formatCurrency(data.teamGoal.goal)}`}
        icon={Target}
        variant={data.teamGoal.percentage >= 100 ? "success" : data.teamGoal.percentage >= 70 ? "warning" : "danger"}
      />
      
      <KPICard
        title="Forecast IA"
        value={`${data.forecastAI.probability}%`}
        subtitle={`Previsão: ${formatCurrency(data.forecastAI.predictedValue)}`}
        icon={Brain}
        variant={data.forecastAI.probability >= 80 ? "success" : data.forecastAI.probability >= 60 ? "warning" : "danger"}
      />
      
      <KPICard
        title="Taxa de Conversão"
        value={`${data.teamConversionRate}%`}
        subtitle="Pipeline vendas"
        icon={TrendingUp}
        variant={data.teamConversionRate >= 30 ? "success" : "default"}
      />
      
      <KPICard
        title="Opps Abertas"
        value={data.totalOpenOpportunities}
        subtitle="Pipeline vendas"
        icon={BarChart3}
        variant="primary"
      />
      
      <KPICard
        title="Ciclo Médio"
        value={`${data.avgCycleTime}d`}
        subtitle="Tempo até fechamento"
        icon={Users}
        variant="default"
      />
      
      <KPICard
        title="Pipeline Total"
        value={formatCurrency(data.totalPipelineValue)}
        subtitle={`${data.totalOpenOpportunities} oportunidades`}
        icon={DollarSign}
        variant="primary"
      />
    </div>
  );
}
