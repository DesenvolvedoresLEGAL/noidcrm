import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOTEMonthlyResults } from '@/hooks/useOTEData';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, History } from 'lucide-react';

export function OTEHistoryTab() {
  const { data: allResults, isLoading } = useOTEMonthlyResults();

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Group by period
  const periodData = (allResults || []).reduce((acc, result) => {
    if (!acc[result.period_month]) {
      acc[result.period_month] = {
        period: result.period_month,
        totalVariable: 0,
        totalSales: 0,
        totalGoal: 0,
        sellers: 0,
        avgAchievement: 0,
      };
    }
    acc[result.period_month].totalVariable += result.final_variable_amount;
    acc[result.period_month].totalSales += result.total_sales;
    acc[result.period_month].totalGoal += result.goal_amount;
    acc[result.period_month].sellers += 1;
    acc[result.period_month].avgAchievement += result.achievement_percentage;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(periodData)
    .map((p: any) => ({
      ...p,
      avgAchievement: p.avgAchievement / p.sellers,
      periodLabel: format(parseISO(p.period + '-01'), 'MMM/yy', { locale: ptBR }),
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-12);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>Nenhum histórico de OTE disponível.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Variable Amount Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução do Variável Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodLabel" fontSize={12} />
              <YAxis tickFormatter={formatCurrency} fontSize={12} />
              <Tooltip 
                formatter={(value: number) => [
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                  'Variável'
                ]}
                labelFormatter={(label) => `Período: ${label}`}
              />
              <Bar dataKey="totalVariable" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Achievement Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Tendência de Atingimento de Meta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodLabel" fontSize={12} />
              <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} fontSize={12} />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Média %']}
                labelFormatter={(label) => `Período: ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="avgAchievement" 
                name="% Meta (média)" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Historical Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico Consolidado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Período</th>
                  <th className="text-right py-3 px-2">Vendedores</th>
                  <th className="text-right py-3 px-2">Meta Total</th>
                  <th className="text-right py-3 px-2">Vendas Total</th>
                  <th className="text-right py-3 px-2">% Média</th>
                  <th className="text-right py-3 px-2">Variável Total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.reverse().map((row) => (
                  <tr key={row.period} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{row.periodLabel}</td>
                    <td className="py-3 px-2 text-right">{row.sellers}</td>
                    <td className="py-3 px-2 text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.totalGoal)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.totalSales)}
                    </td>
                    <td className="py-3 px-2 text-right">{row.avgAchievement.toFixed(1)}%</td>
                    <td className="py-3 px-2 text-right font-semibold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.totalVariable)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
