import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStageConversionMetrics } from '@/hooks/usePipelineMetrics';
import { ArrowRight, TrendingUp, Layers } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function StageConversionReport() {
  const { data: conversionMetrics, isLoading } = useStageConversionMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Agrupar por pipeline
  const pipelineGroups = (conversionMetrics || []).reduce((acc, metric) => {
    if (!acc[metric.pipeline_id]) {
      acc[metric.pipeline_id] = {
        pipeline_name: metric.pipeline_name,
        pipeline_type: metric.pipeline_type,
        stages: []
      };
    }
    acc[metric.pipeline_id].stages.push(metric);
    return acc;
  }, {} as Record<string, { pipeline_name: string; pipeline_type: string; stages: typeof conversionMetrics }>);

  const pipelines = Object.entries(pipelineGroups).map(([id, data]) => ({
    id,
    ...data,
    stages: data.stages?.sort((a, b) => a.order_index - b.order_index) || []
  }));

  // Calcular métricas globais
  const totalOpportunities = (conversionMetrics || []).reduce((sum, m) => sum + m.opportunities_count, 0);
  const totalValue = (conversionMetrics || []).reduce((sum, m) => sum + m.stage_value, 0);
  const avgConversion = (conversionMetrics || [])
    .filter(m => m.conversion_rate_to_next !== null)
    .reduce((sum, m, _, arr) => sum + (m.conversion_rate_to_next || 0) / arr.length, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades no Funil</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOpportunities}</div>
            <p className="text-xs text-muted-foreground">
              Distribuídas em todos os estágios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Pipeline total ativo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão Média</CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConversion.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Entre estágios
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funis por Pipeline */}
      {pipelines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum dado de conversão disponível.</p>
            <p className="text-sm">Os dados aparecerão quando houver oportunidades nos estágios.</p>
          </CardContent>
        </Card>
      ) : (
        pipelines.map(pipeline => (
          <Card key={pipeline.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {pipeline.pipeline_name}
                <Badge variant="outline" className="ml-2">
                  {pipeline.pipeline_type === 'sales' ? 'Vendas' : 'Qualificação'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Conversão entre estágios do funil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pipeline.stages.map((stage, index) => (
                  <div key={stage.stage_id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{stage.stage_name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{stage.opportunities_count} opps</Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(stage.stage_value)}
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={stage.opportunities_count > 0 ? Math.min((stage.opportunities_count / Math.max(...pipeline.stages.map(s => s.opportunities_count))) * 100, 100) : 0} 
                        className="h-2"
                      />
                    </div>
                    
                    {stage.conversion_rate_to_next !== null && index < pipeline.stages.length - 1 && (
                      <div className="flex items-center gap-1 min-w-[80px]">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className={`text-sm font-medium ${
                          stage.conversion_rate_to_next >= 50 ? 'text-green-600' :
                          stage.conversion_rate_to_next >= 30 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {stage.conversion_rate_to_next}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
