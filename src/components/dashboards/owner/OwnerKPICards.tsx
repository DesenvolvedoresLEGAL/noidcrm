import { TrendingUp, Target, Receipt, Users, DollarSign, BarChart3, Activity, Percent } from "lucide-react";
import { KPICard } from "../shared/KPICard";
import { OwnerDashboardData } from "@/hooks/useOwnerDashboard";

interface OwnerKPICardsProps {
  data: OwnerDashboardData;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
};

export function OwnerKPICards({ data }: OwnerKPICardsProps) {
  const hasMRR = data.revenue.mrr > 0;
  
  return (
    <div className="space-y-4">
      {/* Primary Revenue KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Show MRR/ARR only if there's recurring revenue, otherwise show Closed Revenue */}
        {hasMRR ? (
          <KPICard
            title="MRR / ARR"
            value={formatCurrency(data.revenue.arr)}
            subtitle={`MRR: ${formatCurrency(data.revenue.mrr)}`}
            icon={TrendingUp}
            iconColor="text-green-500"
            variant="success"
          />
        ) : (
          <KPICard
            title="Receita Fechada (Mês)"
            value={formatCurrency(data.revenue.closedRevenue)}
            subtitle="Vendas avulsas"
            icon={DollarSign}
            iconColor="text-green-500"
            variant="success"
            trend={{ 
              value: `${data.metrics.wonDealsCount} negócios`,
              isPositive: data.metrics.wonDealsCount > 0
            }}
          />
        )}

        <KPICard
          title="Meta Anual vs Run Rate"
          value={`${data.revenue.runRatePercentage.toFixed(0)}%`}
          subtitle={`Meta: ${formatCurrency(data.revenue.yearlyGoal)}`}
          icon={Target}
          iconColor={data.revenue.runRatePercentage >= 80 ? "text-green-500" : "text-yellow-500"}
          variant={data.revenue.runRatePercentage >= 80 ? "success" : "warning"}
          trend={{ 
            value: `Run Rate: ${formatCurrency(data.revenue.runRate)}`,
            isPositive: data.revenue.runRatePercentage >= 80
          }}
        />

        <KPICard
          title="Ticket Médio"
          value={formatCurrency(data.metrics.avgTicket)}
          subtitle={`${data.metrics.wonDealsCount} negócios fechados`}
          icon={Receipt}
          iconColor="text-blue-500"
          variant="primary"
        />

        <KPICard
          title="Taxa de Conversão"
          value={`${data.metrics.conversionRate.toFixed(0)}%`}
          subtitle="Won / Total Fechados"
          icon={Percent}
          iconColor={data.metrics.conversionRate >= 30 ? "text-green-500" : "text-orange-500"}
          variant={data.metrics.conversionRate >= 30 ? "success" : "warning"}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title="Pipeline Aberto"
          value={data.metrics.openDealsCount.toString()}
          subtitle="Oportunidades ativas"
          icon={Activity}
          iconColor="text-purple-500"
        />

        <KPICard
          title="Taxa Recompra"
          value={`${data.metrics.repurchaseRate.toFixed(0)}%`}
          subtitle="Clientes recorrentes"
          icon={Users}
          iconColor="text-cyan-500"
        />

        <KPICard
          title="NPS"
          value={data.metrics.nps > 0 ? data.metrics.nps.toString() : "N/A"}
          subtitle="Score de satisfação"
          icon={TrendingUp}
          iconColor={data.metrics.nps >= 50 ? "text-green-500" : "text-yellow-500"}
        />

        <KPICard
          title="ROI Time Comercial"
          value={`${data.teamROI.roi.toFixed(0)}%`}
          subtitle={`Receita: ${formatCurrency(data.teamROI.totalRevenue)}`}
          icon={Users}
          iconColor="text-indigo-500"
        />

        <KPICard
          title="Confiança Forecast"
          value={`${data.forecast.confidence}%`}
          subtitle="Baseado em dados reais"
          icon={BarChart3}
          iconColor={data.forecast.confidence >= 60 ? "text-green-500" : "text-amber-500"}
        />
      </div>
    </div>
  );
}
