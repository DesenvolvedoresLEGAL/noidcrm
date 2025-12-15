import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { ForecastKPIs } from '@/hooks/useForecastData';
import { BarChart3 } from 'lucide-react';
import { formatCurrencyFull } from '@/lib/i18n';

interface ForecastWaterfallChartProps {
  kpis: ForecastKPIs;
}


export function ForecastWaterfallChart({ kpis }: ForecastWaterfallChartProps) {
  const data = [
    {
      name: 'Fechado',
      value: kpis.closedRevenue,
      fill: 'hsl(var(--primary))',
    },
    {
      name: 'Commit',
      value: kpis.commitForecast,
      fill: 'hsl(142 76% 36%)', // green
    },
    {
      name: 'Best Case',
      value: kpis.bestCaseForecast,
      fill: 'hsl(217 91% 60%)', // blue
    },
    {
      name: 'Pipeline Total',
      value: kpis.closedRevenue + kpis.totalPipeline,
      fill: 'hsl(var(--muted-foreground))',
    },
  ];

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Progressão de Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={formatCurrencyFull}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [formatCurrencyFull(value), 'Valor']}
            />
            <ReferenceLine 
              y={kpis.goal} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="5 5"
              label={{ 
                value: `Meta: ${formatCurrencyFull(kpis.goal)}`, 
                position: 'right',
                fill: 'hsl(var(--destructive))',
                fontSize: 11,
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary" />
            <span className="text-muted-foreground">Fechado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142 76% 36%)' }} />
            <span className="text-muted-foreground">Commit (≥70%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(217 91% 60%)' }} />
            <span className="text-muted-foreground">Best Case (≥50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted-foreground" />
            <span className="text-muted-foreground">Pipeline Total</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-destructive" style={{ borderStyle: 'dashed' }} />
            <span className="text-muted-foreground">Meta</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
