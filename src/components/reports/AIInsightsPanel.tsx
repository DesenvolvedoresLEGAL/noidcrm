import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Brain, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Target,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { generateBIInsights, AIInsight, AIKPI, AIPrediction } from '@/services/crm/bi-insights';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { cn } from '@/lib/utils';

export function AIInsightsPanel() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { effectiveDates, filters } = useReportFiltersContext();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bi-insights', effectiveDates, filters.pipelines],
    queryFn: () => generateBIInsights('general'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'opportunity': return <Lightbulb className="h-5 w-5 text-blue-500" />;
      case 'risk': return <Target className="h-5 w-5 text-red-500" />;
    }
  };

  const getInsightBgColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/20';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'opportunity': return 'bg-blue-500/10 border-blue-500/20';
      case 'risk': return 'bg-red-500/10 border-red-500/20';
    }
  };

  const getImpactBadge = (impact: AIInsight['impact']) => {
    switch (impact) {
      case 'high': return <Badge variant="destructive">Alto Impacto</Badge>;
      case 'medium': return <Badge variant="secondary">Médio Impacto</Badge>;
      case 'low': return <Badge variant="outline">Baixo Impacto</Badge>;
    }
  };

  const getTrendIcon = (trend: AIKPI['trend']) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable': return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getConfidenceBadge = (confidence: AIPrediction['confidence']) => {
    switch (confidence) {
      case 'high': return <Badge className="bg-green-500/20 text-green-700">Alta Confiança</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/20 text-yellow-700">Média Confiança</Badge>;
      case 'low': return <Badge className="bg-red-500/20 text-red-700">Baixa Confiança</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erro ao gerar insights</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Não foi possível gerar os insights. Tente novamente.'}
          <Button variant="outline" size="sm" className="ml-4" onClick={handleRefresh}>
            Tentar Novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const insights = data?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Insights de IA</h2>
            <p className="text-sm text-muted-foreground">
              Análise inteligente baseada nos dados do pipeline
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Summary */}
      {insights?.summary && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm leading-relaxed">{insights.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context KPIs */}
      {data?.dataContext && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Pipeline Aberto</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(data.dataContext.totalPipelineValue)}
              </p>
              <p className="text-xs text-muted-foreground">{data.dataContext.totalOpenOpportunities} oportunidades</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
              <p className="text-2xl font-bold">{data.dataContext.winRate}%</p>
              <p className="text-xs text-muted-foreground">{data.dataContext.wonCount}W / {data.dataContext.lostCount}L</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Deals Quentes</p>
              <p className="text-2xl font-bold text-orange-500">{data.dataContext.hotDeals}</p>
              <p className="text-xs text-muted-foreground">Hot + Burning</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Em Risco</p>
              <p className="text-2xl font-bold text-red-500">{data.dataContext.atRiskDeals}</p>
              <p className="text-xs text-muted-foreground">Score &lt; 40</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI KPIs */}
      {insights?.kpis && insights.kpis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KPIs Destacados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.kpis.map((kpi, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-lg font-semibold">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.context}</p>
                  </div>
                  {getTrendIcon(kpi.trend)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {insights?.insights && insights.insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Insights Acionáveis</h3>
          <div className="grid gap-3">
            {insights.insights.map((insight, index) => (
              <Card key={index} className={cn("border", getInsightBgColor(insight.type))}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{insight.title}</h4>
                        {getImpactBadge(insight.impact)}
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <ArrowRight className="h-4 w-4" />
                        <span>{insight.recommendation}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Predictions */}
      {insights?.predictions && insights.predictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previsões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.predictions.map((prediction, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{prediction.metric}</p>
                    <p className="text-sm text-muted-foreground">{prediction.prediction}</p>
                    <p className="text-xs text-muted-foreground">{prediction.timeframe}</p>
                  </div>
                  {getConfidenceBadge(prediction.confidence)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation timestamp */}
      {data?.generatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Gerado em {new Date(data.generatedAt).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
}
