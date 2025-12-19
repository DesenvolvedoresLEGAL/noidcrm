import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSalesMetrics, PeriodMetrics } from '@/hooks/useSalesMetrics';
import { DollarSign, Clock, Trophy, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

function MetricCard({ title, value, subtitle, icon, trend, trendValue }: MetricCardProps) {
  return (
    <Card className="bg-background/50">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {icon}
              {title}
            </div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${
              trend === 'up' ? 'text-emerald-600' : 
              trend === 'down' ? 'text-red-500' : 
              'text-muted-foreground'
            }`}>
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              {trend === 'stable' && <Minus className="h-3 w-3" />}
              {trendValue}
            </div>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function PeriodMetricsDisplay({ metrics, compareWith }: { metrics: PeriodMetrics; compareWith?: PeriodMetrics }) {
  const calcTrend = (current: number, previous: number): { trend: 'up' | 'down' | 'stable'; value: string } => {
    if (!previous || previous === 0) return { trend: 'stable', value: '' };
    const diff = ((current - previous) / previous) * 100;
    if (diff > 5) return { trend: 'up', value: `+${diff.toFixed(0)}%` };
    if (diff < -5) return { trend: 'down', value: `${diff.toFixed(0)}%` };
    return { trend: 'stable', value: '~' };
  };

  const ticketTrend = compareWith ? calcTrend(metrics.averageTicket, compareWith.averageTicket) : undefined;
  const cycleTrend = compareWith ? calcTrend(metrics.salesCycle, compareWith.salesCycle) : undefined;
  const winRateTrend = compareWith ? calcTrend(metrics.winRate, compareWith.winRate) : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        title="Ticket Médio"
        value={formatCurrency(metrics.averageTicket)}
        subtitle={`${metrics.totalSales} vendas realizadas`}
        icon={<DollarSign className="h-4 w-4" />}
        trend={ticketTrend?.trend}
        trendValue={ticketTrend?.value}
      />
      <MetricCard
        title="Ciclo de Vendas"
        value={`${metrics.salesCycle} dias`}
        subtitle="Média da criação até fechamento"
        icon={<Clock className="h-4 w-4" />}
        trend={cycleTrend?.trend === 'up' ? 'down' : cycleTrend?.trend === 'down' ? 'up' : 'stable'}
        trendValue={cycleTrend?.value}
      />
      <MetricCard
        title="Win Rate"
        value={`${metrics.winRate.toFixed(1)}%`}
        subtitle={`${metrics.totalSales} ganhas de ${metrics.totalOpportunities} total`}
        icon={<Trophy className="h-4 w-4" />}
        trend={winRateTrend?.trend}
        trendValue={winRateTrend?.value}
      />
    </div>
  );
}

export function SalesMetricsDashboard() {
  const { currentMonth, lastMonth, last3Months, last6Months, last12Months, ytd, isLoading } = useSalesMetrics();

  if (isLoading) {
    return (
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando métricas...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Dashboard de Métricas de Vendas
              <Badge variant="secondary" className="text-xs font-normal">Consolidado</Badge>
            </CardTitle>
            <CardDescription>
              Acompanhe ticket médio, ciclo de vendas e win rate por período
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="current" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="current" className="text-xs">Mês Atual</TabsTrigger>
            <TabsTrigger value="last" className="text-xs">Mês Anterior</TabsTrigger>
            <TabsTrigger value="3m" className="text-xs">3 Meses</TabsTrigger>
            <TabsTrigger value="6m" className="text-xs">6 Meses</TabsTrigger>
            <TabsTrigger value="12m" className="text-xs">12 Meses</TabsTrigger>
            <TabsTrigger value="ytd" className="text-xs">YTD</TabsTrigger>
          </TabsList>

          <TabsContent value="current">
            <PeriodMetricsDisplay metrics={currentMonth} compareWith={lastMonth} />
          </TabsContent>

          <TabsContent value="last">
            <PeriodMetricsDisplay metrics={lastMonth} />
          </TabsContent>

          <TabsContent value="3m">
            <PeriodMetricsDisplay metrics={last3Months} compareWith={last6Months} />
          </TabsContent>

          <TabsContent value="6m">
            <PeriodMetricsDisplay metrics={last6Months} compareWith={last12Months} />
          </TabsContent>

          <TabsContent value="12m">
            <PeriodMetricsDisplay metrics={last12Months} />
          </TabsContent>

          <TabsContent value="ytd">
            <PeriodMetricsDisplay metrics={ytd} />
          </TabsContent>
        </Tabs>

        {/* Summary Row */}
        <div className="mt-6 pt-4 border-t flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-muted-foreground">Receita YTD:</span>
              <span className="ml-2 font-semibold">{formatCurrency(ytd.totalRevenue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vendas YTD:</span>
              <span className="ml-2 font-semibold">{ytd.totalSales}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Comparação vs período anterior quando disponível
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
