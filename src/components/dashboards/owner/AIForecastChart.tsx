import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Info } from "lucide-react";
import { ForecastConfidenceResult } from "@/services/crm/forecastConfidence";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AIForecastChartProps {
  forecast: {
    pessimistic: number;
    realistic: number;
    optimistic: number;
    confidence: ForecastConfidenceResult;
    period: 'annual';
    periodLabel: string;
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
          <div className="flex flex-col">
            <CardTitle className="text-base">Previsão Anual AI</CardTitle>
            <span className="text-xs text-muted-foreground">{forecast.periodLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", forecast.confidence.color, forecast.confidence.bgColor)}
                >
                  {forecast.confidence.score}% {forecast.confidence.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs font-medium mb-1">Metodologia de Confiança:</p>
                <p className="text-xs text-muted-foreground">{forecast.confidence.methodology}</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          <Badge variant={goalAchievement >= 100 ? "default" : "secondary"}>
            {goalAchievement}% da meta
          </Badge>
        </div>
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
        <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>Dados atualizados em tempo real • Período: {forecast.periodLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
