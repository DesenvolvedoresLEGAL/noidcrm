import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useForecastAccuracyMetrics, useAccuracyComparison } from '@/hooks/useForecastAccuracy';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Target, Brain, User, Info, History } from 'lucide-react';
import { ForecastSnapshotHistory } from './ForecastSnapshotHistory';

interface AccuracyDashboardProps {
  pipelineId?: string;
  userId?: string;
}

export function AccuracyDashboard({ pipelineId, userId }: AccuracyDashboardProps) {
  const { data: metrics, isLoading: metricsLoading } = useForecastAccuracyMetrics(pipelineId, userId);
  const { data: comparison, isLoading: comparisonLoading } = useAccuracyComparison(pipelineId, userId);

  // F2.2: histórico de snapshots no topo (resiliente — não quebra se falhar)
  const snapshotSection = (
    <ForecastSnapshotHistory pipelineId={pipelineId ?? null} sellerId={userId ?? null} />
  );

  const winProbMetrics = metrics?.find(m => m.prediction_type === 'win_probability');
  const aiAccuracy = winProbMetrics?.ai_accuracy_rate || 0;
  const humanAccuracy = winProbMetrics?.human_accuracy_rate || 0;
  const mae = winProbMetrics?.mean_absolute_error || 0;

  const hasAnyPredictions = (metrics?.reduce((s, m) => s + (m.total_predictions || 0), 0) || 0) > 0;
  const hasAnyOutcomes = (metrics?.reduce((s, m) => s + (m.predictions_with_outcome || 0), 0) || 0) > 0;
  const isEmpty = !metricsLoading && !hasAnyOutcomes;

  if (isEmpty) {
    return (
      <Card className="border-border">
        <CardContent className="pt-12 pb-12">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-muted">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Aguardando histórico de previsões</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta aba começa a mostrar dados após oportunidades fechadas (ganhas ou perdidas)
              que tenham previsão registrada. À medida que deals forem encerrados, comparamos a
              <strong> probabilidade prevista</strong> (IA ou humana) com o <strong>resultado real</strong>
              para calcular o erro médio (MAE) e a acurácia.
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="cursor-help gap-1.5 mx-auto">
                    <Info className="h-3 w-3" />
                    Como funciona Acurácia
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <div className="space-y-1.5 text-xs">
                    <p><strong>Accuracy IA:</strong> % de previsões automatizadas que acertaram o resultado (probabilidade ≥ 50% e deal ganho, ou &lt; 50% e deal perdido).</p>
                    <p><strong>Accuracy Humano:</strong> mesma lógica para a probabilidade definida manualmente pelo vendedor.</p>
                    <p><strong>MAE:</strong> diferença média absoluta (em pontos %) entre o previsto e o real.</p>
                    <p className="pt-1 text-muted-foreground">
                      {hasAnyPredictions
                        ? `Hoje há previsões registradas, mas ainda nenhum deal correspondente foi fechado.`
                        : `Ainda não há previsões registradas para esta organização.`}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MAE (Erro Médio)</p>
                <p className="text-2xl font-bold">{mae.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Brain className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Accuracy IA</p>
                <p className="text-2xl font-bold">{aiAccuracy.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <User className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Accuracy Humano</p>
                <p className="text-2xl font-bold">{humanAccuracy.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${aiAccuracy > humanAccuracy ? 'bg-success/10' : 'bg-warning/10'}`}>
                {aiAccuracy > humanAccuracy ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-warning" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">IA vs Humano</p>
                <p className="text-2xl font-bold">
                  {aiAccuracy > humanAccuracy ? '+' : ''}{(aiAccuracy - humanAccuracy).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Comparação de Accuracy ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {comparisonLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : comparison && comparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <ChartTooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => [`${value?.toFixed(1)}%`]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="aiAccuracy"
                  name="IA"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
                <Line
                  type="monotone"
                  dataKey="humanAccuracy"
                  name="Humano"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Dados insuficientes para comparação. Continue registrando previsões.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics by Source */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas por Fonte de Previsão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metricsLoading ? (
              <div className="text-muted-foreground">Carregando...</div>
            ) : metrics?.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Badge variant="outline" className="mb-1">
                    {m.prediction_source === 'ai_model' ? 'IA' : m.prediction_source === 'human' ? 'Humano' : 'Algorítmico'}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{m.prediction_type}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{m.total_predictions} previsões</p>
                  <p className="text-sm text-muted-foreground">
                    {m.predictions_with_outcome} com resultado
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AccuracyDashboard;
