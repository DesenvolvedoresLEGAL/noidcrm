import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Brain, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLossCategoryLabel } from '@/utils/category-labels';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';

interface LossReasonsTrendChartProps {
  losses: Array<{
    opportunity?: {
      created_at?: string;
    };
    reason?: { name: string } | null;
    reason_seller?: string;
  }>;
  isLoading: boolean;
  semantic?: LossSemanticAggregates;
}

type ViewMode = 'declared' | 'inferred';

const COLORS = ['hsl(var(--destructive))', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

export function LossReasonsTrendChart({ losses, isLoading, semantic }: LossReasonsTrendChartProps) {
  const [mode, setMode] = useState<ViewMode>('declared');
  const hasInferred = !!semantic && semantic.rows.length > 0;

  // Group losses by month and reason
  const trendData = (() => {
    if (!losses || losses.length === 0) return [];

    const monthlyData: Record<string, Record<string, number>> = {};
    const reasonSet = new Set<string>();

    losses.forEach(loss => {
      const date = loss.opportunity?.created_at;
      if (!date) return;

      const month = new Date(date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const reason = (loss.reason as any)?.name || loss.reason_seller || 'Não informado';
      
      if (!monthlyData[month]) monthlyData[month] = {};
      monthlyData[month][reason] = (monthlyData[month][reason] || 0) + 1;
      reasonSet.add(reason);
    });

    // Get top 5 reasons overall
    const reasonTotals: Record<string, number> = {};
    Object.values(monthlyData).forEach(monthData => {
      Object.entries(monthData).forEach(([reason, count]) => {
        reasonTotals[reason] = (reasonTotals[reason] || 0) + count;
      });
    });

    const topReasons = Object.entries(reasonTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason);

    // Convert to chart data
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
      const partsA = a.split('/');
      const partsB = b.split('/');
      const yearA = parseInt(`20${partsA[1] || '00'}`, 10);
      const yearB = parseInt(`20${partsB[1] || '00'}`, 10);
      const dateA = new Date(yearA, getMonthIndex(partsA[0]));
      const dateB = new Date(yearB, getMonthIndex(partsB[0]));
      return dateA.getTime() - dateB.getTime();
    });

    return sortedMonths.slice(-6).map(month => {
      const entry: Record<string, any> = { month };
      topReasons.forEach(reason => {
        entry[reason] = monthlyData[month][reason] || 0;
      });
      return entry;
    });
  })();

  const topReasons = trendData.length > 0 
    ? Object.keys(trendData[0]).filter(k => k !== 'month')
    : [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (trendData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Tendência de Motivos de Perda
          </CardTitle>
          <CardDescription>Evolução mensal dos motivos de perda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Dados insuficientes para exibir tendência</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Tendência de Motivos de Perda
        </CardTitle>
        <CardDescription>Evolução mensal dos principais motivos de perda</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {topReasons.map((reason, index) => (
              <Line
                key={reason}
                type="monotone"
                dataKey={reason}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function getMonthIndex(monthAbbr: string): number {
  const months: Record<string, number> = {
    'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
  };
  return months[monthAbbr.toLowerCase()] || 0;
}
