import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Target, DollarSign, Clock, BarChart3 } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';
import { calculateMetricDelta, type MetricKind } from '@/lib/winloss/period';
import { cn } from '@/lib/utils';

interface SsotOverride {
  wonCount?: number;
  wonValue?: number;
  avgTicketWon?: number;
}

interface WinLossKPIStripProps {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  terminology: { wonPlural: string; lostPlural: string; rateLabel: string };
  pipelineType?: string;
  /** P0 Revenue SSoT — override de monetários ganhos vindo de commercial_won_revenue_view. */
  ssotOverride?: SsotOverride;
  /** WL-FILTERS-07 — série comparativa opcional (mesma lógica de cálculo, outro período). */
  comparison?: {
    label: string;
    isLoading: boolean;
    data: WinLossDataResult | undefined;
    ssotOverride?: SsotOverride;
  };
}

// Para pipelines de venda, encurtamos os rótulos. Outros tipos mantêm a terminologia original.
const SHORT_LABELS: Record<string, { won: string; lost: string }> = {
  sales: { won: 'Ganhos', lost: 'Perdidos' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

function generalCycle(data: WinLossDataResult | undefined): number | null {
  const wonCycles = data?.validWinCyclesCount ?? 0;
  const lostCycles = data?.validLossCyclesCount ?? 0;
  const avgWon = data?.avgCycleWon ?? null;
  const avgLost = data?.avgCycleLost ?? null;
  if (avgWon != null && avgLost != null && wonCycles + lostCycles > 0) {
    return Math.round((avgWon * wonCycles + avgLost * lostCycles) / (wonCycles + lostCycles));
  }
  if (avgWon != null) return avgWon;
  if (avgLost != null) return avgLost;
  return null;
}

export function WinLossKPIStrip({ data, isLoading, terminology, pipelineType, ssotOverride, comparison }: WinLossKPIStripProps) {
  const short = pipelineType ? SHORT_LABELS[pipelineType] : undefined;
  const wonLabel = short?.won ?? terminology.wonPlural;
  const lostLabel = short?.lost ?? terminology.lostPlural;
  // P0 Revenue SSoT — monetários ganhos vêm de commercial_won_revenue_view quando informado.
  const wonCount = ssotOverride?.wonCount ?? data?.wonCount ?? 0;
  const wonValue = ssotOverride?.wonValue ?? data?.wonValue ?? 0;

  // Ciclo Médio Geral: média ponderada de won + lost (quando ambos existem).
  const avgCycleGeneral = generalCycle(data);

  const prev = comparison?.data;
  const prevAvailable = !!comparison && !comparison.isLoading && !!prev;
  const prevValue = (v: number | null | undefined) => (prevAvailable ? (v ?? 0) : null);

  const kpis: Array<{
    label: string;
    value: number;
    format: 'number' | 'percent' | 'currency';
    kind: MetricKind;
    higherIsBetter: boolean;
    previous: number | null;
    icon: typeof TrendingUp;
    color: string;
    bg: string;
  }> = [
    {
      label: wonLabel,
      value: wonCount,
      format: 'number',
      kind: 'number',
      higherIsBetter: true,
      previous: prevAvailable ? (comparison?.ssotOverride?.wonCount ?? prev?.wonCount ?? 0) : null,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: lostLabel,
      value: data?.lostCount || 0,
      format: 'number',
      kind: 'number',
      higherIsBetter: false,
      previous: prevValue(prev?.lostCount),
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      label: terminology.rateLabel,
      value: data?.winRate || 0,
      format: 'percent',
      kind: 'percent',
      higherIsBetter: true,
      previous: prevValue(prev?.winRate),
      icon: Target,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Valor Perdido',
      value: data?.lostValue || 0,
      format: 'currency',
      kind: 'currency',
      higherIsBetter: false,
      previous: prevValue(prev?.lostValue),
      icon: DollarSign,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'Receita Ganha',
      value: wonValue,
      format: 'currency',
      kind: 'currency',
      higherIsBetter: true,
      previous: prevAvailable ? (comparison?.ssotOverride?.wonValue ?? prev?.wonValue ?? 0) : null,
      icon: BarChart3,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Ciclo Médio Geral',
      value: avgCycleGeneral ?? 0,
      format: 'number',
      kind: 'days',
      higherIsBetter: false,
      previous: prevAvailable ? generalCycle(prev) : null,
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

  const formatValue = (value: number, format: 'number' | 'percent' | 'currency') => {
    if (format === 'currency') return formatCurrency(value);
    if (format === 'percent') return `${value}%`;
    return String(value);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const displayValue = formatValue(kpi.value, kpi.format);
          const delta = comparison
            ? calculateMetricDelta(kpi.value, kpi.previous, kpi.kind, kpi.higherIsBetter)
            : null;

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
                    {comparison && (
                      comparison.isLoading ? (
                        <Skeleton className="h-3 w-16 mt-1" />
                      ) : delta ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p
                              className={cn(
                                'text-[11px] mt-0.5 truncate cursor-default',
                                !delta.hasBase && 'text-muted-foreground',
                                delta.hasBase && delta.sentiment === 'positive' && 'text-emerald-500',
                                delta.hasBase && delta.sentiment === 'negative' && 'text-red-500',
                                delta.hasBase && delta.sentiment === 'neutral' && 'text-muted-foreground',
                              )}
                            >
                              {delta.text}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">
                              {comparison.label}: {kpi.previous == null ? 'sem dados' : formatValue(kpi.previous, kpi.format)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : null
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
