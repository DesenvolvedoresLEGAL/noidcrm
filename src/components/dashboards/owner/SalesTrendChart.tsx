import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface SalesTrendChartProps {
  data: { month: string; value: number; count: number }[];
  yearlyGoal: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
};

export function SalesTrendChart({ data, yearlyGoal }: SalesTrendChartProps) {
  const totalRevenue = data.reduce((sum, d) => sum + d.value, 0);
  const monthlyGoal = yearlyGoal / 12;

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Tendência de Vendas (12 meses)</CardTitle>
        <span className="text-sm font-medium text-muted-foreground">
          Total: {formatCurrency(totalRevenue)}
        </span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis 
              tick={{ fontSize: 11 }} 
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'value' ? 'Receita' : 'Negócios'
              ]}
              labelFormatter={(label) => `Mês: ${label}`}
            />
            <ReferenceLine 
              y={monthlyGoal} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="5 5"
              label={{ value: 'Meta', position: 'right', fontSize: 10 }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--primary))" 
              fillOpacity={1}
              fill="url(#colorRevenue)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
