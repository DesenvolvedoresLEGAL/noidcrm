import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGeneralOverviewData } from '@/hooks/useReportsData';
import { BarChart3, TrendingUp, TrendingDown, Target, DollarSign, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { EmptyState } from '@/components/EmptyState';

interface GeneralOverviewProps {
  data?: any;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function GeneralOverview({ data }: GeneralOverviewProps) {
  const { data: reportData, isLoading, error } = useGeneralOverviewData();

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

  if (error || !reportData) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Erro ao carregar dados"
        description="Não foi possível carregar os dados do relatório."
      />
    );
  }

  const { kpis, pipelineMetrics } = reportData;

  // Check if there's any data
  if (kpis.totalDeals === 0 && pipelineMetrics.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nenhum dado disponível"
        description="Os relatórios serão gerados automaticamente conforme você usar o CRM e adicionar oportunidades."
      />
    );
  }

  const kpiCards = [
    {
      title: 'Pipeline Total',
      value: formatCurrency(kpis.totalValue),
      icon: DollarSign,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Receita Fechada',
      value: formatCurrency(kpis.wonValue),
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Deals Ativos',
      value: kpis.activeDeals.toString(),
      icon: Target,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Taxa de Conversão',
      value: `${kpis.avgWinRate.toFixed(1)}%`,
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  const pipelineChartData = pipelineMetrics
    .filter(p => p.pipeline_type === 'sales')
    .map(p => ({
      name: p.pipeline_name.length > 15 ? p.pipeline_name.substring(0, 15) + '...' : p.pipeline_name,
      valor: p.total_value,
      ganhos: p.won_count,
      perdidos: p.lost_count,
      ativos: p.active_count,
    }));

  const statusPieData = [
    { name: 'Ganhos', value: kpis.wonDeals, color: 'hsl(var(--chart-2))' },
    { name: 'Perdidos', value: kpis.lostDeals, color: 'hsl(var(--chart-1))' },
    { name: 'Em Aberto', value: kpis.activeDeals, color: 'hsl(var(--chart-3))' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.title}</p>
                  <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pipeline por Valor */}
        {pipelineChartData.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Valor por Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis 
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} 
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
                    <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Distribuição de Status */}
        {statusPieData.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Distribuição de Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {statusPieData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pipeline Metrics Table */}
      {pipelineMetrics.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Métricas por Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Pipeline</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ganhos</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Perdidos</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineMetrics.map((p, i) => (
                    <tr key={p.pipeline_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{p.pipeline_name}</td>
                      <td className="text-right py-2 px-3">{p.total_opportunities}</td>
                      <td className="text-right py-2 px-3">{formatCurrency(p.total_value)}</td>
                      <td className="text-right py-2 px-3 text-emerald-500">{p.won_count}</td>
                      <td className="text-right py-2 px-3 text-destructive">{p.lost_count}</td>
                      <td className="text-right py-2 px-3">
                        <span className={p.win_rate >= 30 ? 'text-emerald-500' : 'text-amber-500'}>
                          {p.win_rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
