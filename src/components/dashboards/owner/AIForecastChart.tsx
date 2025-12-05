import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface AIForecastChartProps {
  forecast: {
    pessimistic: number;
    realistic: number;
    optimistic: number;
    confidence: number;
  };
  yearlyGoal: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
};

const COLORS = {
  pessimistic: 'hsl(var(--destructive))',
  realistic: 'hsl(var(--primary))',
  optimistic: 'hsl(142, 76%, 36%)'
};

export function AIForecastChart({ forecast, yearlyGoal }: AIForecastChartProps) {
  const data = [
    { scenario: 'Pessimista', value: forecast.pessimistic, color: COLORS.pessimistic },
    { scenario: 'Realista', value: forecast.realistic, color: COLORS.realistic },
    { scenario: 'Otimista', value: forecast.optimistic, color: COLORS.optimistic },
  ];

  const goalAchievement = Math.round((forecast.realistic / yearlyGoal) * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-base">Previsão Trimestral AI</CardTitle>
        </div>
        <Badge variant={goalAchievement >= 100 ? "default" : "secondary"}>
          {goalAchievement}% da meta
        </Badge>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis 
              type="number" 
              tickFormatter={(value) => formatCurrency(value)}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              dataKey="scenario" 
              type="category" 
              width={80}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), 'Previsão']}
            />
            <ReferenceLine 
              x={yearlyGoal} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="5 5"
              label={{ value: 'Meta', position: 'top', fontSize: 10 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Confiança do modelo: {forecast.confidence}%
        </p>
      </CardContent>
    </Card>
  );
}
