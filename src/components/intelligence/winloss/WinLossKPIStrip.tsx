import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Target, DollarSign, Clock, BarChart3 } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface WinLossKPIStripProps {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  terminology: { wonPlural: string; lostPlural: string; rateLabel: string };
  pipelineType?: string;
  /** P0 Revenue SSoT — override de monetários ganhos vindo de commercial_won_revenue_view. */
  ssotOverride?: {
    wonCount?: number;
    wonValue?: number;
    avgTicketWon?: number;
  };
}

// Para pipelines de venda, encurtamos os rótulos. Outros tipos mantêm a terminologia original.
const SHORT_LABELS: Record<string, { won: string; lost: string }> = {
  sales: { won: 'Ganhos', lost: 'Perdidos' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export function WinLossKPIStrip({ data, isLoading, terminology, pipelineType, ssotOverride }: WinLossKPIStripProps) {
  const short = pipelineType ? SHORT_LABELS[pipelineType] : undefined;
  const wonLabel = short?.won ?? terminology.wonPlural;
  const lostLabel = short?.lost ?? terminology.lostPlural;
  // P0 Revenue SSoT — monetários ganhos vêm de commercial_won_revenue_view quando informado.
  const wonCount = ssotOverride?.wonCount ?? data?.wonCount ?? 0;
  const wonValue = ssotOverride?.wonValue ?? data?.wonValue ?? 0;

  // Ciclo Médio Geral: média ponderada de won + lost (quando ambos existem).
  const wonCycles = data?.validWinCyclesCount ?? 0;
  const lostCycles = data?.validLossCyclesCount ?? 0;
  const avgWon = data?.avgCycleWon ?? null;
  const avgLost = data?.avgCycleLost ?? null;
  let avgCycleGeneral: number | null = null;
  if (avgWon != null && avgLost != null && wonCycles + lostCycles > 0) {
    avgCycleGeneral = Math.round((avgWon * wonCycles + avgLost * lostCycles) / (wonCycles + lostCycles));
  } else if (avgWon != null) {
    avgCycleGeneral = avgWon;
  } else if (avgLost != null) {
    avgCycleGeneral = avgLost;
  }

  const kpis = [
    {
      label: wonLabel,
      value: wonCount,
      format: 'number' as const,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: lostLabel,
      value: data?.lostCount || 0,
      format: 'number' as const,
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      label: terminology.rateLabel,
      value: data?.winRate || 0,
      format: 'percent' as const,
      icon: Target,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Valor Perdido',
      value: data?.lostValue || 0,
      format: 'currency' as const,
      icon: DollarSign,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'Ticket Médio Ganho',
      value: avgTicketWon,
      format: 'currency' as const,
      icon: BarChart3,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Ciclo Médio Geral',
      value: avgCycleGeneral ?? 0,
      format: 'number' as const,
      icon: Clock,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        let displayValue: string;
        if (kpi.format === 'currency') displayValue = formatCurrency(kpi.value);
        else if (kpi.format === 'percent') displayValue = `${kpi.value}%`;
        else displayValue = String(kpi.value);

        return (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${kpi.bg}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>{displayValue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
