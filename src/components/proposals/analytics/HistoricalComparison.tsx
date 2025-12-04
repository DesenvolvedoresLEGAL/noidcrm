import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, BarChart3, Target, Clock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoricalComparisonProps {
  currentMetrics: {
    totalViews: number;
    avgDuration: number;
    engagementScore: number;
  };
  benchmarks?: {
    avgViews: number;
    avgDuration: number;
    avgEngagement: number;
    totalProposals: number;
  };
}

interface MetricComparison {
  label: string;
  current: number;
  benchmark: number;
  unit: string;
  icon: any;
  higherIsBetter: boolean;
}

export function HistoricalComparison({ currentMetrics, benchmarks }: HistoricalComparisonProps) {
  // Default benchmarks if not provided (typical CRM averages)
  const defaultBenchmarks = {
    avgViews: 2.5,
    avgDuration: 120, // 2 minutes
    avgEngagement: 45,
    totalProposals: 0,
  };

  const bench = benchmarks || defaultBenchmarks;
  const hasBenchmarks = benchmarks && benchmarks.totalProposals > 0;

  const metrics: MetricComparison[] = [
    {
      label: 'Visualizações',
      current: currentMetrics.totalViews,
      benchmark: bench.avgViews,
      unit: '',
      icon: Eye,
      higherIsBetter: true,
    },
    {
      label: 'Tempo Médio',
      current: currentMetrics.avgDuration,
      benchmark: bench.avgDuration,
      unit: 's',
      icon: Clock,
      higherIsBetter: true,
    },
    {
      label: 'Engajamento',
      current: currentMetrics.engagementScore,
      benchmark: bench.avgEngagement,
      unit: '',
      icon: Target,
      higherIsBetter: true,
    },
  ];

  const getPercentageDiff = (current: number, benchmark: number): number => {
    if (benchmark === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - benchmark) / benchmark) * 100);
  };

  const getPerformanceLevel = (percentDiff: number, higherIsBetter: boolean): 'better' | 'worse' | 'equal' => {
    const adjusted = higherIsBetter ? percentDiff : -percentDiff;
    if (adjusted > 10) return 'better';
    if (adjusted < -10) return 'worse';
    return 'equal';
  };

  const formatValue = (value: number, unit: string): string => {
    if (unit === 's') {
      if (value < 60) return `${Math.round(value)}s`;
      return `${Math.round(value / 60)}min`;
    }
    return value.toFixed(value % 1 === 0 ? 0 : 1);
  };

  // Calculate overall performance
  const overallPerformance = metrics.reduce((sum, m) => {
    const diff = getPercentageDiff(m.current, m.benchmark);
    return sum + (m.higherIsBetter ? diff : -diff);
  }, 0) / metrics.length;

  const overallLevel = overallPerformance > 10 ? 'better' : overallPerformance < -10 ? 'worse' : 'equal';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Comparativo Histórico
          </CardTitle>
          <Badge 
            variant="outline"
            className={cn(
              'text-xs',
              overallLevel === 'better' && 'border-green-500/30 bg-green-500/10 text-green-600',
              overallLevel === 'worse' && 'border-red-500/30 bg-red-500/10 text-red-600',
            )}
          >
            {overallLevel === 'better' && <TrendingUp className="h-3 w-3 mr-1" />}
            {overallLevel === 'worse' && <TrendingDown className="h-3 w-3 mr-1" />}
            {overallLevel === 'equal' && <Minus className="h-3 w-3 mr-1" />}
            {overallLevel === 'better' ? 'Acima da média' : overallLevel === 'worse' ? 'Abaixo da média' : 'Na média'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall performance banner */}
        <div className={cn(
          'p-3 rounded-lg border text-center',
          overallLevel === 'better' && 'bg-green-500/5 border-green-500/20',
          overallLevel === 'worse' && 'bg-red-500/5 border-red-500/20',
          overallLevel === 'equal' && 'bg-muted/50',
        )}>
          <p className="text-sm font-medium">
            {overallLevel === 'better' && (
              <>Esta proposta está performando <span className="text-green-600">{Math.abs(Math.round(overallPerformance))}% melhor</span> que a média</>
            )}
            {overallLevel === 'worse' && (
              <>Esta proposta está performando <span className="text-red-600">{Math.abs(Math.round(overallPerformance))}% abaixo</span> da média</>
            )}
            {overallLevel === 'equal' && (
              <>Esta proposta está na <span className="text-muted-foreground">média</span> de performance</>
            )}
          </p>
          {hasBenchmarks && (
            <p className="text-xs text-muted-foreground mt-1">
              Baseado em {bench.totalProposals} propostas anteriores
            </p>
          )}
        </div>

        {/* Individual metrics */}
        <div className="space-y-3">
          {metrics.map((metric) => {
            const percentDiff = getPercentageDiff(metric.current, metric.benchmark);
            const level = getPerformanceLevel(percentDiff, metric.higherIsBetter);
            const Icon = metric.icon;
            const progressValue = Math.min(100, (metric.current / (metric.benchmark * 2)) * 100);

            return (
              <div key={metric.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{metric.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatValue(metric.current, metric.unit)}
                    </span>
                    {percentDiff !== 0 && (
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded',
                        level === 'better' && 'bg-green-500/10 text-green-600',
                        level === 'worse' && 'bg-red-500/10 text-red-600',
                        level === 'equal' && 'bg-muted text-muted-foreground',
                      )}>
                        {percentDiff > 0 ? '+' : ''}{percentDiff}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <Progress 
                    value={progressValue} 
                    className={cn(
                      'h-full',
                      level === 'better' && '[&>div]:bg-green-500',
                      level === 'worse' && '[&>div]:bg-red-500',
                      level === 'equal' && '[&>div]:bg-primary',
                    )}
                  />
                  {/* Benchmark marker */}
                  <div 
                    className="absolute top-0 h-full w-0.5 bg-foreground/30"
                    style={{ left: '50%' }}
                    title={`Média: ${formatValue(metric.benchmark, metric.unit)}`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0</span>
                  <span>Média: {formatValue(metric.benchmark, metric.unit)}</span>
                  <span>{formatValue(metric.benchmark * 2, metric.unit)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Insights */}
        {overallLevel === 'worse' && (
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700">
            💡 Dica: Considere fazer follow-up para aumentar o engajamento
          </div>
        )}
        {overallLevel === 'better' && currentMetrics.totalViews >= 3 && (
          <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-xs text-green-700">
            🎯 Ótimo momento para contato! Alto interesse detectado
          </div>
        )}
      </CardContent>
    </Card>
  );
}
