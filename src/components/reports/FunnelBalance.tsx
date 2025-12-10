import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter, AlertTriangle, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { EmptyState } from '@/components/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface StageData {
  stage_id: string;
  stage_name: string;
  order_index: number;
  count: number;
  value: number;
  percentage: number;
  avg_days: number;
  is_bottleneck: boolean;
}

interface PipelineFunnel {
  pipeline_id: string;
  pipeline_name: string;
  stages: StageData[];
  total_count: number;
  total_value: number;
}

export function FunnelBalance() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters } = useReportFiltersContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'funnel-balance', visibleUserIds, filters.pipelines],
    queryFn: async (): Promise<PipelineFunnel[]> => {
      // Get pipelines
      const pipelinesQuery = supabase
        .from('pipelines')
        .select('id, name, pipeline_type')
        .eq('is_active', true);

      if (filters.pipelines.length > 0) {
        pipelinesQuery = pipelinesQuery.in('id', filters.pipelines);
      }

      const { data: pipelines, error: pipelinesError } = await pipelinesQuery;
      if (pipelinesError) throw pipelinesError;

      // Get stages
      const { data: stages, error: stagesError } = await supabase
        .from('stages')
        .select('id, name, order_index, pipeline_id')
        .in('pipeline_id', pipelines?.map(p => p.id) || [])
        .order('order_index', { ascending: true });
      if (stagesError) throw stagesError;

      // Get open opportunities
      let oppsQuery = supabase
        .from('opportunities')
        .select('id, stage_id, valor_previsto, created_at, owner_user_id, pipeline_id')
        .eq('status', 'open');

      if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        oppsQuery = oppsQuery.in('owner_user_id', visibleUserIds);
      }

      if (filters.pipelines.length > 0) {
        oppsQuery = oppsQuery.in('pipeline_id', filters.pipelines);
      }

      const { data: opportunities, error: oppsError } = await oppsQuery;
      if (oppsError) throw oppsError;

      // Process data by pipeline
      const pipelineFunnels: PipelineFunnel[] = (pipelines || []).map(pipeline => {
        const pipelineStages = (stages || []).filter(s => s.pipeline_id === pipeline.id);
        const pipelineOpps = (opportunities || []).filter(o => o.pipeline_id === pipeline.id);
        const totalCount = pipelineOpps.length;
        const totalValue = pipelineOpps.reduce((acc, o) => acc + (o.valor_previsto || 0), 0);

        const stageData: StageData[] = pipelineStages.map((stage, idx) => {
          const stageOpps = pipelineOpps.filter(o => o.stage_id === stage.id);
          const count = stageOpps.length;
          const value = stageOpps.reduce((acc, o) => acc + (o.valor_previsto || 0), 0);
          const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
          
          // Calculate average days in stage
          const now = new Date();
          const avgDays = stageOpps.length > 0
            ? stageOpps.reduce((acc, o) => {
                const created = new Date(o.created_at);
                return acc + Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
              }, 0) / stageOpps.length
            : 0;

          // Determine if this is a bottleneck (high concentration)
          const isBottleneck = percentage > 30 && idx > 0 && idx < pipelineStages.length - 1;

          return {
            stage_id: stage.id,
            stage_name: stage.name,
            order_index: stage.order_index,
            count,
            value,
            percentage,
            avg_days: avgDays,
            is_bottleneck: isBottleneck,
          };
        });

        return {
          pipeline_id: pipeline.id,
          pipeline_name: pipeline.name,
          stages: stageData,
          total_count: totalCount,
          total_value: totalValue,
        };
      }).filter(p => p.total_count > 0);

      return pipelineFunnels;
    },
    enabled: !visibilityLoading,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => <Skeleton key={i} className="h-96" />)}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar dados"
        description="Não foi possível carregar o balanceamento do funil."
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Filter}
        title="Nenhum dado de funil disponível"
        description="Crie oportunidades e mova-as pelos estágios para visualizar o balanceamento."
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.map(pipeline => (
        <Card key={pipeline.pipeline_id} className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                {pipeline.pipeline_name}
              </CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {pipeline.total_count} oportunidades
                </span>
                <span className="font-medium">
                  {formatCurrency(pipeline.total_value)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Funnel Visualization */}
            <div className="space-y-3 mb-6">
              {pipeline.stages.map((stage, idx) => (
                <div key={stage.stage_id} className="flex items-center gap-4">
                  <div className="w-32 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground truncate" title={stage.stage_name}>
                      {stage.stage_name}
                    </span>
                    {stage.is_bottleneck && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        Gargalo
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                        <div 
                          className="h-full flex items-center justify-end px-2 transition-all"
                          style={{ 
                            width: `${Math.max(stage.percentage, 5)}%`,
                            backgroundColor: stage.is_bottleneck ? 'hsl(var(--destructive))' : COLORS[idx % COLORS.length],
                          }}
                        >
                          <span className="text-xs font-medium text-white">
                            {stage.count}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {stage.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(stage.value)}
                    </span>
                  </div>
                  <div className="w-20 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {stage.avg_days.toFixed(0)}d
                  </div>
                </div>
              ))}
            </div>

            {/* Value Distribution Chart */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline.stages}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis 
                    dataKey="stage_name" 
                    tick={{ fontSize: 10 }} 
                    className="fill-muted-foreground"
                    tickFormatter={(v) => v.length > 12 ? v.substring(0, 12) + '...' : v}
                  />
                  <YAxis 
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 10 }} 
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }} 
                    className="fill-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'count' ? value : formatCurrency(value),
                      name === 'count' ? 'Quantidade' : 'Valor'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" name="Quantidade" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="value" name="Valor" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Bottleneck Alerts */}
            {pipeline.stages.some(s => s.is_bottleneck) && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Gargalos Detectados</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pipeline.stages.filter(s => s.is_bottleneck).map(s => s.stage_name).join(', ')} 
                      {' '}concentram mais de 30% das oportunidades. Considere revisar processos ou adicionar recursos.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
