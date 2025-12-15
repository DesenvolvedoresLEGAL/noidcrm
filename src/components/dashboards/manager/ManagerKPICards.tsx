import { KPICard } from "../shared/KPICard";
import { 
  Target, 
  Brain, 
  TrendingUp, 
  Users,
  DollarSign,
  BarChart3,
  Zap,
  Repeat
} from "lucide-react";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { formatCurrencyFull } from "@/lib/i18n";

interface ManagerKPICardsProps {
  data: ManagerDashboardData;
}

export function ManagerKPICards({ data }: ManagerKPICardsProps) {

  const hasOneTimeRevenue = data.teamRevenue.closedOneTime > 0;
  const hasMRRRevenue = data.teamRevenue.closedMRR > 0;
  const hasTotalMRR = data.teamRevenue.totalMRR > 0;

  return (
    <div className="space-y-4">
      {/* Primary KPIs - Goals and Revenue */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title="Meta da Equipe"
          value={`${data.teamGoal.percentage}%`}
          subtitle={`${formatCurrencyFull(data.teamGoal.achieved)} de ${formatCurrencyFull(data.teamGoal.goal)}`}
          icon={Target}
          variant={data.teamGoal.percentage >= 100 ? "success" : data.teamGoal.percentage >= 70 ? "warning" : "danger"}
        />

        {/* Receita Avulsa */}
        <KPICard
          title="Receita Avulsa"
          value={formatCurrencyFull(data.teamRevenue.closedOneTime)}
          subtitle="Vendas avulsas (mês)"
          icon={Zap}
          iconColor={hasOneTimeRevenue ? "text-amber-500" : "text-muted-foreground"}
          variant={hasOneTimeRevenue ? "success" : "default"}
          className={!hasOneTimeRevenue ? "opacity-60" : ""}
        />

        {/* Novo MRR */}
        <KPICard
          title="Novo MRR"
          value={`${formatCurrencyFull(data.teamRevenue.closedMRR)}/mês`}
          subtitle="Receita recorrente nova"
          icon={Repeat}
          iconColor={hasMRRRevenue ? "text-green-500" : "text-muted-foreground"}
          variant={hasMRRRevenue ? "success" : "default"}
          className={!hasMRRRevenue ? "opacity-60" : ""}
        />

        {/* MRR Total */}
        <KPICard
          title="MRR Total"
          value={`${formatCurrencyFull(data.teamRevenue.totalMRR)}/mês`}
          subtitle="Receita recorrente total"
          icon={TrendingUp}
          iconColor={hasTotalMRR ? "text-emerald-500" : "text-muted-foreground"}
          variant={hasTotalMRR ? "primary" : "default"}
          className={!hasTotalMRR ? "opacity-60" : ""}
        />
        
        <KPICard
          title="Forecast IA"
          value={`${data.forecastAI.probability}%`}
          subtitle={`Previsão: ${formatCurrencyFull(data.forecastAI.predictedValue)}`}
          icon={Brain}
          variant={data.forecastAI.probability >= 80 ? "success" : data.forecastAI.probability >= 60 ? "warning" : "danger"}
        />
      </div>

      {/* Secondary KPIs - Pipeline and Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Taxa de Conversão"
          value={`${data.teamConversionRate}%`}
          subtitle="Pipeline vendas"
          icon={BarChart3}
          variant={data.teamConversionRate >= 30 ? "success" : "default"}
        />
        
        <KPICard
          title="Opps Abertas"
          value={data.totalOpenOpportunities}
          subtitle="Pipeline vendas"
          icon={DollarSign}
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
          value={formatCurrencyFull(data.totalPipelineValue)}
          subtitle={`${data.totalOpenOpportunities} oportunidades`}
          icon={DollarSign}
          variant="primary"
        />
      </div>
    </div>
  );
}
