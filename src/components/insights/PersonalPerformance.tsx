import { useEffect, useState } from 'react';
import { Award, TrendingUp, Clock, DollarSign, Activity } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { Badge } from '@/components/ui/badge';
import { getPerformanceComparison, PerformanceData } from '@/services/crm/insights';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

export function PersonalPerformance() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPerformanceComparison().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const getBadgeColor = (badge: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-orange-700/20 text-orange-700 border-orange-700/30',
      silver: 'bg-gray-400/20 text-gray-400 border-gray-400/30',
      gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      platinum: 'bg-purple-500/20 text-purple-500 border-purple-500/30'
    };
    return colors[badge] || '';
  };

  const getBadgeLabel = (badge: string) => {
    const labels: Record<string, string> = {
      bronze: '🥉 Bronze',
      silver: '🥈 Prata',
      gold: '🥇 Ouro',
      platinum: '💎 Platina'
    };
    return labels[badge] || badge;
  };

  const MetricRow = ({
    icon: Icon,
    label,
    userValue,
    teamAvg,
    format = 'number',
    inverse = false
  }: {
    icon: any;
    label: string;
    userValue: number;
    teamAvg: number;
    format?: 'number' | 'currency' | 'percentage';
    inverse?: boolean;
  }) => {
    const isBetter = inverse ? userValue < teamAvg : userValue > teamAvg;
    const diff = Math.abs(userValue - teamAvg);
    const diffPercentage = ((diff / teamAvg) * 100).toFixed(0);

    const formatValue = (value: number) => {
      if (format === 'currency') return `R$ ${(value / 1000).toFixed(0)}k`;
      if (format === 'percentage') return `${value}%`;
      return value.toFixed(1);
    };

    return (
      <div className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{formatValue(userValue)}</div>
            <div className="text-xs text-muted-foreground">Você</div>
          </div>
          <div className="text-center">
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                isBetter
                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
              )}
            >
              {isBetter ? '+' : '-'}{diffPercentage}%
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-muted-foreground">
              {formatValue(teamAvg)}
            </div>
            <div className="text-xs text-muted-foreground">Média do time</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <InsightCard
      title="Sua Performance vs Time"
      description={`Você está em ${data.ranking}º lugar de ${data.totalUsers} vendedores`}
      icon={Award}
      iconColor="text-amber-500"
      headerAction={
        <Badge className={getBadgeColor(data.badge)}>
          {getBadgeLabel(data.badge)}
        </Badge>
      }
    >
      <div className="space-y-3">
        <MetricRow
          icon={TrendingUp}
          label="Taxa de Conversão"
          userValue={data.metrics.conversionRate.user}
          teamAvg={data.metrics.conversionRate.teamAvg}
          format="percentage"
        />

        <MetricRow
          icon={Clock}
          label="Tempo Médio de Fechamento"
          userValue={data.metrics.avgClosingTime.user}
          teamAvg={data.metrics.avgClosingTime.teamAvg}
          format="number"
          inverse
        />

        <MetricRow
          icon={DollarSign}
          label="Ticket Médio"
          userValue={data.metrics.avgTicket.user}
          teamAvg={data.metrics.avgTicket.teamAvg}
          format="currency"
        />

        <MetricRow
          icon={Activity}
          label="Atividades por Oportunidade"
          userValue={data.metrics.activitiesPerOpp.user}
          teamAvg={data.metrics.activitiesPerOpp.teamAvg}
          format="number"
        />
      </div>
    </InsightCard>
  );
}
