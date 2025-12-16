import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useForecastAccuracyMetrics, useAccuracyComparison } from '@/hooks/useForecastAccuracy';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Target, Brain, User } from 'lucide-react';

interface AccuracyDashboardProps {
  pipelineId?: string;
  userId?: string;
}

export function AccuracyDashboard({ pipelineId, userId }: AccuracyDashboardProps) {
  const { data: metrics, isLoading: metricsLoading } = useForecastAccuracyMetrics(pipelineId, userId);
  const { data: comparison, isLoading: comparisonLoading } = useAccuracyComparison(pipelineId, userId);

  const winProbMetrics = metrics?.find(m => m.prediction_type === 'win_probability');
  const aiAccuracy = winProbMetrics?.ai_accuracy_rate || 0;
  const humanAccuracy = winProbMetrics?.human_accuracy_rate || 0;
  const mae = winProbMetrics?.mean_absolute_error || 0;

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
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Brain className="h-5 w-5 text-blue-500" />
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
              <div className="p-2 rounded-lg bg-green-500/10">
                <User className="h-5 w-5 text-green-500" />
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
              <div className={`p-2 rounded-lg ${aiAccuracy > humanAccuracy ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                {aiAccuracy > humanAccuracy ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-yellow-500" />
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
                <Tooltip 
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
                  stroke="hsl(142 76% 36%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(142 76% 36%)' }}
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
