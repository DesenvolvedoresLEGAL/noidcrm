import { TrendingUp, Target, Receipt, Users, DollarSign, BarChart3, Activity, Percent, Zap, Repeat } from "lucide-react";
import { KPICard } from "../shared/KPICard";
import { OwnerDashboardData } from "@/hooks/useOwnerDashboard";
import { formatCurrencyFull } from "@/lib/i18n";

interface OwnerKPICardsProps {
  data: OwnerDashboardData;
}


export function OwnerKPICards({ data }: OwnerKPICardsProps) {
  const hasOneTimeRevenue = data.revenue.closedRevenueOneTime > 0;
  const hasMRRRevenue = data.revenue.closedRevenueMRR > 0;
  const hasTotalMRR = data.revenue.mrr > 0;
  
  return (
    <div className="space-y-4">
      {/* Primary Revenue KPIs - Always show both avulso and MRR */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receita Avulsa (One-time) */}
        <KPICard
          title="Receita Avulsa (Mês)"
          value={formatCurrencyFull(data.revenue.closedRevenueOneTime)}
          subtitle="Vendas avulsas"
          icon={Zap}
          iconColor={hasOneTimeRevenue ? "text-amber-500" : "text-muted-foreground"}
          variant={hasOneTimeRevenue ? "success" : "default"}
          trend={hasOneTimeRevenue ? { 
            value: `${data.metrics.wonDealsCount} negócios`,
            isPositive: true
          } : undefined}
          className={!hasOneTimeRevenue ? "opacity-60" : ""}
        />

        {/* Novo MRR Fechado (Mês) */}
        <KPICard
          title="Novo MRR (Mês)"
          value={`${formatCurrencyFull(data.revenue.closedRevenueMRR)}/mês`}
          subtitle="Receita recorrente nova"
          icon={Repeat}
          iconColor={hasMRRRevenue ? "text-green-500" : "text-muted-foreground"}
          variant={hasMRRRevenue ? "success" : "default"}
          trend={hasMRRRevenue ? { 
            value: `ARR: ${formatCurrencyFull(data.revenue.closedRevenueMRR * 12)}`,
            isPositive: true
          } : undefined}
          className={!hasMRRRevenue ? "opacity-60" : ""}
        />

        {/* MRR Total Acumulado */}
        <KPICard
          title="MRR Total"
          value={`${formatCurrencyFull(data.revenue.mrr)}/mês`}
          subtitle={`ARR: ${formatCurrencyFull(data.revenue.arr)}`}
          icon={TrendingUp}
          iconColor={hasTotalMRR ? "text-emerald-500" : "text-muted-foreground"}
          variant={hasTotalMRR ? "primary" : "default"}
          className={!hasTotalMRR ? "opacity-60" : ""}
        />

        {/* Meta vs Run Rate */}
        <KPICard
          title="Meta vs Run Rate"
          value={`${data.revenue.runRatePercentage.toFixed(0)}%`}
          subtitle={`Meta: ${formatCurrencyFull(data.revenue.yearlyGoal)}`}
          icon={Target}
          iconColor={data.revenue.runRatePercentage >= 80 ? "text-green-500" : "text-yellow-500"}
          variant={data.revenue.runRatePercentage >= 80 ? "success" : "warning"}
          trend={{ 
            value: `Run Rate: ${formatCurrencyFull(data.revenue.runRate)}`,
            isPositive: data.revenue.runRatePercentage >= 80
          }}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title="Ticket Médio"
          value={formatCurrencyFull(data.metrics.avgTicket)}
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
