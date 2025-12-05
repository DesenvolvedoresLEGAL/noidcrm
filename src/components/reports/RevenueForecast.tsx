import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRevenueForecastData } from '@/hooks/useReportsData';
import { LineChart, TrendingUp, Target, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, ReferenceLine } from 'recharts';
import { EmptyState } from '@/components/EmptyState';
import { Progress } from '@/components/ui/progress';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
}

export function RevenueForecast() {
  const { data, isLoading, error } = useRevenueForecastData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar dados"
        description="Não foi possível carregar a previsão de receita."
      />
    );
  }

  if (!data || (data.closedRevenue === 0 && data.openPipeline === 0 && data.closingOpportunities.length === 0)) {
    return (
      <EmptyState
        icon={LineChart}
        title="Nenhuma previsão de receita disponível"
        description="A previsão de receita será calculada automaticamente com base nas oportunidades em aberto e suas probabilidades."
      />
    );
  }

  const { closedRevenue, openPipeline, weightedPipeline, goal, scenarios, closingOpportunities } = data;

  const goalProgress = Math.min((closedRevenue / goal) * 100, 100);
  const realisticProgress = Math.min(((closedRevenue + weightedPipeline) / goal) * 100, 100);

  const scenarioColors = {
    'Pessimista': 'hsl(var(--destructive))',
    'Realista': 'hsl(var(--chart-3))',
    'Otimista': 'hsl(var(--chart-2))',
    'Melhor Caso': 'hsl(var(--chart-1))',
  };

  const scenarioChartData = scenarios.map(s => ({
    name: s.name,
    valor: s.value,
    fill: scenarioColors[s.name as keyof typeof scenarioColors] || 'hsl(var(--chart-1))',
  }));

  // Days left in month
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita Fechada</p>
                <p className="text-lg font-bold text-emerald-500">{formatCurrency(closedRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline Aberto</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(openPipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline Ponderado</p>
                <p className="text-lg font-bold text-purple-500">{formatCurrency(weightedPipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Calendar className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dias Restantes</p>
                <p className="text-lg font-bold text-amber-500">{daysLeft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Progress */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Progresso da Meta</span>
            <span className="text-sm font-normal text-muted-foreground">
              Meta: {formatCurrency(goal)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Receita Fechada</span>
                <span className="font-medium">{goalProgress.toFixed(1)}%</span>
              </div>
              <Progress value={goalProgress} className="h-3" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Projeção Realista (Fechado + Ponderado)</span>
                <span className="font-medium text-purple-500">{realisticProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-purple-500 transition-all"
                  style={{ width: `${Math.min(realisticProgress, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Scenarios Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <LineChart className="h-4 w-4 text-muted-foreground" />
              Cenários de Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scenarioChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis 
                    tickFormatter={(v) => formatCompact(v)}
                    tick={{ fontSize: 11 }} 
                    className="fill-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <ReferenceLine y={goal} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: 'Meta', fill: 'hsl(var(--destructive))', fontSize: 10 }} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {scenarioChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-3">
              {scenarios.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: scenarioColors[s.name as keyof typeof scenarioColors] }}
                  />
                  <span className="text-muted-foreground">{s.name}: {formatCurrency(s.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scenario Details */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Detalhes dos Cenários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scenarios.map((scenario, i) => {
                const isAboveGoal = scenario.value >= goal;
                const percentOfGoal = (scenario.value / goal) * 100;
                
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: scenarioColors[scenario.name as keyof typeof scenarioColors] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{scenario.name}</span>
                        <span className="text-xs text-muted-foreground">{scenario.probability}% prob.</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">{formatCurrency(scenario.value)}</span>
                        <span className={`text-xs ${isAboveGoal ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {percentOfGoal.toFixed(0)}% da meta
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Closing Opportunities */}
      {closingOpportunities.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Oportunidades Previstas para Este Mês ({closingOpportunities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Oportunidade</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Probabilidade</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor Ponderado</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Previsão</th>
                  </tr>
                </thead>
                <tbody>
                  {closingOpportunities.slice(0, 10).map((opp: any) => {
                    const weighted = (opp.valor_previsto || 0) * ((opp.prob || 50) / 100);
                    return (
                      <tr key={opp.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium truncate max-w-[200px]" title={opp.title}>
                          {opp.title}
                        </td>
                        <td className="text-right py-2 px-3">{formatCurrency(opp.valor_previsto || 0)}</td>
                        <td className="text-right py-2 px-3">
                          <span className={opp.prob >= 70 ? 'text-emerald-500' : opp.prob >= 40 ? 'text-amber-500' : 'text-muted-foreground'}>
                            {opp.prob || 50}%
                          </span>
                        </td>
                        <td className="text-right py-2 px-3 text-purple-500">{formatCurrency(weighted)}</td>
                        <td className="text-right py-2 px-3 text-muted-foreground">
                          {opp.close_date_prevista ? new Date(opp.close_date_prevista).toLocaleDateString('pt-BR') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {closingOpportunities.length > 10 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  +{closingOpportunities.length - 10} oportunidades adicionais
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
