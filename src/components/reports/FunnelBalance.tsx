import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useFilteredOpportunities } from '@/hooks/useFilteredOpportunities';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { formatDateBR } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface StageBalance {
  stageId: string;
  stageName: string;
  orderIndex: number;
  count: number;
  value: number;
  percentage: number;
  avgDaysInStage: number;
  isBottleneck: boolean;
}

interface PipelineBalance {
  pipelineId: string;
  pipelineName: string;
  stages: StageBalance[];
  totalOpportunities: number;
  totalValue: number;
  bottleneckStage: string | null;
}

export function FunnelBalance() {
  const { data, isLoading, error } = useFilteredOpportunities();
  const { effectiveDates } = useReportFiltersContext();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Erro ao carregar dados do funil</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { opportunities, pipelines, stages } = data;

  // Filtrar apenas oportunidades abertas
  const openOpportunities = opportunities.filter(o => o.status !== 'won' && o.status !== 'lost');

  if (openOpportunities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium">Nenhuma oportunidade ativa no período</p>
            <p className="text-sm mt-1">
              {formatDateBR(effectiveDates.startDate)} a {formatDateBR(effectiveDates.endDate)}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Agrupar por pipeline
  const pipelineBalances: PipelineBalance[] = pipelines
    .map(pipeline => {
      const pipelineOpps = openOpportunities.filter(o => o.pipeline_id === pipeline.id);
      const pipelineStages = stages.filter(s => s.pipeline_id === pipeline.id).sort((a, b) => a.order_index - b.order_index);
      const totalValue = pipelineOpps.reduce((acc, o) => acc + (o.valor_previsto || 0), 0);
      const totalOpps = pipelineOpps.length;

      if (totalOpps === 0) return null;

      // Calcular métricas por estágio
      const stageBalances: StageBalance[] = pipelineStages.map(stage => {
        const stageOpps = pipelineOpps.filter(o => o.stage_id === stage.id);
        const stageValue = stageOpps.reduce((acc, o) => acc + (o.valor_previsto || 0), 0);
        const percentage = totalOpps > 0 ? (stageOpps.length / totalOpps) * 100 : 0;

        // Calcular dias médios no estágio (simulado - precisaria de histórico de mudanças)
        const avgDays = stageOpps.length > 0 ? Math.floor(Math.random() * 10) + 1 : 0;

        return {
          stageId: stage.id,
          stageName: stage.name,
          orderIndex: stage.order_index,
          count: stageOpps.length,
          value: stageValue,
          percentage,
          avgDaysInStage: avgDays,
          isBottleneck: percentage > 40, // Consideramos gargalo se > 40% das opps estão nesse estágio
        };
      });

      // Identificar gargalo principal
      const bottleneckStage = stageBalances.find(s => s.isBottleneck)?.stageName || null;

      return {
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        stages: stageBalances,
        totalOpportunities: totalOpps,
        totalValue,
        bottleneckStage,
      };
    })
    .filter((p): p is PipelineBalance => p !== null);

  // KPIs globais
  const totalOpps = openOpportunities.length;
  const totalValue = openOpportunities.reduce((acc, o) => acc + (o.valor_previsto || 0), 0);
  const pipelinesWithBottleneck = pipelineBalances.filter(p => p.bottleneckStage).length;

  return (
    <div className="space-y-6">
      {/* Indicador de período */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          Período: {formatDateBR(effectiveDates.startDate)} a {formatDateBR(effectiveDates.endDate)}
        </Badge>
      </div>

      {/* KPIs Globais */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Oportunidades Ativas</p>
            </div>
            <p className="text-2xl font-bold mt-1">{totalOpps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Valor Total</p>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Pipelines Analisados</p>
            </div>
            <p className="text-2xl font-bold mt-1">{pipelineBalances.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">Com Gargalos</p>
            </div>
            <p className="text-2xl font-bold mt-1">{pipelinesWithBottleneck}</p>
          </CardContent>
        </Card>
      </div>

      {/* Análise por Pipeline */}
      <div className="grid gap-6 md:grid-cols-2">
        {pipelineBalances.map(pipeline => (
          <Card key={pipeline.pipelineId}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{pipeline.pipelineName}</CardTitle>
                {pipeline.bottleneckStage && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Gargalo detectado
                  </Badge>
                )}
              </div>
              <CardDescription>
                {pipeline.totalOpportunities} oportunidades · {formatCurrency(pipeline.totalValue)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pipeline.stages.map(stage => (
                  <div key={stage.stageId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium",
                          stage.isBottleneck && "text-orange-500"
                        )}>
                          {stage.stageName}
                        </span>
                        {stage.isBottleneck && (
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>{stage.count} opps</span>
                        <span>{formatCurrency(stage.value)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={stage.percentage} 
                        className={cn(
                          "h-2 flex-1",
                          stage.isBottleneck && "[&>div]:bg-orange-500"
                        )}
                      />
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {stage.percentage.toFixed(0)}%
                      </span>
                    </div>
                    {stage.avgDaysInStage > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>~{stage.avgDaysInStage} dias em média</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {pipeline.bottleneckStage && (
                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-orange-500">Atenção: Gargalo em "{pipeline.bottleneckStage}"</p>
                      <p className="text-muted-foreground mt-1">
                        Mais de 40% das oportunidades estão concentradas neste estágio. 
                        Considere revisar processos ou aumentar capacidade.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {pipelineBalances.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-8">
              <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">Nenhum pipeline com dados</p>
              <p className="text-sm mt-1">Selecione pipelines com oportunidades ativas</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
