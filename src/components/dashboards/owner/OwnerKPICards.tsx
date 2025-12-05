import { TrendingUp, Target, Receipt, Users, Clock, DollarSign, RefreshCw, Star, BarChart3 } from "lucide-react";
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
  return (
    <div className="space-y-4">
      {/* Primary Revenue KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="MRR / ARR Projetado"
          value={formatCurrency(data.revenue.arr)}
          subtitle={`MRR: ${formatCurrency(data.revenue.mrr)}`}
          icon={TrendingUp}
          iconColor="text-green-500"
          variant="success"
          trend={{ 
            value: `Projetado: ${formatCurrency(data.forecast.realistic)}`,
            isPositive: data.forecast.realistic >= data.revenue.yearlyGoal 
          }}
        />

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
          subtitle="Por negócio fechado"
          icon={Receipt}
          iconColor="text-blue-500"
          variant="primary"
        />

        <KPICard
          title="LTV / CAC"
          value={`${data.metrics.ltvCacRatio}x`}
          subtitle={`LTV: ${formatCurrency(data.metrics.ltv)} | CAC: ${formatCurrency(data.metrics.cac)}`}
          icon={DollarSign}
          iconColor={data.metrics.ltvCacRatio >= 3 ? "text-green-500" : "text-orange-500"}
          variant={data.metrics.ltvCacRatio >= 3 ? "success" : "warning"}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title="Payback"
          value={`${data.metrics.paybackMonths} meses`}
          subtitle="Tempo de retorno"
          icon={Clock}
          iconColor="text-purple-500"
        />

        <KPICard
          title="Taxa Recompra"
          value={`${data.metrics.repurchaseRate.toFixed(0)}%`}
          subtitle="Upsell/Cross-sell"
          icon={RefreshCw}
          iconColor="text-cyan-500"
        />

        <KPICard
          title="NPS"
          value={data.metrics.nps.toString()}
          subtitle="Score de satisfação"
          icon={Star}
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
          title="Forecast Confiança"
          value={`${data.forecast.confidence}%`}
          subtitle="AI Confidence Score"
          icon={BarChart3}
          iconColor="text-amber-500"
        />
      </div>
    </div>
  );
}
