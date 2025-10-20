import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  AlertTriangle,
  CheckCircle2,
  Activity,
  Zap
} from 'lucide-react';
import { listOpportunities } from '@/services/crm/opportunities';
import { calculateForecastData } from '@/services/crm/forecast';
import type { ForecastData, Opportunity } from '@/services/crm/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function RevenueForecast() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: opportunities } = await listOpportunities();
        const openOpportunities = opportunities.filter(opp => 
          !opp.meta?.status || opp.meta?.status === 'open'
        );
        
        const forecastData = calculateForecastData(openOpportunities, 500000); // Meta de R$ 500k
        setData(forecastData);
      } catch (error) {
        console.error('Erro ao carregar dados de forecast:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Não foi possível carregar os dados de forecast.
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const scenarioColors = {
    pessimista: 'bg-red-100 dark:bg-red-950 border-red-200 dark:border-red-900',
    realista: 'bg-blue-100 dark:bg-blue-950 border-blue-200 dark:border-blue-900',
    otimista: 'bg-green-100 dark:bg-green-950 border-green-200 dark:border-green-900',
    best_case: 'bg-purple-100 dark:bg-purple-950 border-purple-200 dark:border-purple-900',
  };

  const scenarioIcons = {
    pessimista: AlertTriangle,
    realista: Target,
    otimista: TrendingUp,
    best_case: Zap,
  };

  return (
    <div className="space-y-6">
      {/* KPIs de Previsibilidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Total</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(data.pipelineTotal)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.pipelineCoverage.toFixed(0)}% da meta
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Weighted Pipeline</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(data.weightedPipeline)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ponderado por probabilidade
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-950 rounded-lg">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Coverage</p>
                <p className="text-3xl font-bold mt-2">{data.pipelineCoverage.toFixed(0)}%</p>
                <Progress value={Math.min(data.pipelineCoverage, 100)} className="mt-2" />
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-950 rounded-lg">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fechamento Esperado</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(data.expectedCloseThisMonth)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.daysLeft} dias restantes
                </p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-950 rounded-lg">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cenários de Forecast */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Cenários de Forecast</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.scenarios.map((scenario) => {
            const Icon = scenarioIcons[scenario.name];
            return (
              <Card key={scenario.name} className={`border-2 ${scenarioColors[scenario.name]}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{scenario.label}</p>
                      <p className="text-xs text-muted-foreground">{scenario.probability}% confiança</p>
                    </div>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <p className="text-2xl font-bold mb-2">{formatCurrency(scenario.value)}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Meta:</span>
                      <span className="font-medium">{scenario.percentage.toFixed(0)}%</span>
                    </div>
                    
                    {scenario.meetsGoal ? (
                      <Badge variant="default" className="w-full justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Bate meta
                      </Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="destructive" className="w-full justify-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Gap: {formatCurrency(Math.abs(scenario.gap))}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Gráfico de Projeção Temporal */}
      <Card>
        <CardHeader>
          <CardTitle>Projeção de Receita até Fim do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data.projections}>
              <defs>
                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWeighted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={formatDate}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              
              <ReferenceLine 
                y={data.goal} 
                stroke="#ef4444" 
                strokeDasharray="3 3" 
                label={{ value: 'Meta', fill: '#ef4444', fontSize: 12 }}
              />
              
              <Area
                type="monotone"
                dataKey="projected"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorProjected)"
                name="Projeção Linear"
              />
              
              <Area
                type="monotone"
                dataKey="weightedProjected"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#colorWeighted)"
                name="Projeção Weighted"
              />
              
              <Line
                type="monotone"
                dataKey="closed"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                name="Receita Fechada"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Análise de Gap & Recomendações */}
      <Card>
        <CardHeader>
          <CardTitle>Análise e Recomendações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Target className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium">Status da Meta</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.scenarios[1].meetsGoal ? (
                    <>
                      Você está <strong className="text-green-600">{data.scenarios[1].percentage.toFixed(0)}%</strong> da meta 
                      no cenário realista. Continue focando nas oportunidades de alta probabilidade.
                    </>
                  ) : (
                    <>
                      Você está <strong className="text-red-600">{data.scenarios[1].percentage.toFixed(0)}%</strong> da meta. 
                      É necessário fechar mais <strong>{formatCurrency(Math.abs(data.scenarios[1].gap))}</strong> para atingir a meta.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Activity className="h-5 w-5 mt-0.5 text-purple-600" />
              <div>
                <p className="font-medium">Velocidade de Vendas</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sua velocidade atual é de <strong>{formatCurrency(data.velocityPerDay)}/dia</strong>.
                  Com {data.daysLeft} dias restantes, você deve fechar aproximadamente{' '}
                  <strong>{formatCurrency(data.velocityPerDay * data.daysLeft)}</strong> até o fim do mês.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Zap className="h-5 w-5 mt-0.5 text-yellow-600" />
              <div>
                <p className="font-medium">Recomendações Acionáveis</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Priorize oportunidades com 75%+ de probabilidade (cenário pessimista)</li>
                  <li>Revise oportunidades estagnadas há mais de 15 dias</li>
                  <li>Agende follow-ups para todas as oportunidades com fechamento previsto esta semana</li>
                  <li>Considere acelerar oportunidades de 50-75% que estão próximas da decisão</li>
                </ul>
              </div>
            </div>

            {data.pipelineCoverage < 100 && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                <AlertTriangle className="h-5 w-5 mt-0.5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-300">Pipeline Insuficiente</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    Seu pipeline total ({data.pipelineCoverage.toFixed(0)}%) não cobre a meta. 
                    É recomendado ter pelo menos 3x a meta em pipeline (300% coverage) para previsibilidade saudável.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
