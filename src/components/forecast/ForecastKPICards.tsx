import { Target, CheckCircle2, TrendingUp, Rocket, BarChart3, Zap, Trophy, Calendar } from 'lucide-react';
import { KPICard } from '@/components/dashboards/shared/KPICard';
import { ForecastKPIs } from '@/hooks/useForecastData';

interface ForecastKPICardsProps {
  kpis: ForecastKPIs | null;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

export function ForecastKPICards({ kpis, isLoading }: ForecastKPICardsProps) {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Meta do Mês',
      value: formatCurrency(kpis.goal),
      icon: Target,
      variant: 'primary' as const,
    },
    {
      title: 'Fechado',
      value: formatCurrency(kpis.closedRevenue),
      subtitle: `${kpis.closedPercentage.toFixed(0)}% da meta`,
      icon: CheckCircle2,
      variant: kpis.closedPercentage >= 100 ? 'success' as const : kpis.closedPercentage >= 70 ? 'warning' as const : 'default' as const,
    },
    {
      title: 'Commit',
      value: formatCurrency(kpis.commitForecast),
      subtitle: `${kpis.commitPercentage.toFixed(0)}% da meta`,
      icon: TrendingUp,
      variant: kpis.commitPercentage >= 100 ? 'success' as const : kpis.commitPercentage >= 80 ? 'warning' as const : 'danger' as const,
    },
    {
      title: 'Best Case',
      value: formatCurrency(kpis.bestCaseForecast),
      subtitle: `${kpis.bestCasePercentage.toFixed(0)}% da meta`,
      icon: Rocket,
      variant: kpis.bestCasePercentage >= 100 ? 'success' as const : 'default' as const,
    },
    {
      title: 'Cobertura',
      value: `${kpis.pipelineCoverage.toFixed(1)}x`,
      subtitle: 'Pipeline / Meta',
      icon: BarChart3,
      variant: kpis.pipelineCoverage >= 3 ? 'success' as const : kpis.pipelineCoverage >= 2 ? 'warning' as const : 'danger' as const,
    },
    {
      title: 'Velocidade',
      value: formatCurrency(kpis.velocityPerDay),
      subtitle: 'por dia',
      icon: Zap,
      variant: 'default' as const,
    },
    {
      title: 'Win Rate',
      value: `${kpis.winRate.toFixed(0)}%`,
      subtitle: 'Histórico',
      icon: Trophy,
      variant: kpis.winRate >= 30 ? 'success' as const : kpis.winRate >= 20 ? 'warning' as const : 'danger' as const,
    },
    {
      title: 'Dias Restantes',
      value: kpis.daysRemaining.toString(),
      subtitle: 'no período',
      icon: Calendar,
      variant: kpis.daysRemaining <= 5 ? 'danger' as const : kpis.daysRemaining <= 10 ? 'warning' as const : 'default' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((card, i) => (
        <KPICard
          key={i}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          variant={card.variant}
          className="h-auto min-h-[100px]"
        />
      ))}
    </div>
  );
}
