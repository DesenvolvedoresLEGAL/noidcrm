import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';
import { EmptyState } from '@/components/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';

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

interface DailyData {
  date: string;
  displayDate: string;
  count: number;
  value: number;
  accumulated_count: number;
  accumulated_value: number;
}

export function AccumulatedOpportunities() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates, comparativePeriod } = useReportFiltersContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'accumulated-opportunities', visibleUserIds, effectiveDates, filters.pipelines],
    queryFn: async () => {
      // Get opportunities for the current period
      let query = supabase
        .from('opportunities')
        .select('id, created_at, valor_previsto, owner_user_id, pipeline_id')
        .gte('created_at', effectiveDates.startDate)
        .lte('created_at', effectiveDates.endDate + 'T23:59:59');

      if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        query = query.in('owner_user_id', visibleUserIds);
      }

      if (filters.pipelines.length > 0) {
        query = query.in('pipeline_id', filters.pipelines);
      }

      const { data: currentPeriod, error: currentError } = await query.order('created_at', { ascending: true });
      if (currentError) throw currentError;

      // Get comparative period data
      let compQuery = supabase
        .from('opportunities')
        .select('id, created_at, valor_previsto, owner_user_id, pipeline_id')
        .gte('created_at', comparativePeriod.startDate)
        .lte('created_at', comparativePeriod.endDate + 'T23:59:59');

      if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        compQuery = compQuery.in('owner_user_id', visibleUserIds);
      }

      if (filters.pipelines.length > 0) {
        compQuery = compQuery.in('pipeline_id', filters.pipelines);
      }

      const { data: compPeriod } = await compQuery;

      // Process current period data by day
      const dailyMap = new Map<string, { count: number; value: number }>();
      
      (currentPeriod || []).forEach(opp => {
        const date = opp.created_at.split('T')[0];
        const existing = dailyMap.get(date) || { count: 0, value: 0 };
        dailyMap.set(date, {
          count: existing.count + 1,
          value: existing.value + (opp.valor_previsto || 0),
        });
      });

      // Build accumulated data
      let accumulatedCount = 0;
      let accumulatedValue = 0;
      
      const sortedDates = Array.from(dailyMap.keys()).sort();
      const chartData: DailyData[] = sortedDates.map(date => {
        const dayData = dailyMap.get(date)!;
        accumulatedCount += dayData.count;
        accumulatedValue += dayData.value;
        
        return {
          date,
          displayDate: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          count: dayData.count,
          value: dayData.value,
          accumulated_count: accumulatedCount,
          accumulated_value: accumulatedValue,
        };
      });

      // Calculate totals
      const totalCount = currentPeriod?.length || 0;
      const totalValue = currentPeriod?.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) || 0;
      const compTotalCount = compPeriod?.length || 0;
      const compTotalValue = compPeriod?.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) || 0;

      const countChange = compTotalCount > 0 ? ((totalCount - compTotalCount) / compTotalCount) * 100 : 0;
      const valueChange = compTotalValue > 0 ? ((totalValue - compTotalValue) / compTotalValue) * 100 : 0;

      return {
        chartData,
        totalCount,
        totalValue,
        compTotalCount,
        compTotalValue,
        countChange,
        valueChange,
        avgDailyCount: chartData.length > 0 ? totalCount / chartData.length : 0,
        avgDailyValue: chartData.length > 0 ? totalValue / chartData.length : 0,
      };
    },
    enabled: !visibilityLoading,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Erro ao carregar dados"
        description="Não foi possível carregar os dados acumulados."
      />
    );
  }

  if (data.chartData.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Nenhuma oportunidade no período"
        description="Crie oportunidades para visualizar o histórico acumulado."
      />
    );
  }

  const ChangeIndicator = ({ value }: { value: number }) => {
    if (value > 0) return <ArrowUp className="h-4 w-4 text-emerald-500" />;
    if (value < 0) return <ArrowDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Oportunidades</p>
                <p className="text-2xl font-bold">{data.totalCount}</p>
              </div>
              <div className="flex items-center gap-1">
                <ChangeIndicator value={data.countChange} />
                <span className={`text-xs ${data.countChange > 0 ? 'text-emerald-500' : data.countChange < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {Math.abs(data.countChange).toFixed(1)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Período anterior: {data.compTotalCount}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold">{formatCurrency(data.totalValue)}</p>
              </div>
              <div className="flex items-center gap-1">
                <ChangeIndicator value={data.valueChange} />
                <span className={`text-xs ${data.valueChange > 0 ? 'text-emerald-500' : data.valueChange < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {Math.abs(data.valueChange).toFixed(1)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Período anterior: {formatCurrency(data.compTotalValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-muted-foreground">Média Diária (Qtd)</p>
              <p className="text-2xl font-bold">{data.avgDailyCount.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-muted-foreground">Média Diária (Valor)</p>
              <p className="text-xl font-bold">{formatCurrency(data.avgDailyValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accumulated Value Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Evolução Acumulada de Valor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis 
                  tickFormatter={(v) => formatCompact(v)}
                  tick={{ fontSize: 10 }} 
                  className="fill-muted-foreground"
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'accumulated_value' ? formatCurrency(value) : value,
                    name === 'accumulated_value' ? 'Valor Acumulado' : 'Quantidade Acumulada'
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="accumulated_value" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary)/0.2)" 
                  strokeWidth={2}
                  name="Valor Acumulado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Daily Count Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Oportunidades por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip 
                  formatter={(value: number, name: string) => [value, name === 'count' ? 'Novas' : 'Acumulado']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Novas por dia"
                />
                <Line 
                  type="monotone" 
                  dataKey="accumulated_count" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                  name="Acumulado"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
