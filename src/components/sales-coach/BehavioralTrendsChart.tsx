import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { TrendData } from '@/services/sales-coach/coach';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BehavioralTrendsChartProps {
  trends: TrendData[];
}

export function BehavioralTrendsChart({ trends }: BehavioralTrendsChartProps) {
  const chartData = trends.map(t => ({
    ...t,
    formattedDate: format(parseISO(t.date), 'dd/MM', { locale: ptBR }),
  }));

  if (chartData.length < 2) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução de Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          Complete mais treinos para ver sua evolução ao longo do tempo
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolução de Performance
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            Últimos 30 dias
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              domain={[0, 10]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)}/10`, 'Score']}
              labelFormatter={(label) => `Data: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="avgScore"
              stroke="hsl(var(--primary))"
              fill="url(#scoreGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
