import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Info, TrendingUp, Clock } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const lastUpdated = new Date().toLocaleString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <CardTitle className="text-base">Histórico de Receita (12 meses)</CardTitle>
            <span className="text-xs text-muted-foreground">Dados reais de vendas fechadas</span>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground ml-1" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  Este gráfico mostra a receita realizada nos últimos 12 meses. 
                  Todos os valores são de negócios efetivamente fechados (status: won).
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {lastUpdated}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Total: {formatCurrency(totalRevenue)}
          </Badge>
        </div>
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
                name === 'value' ? 'Receita Realizada' : 'Negócios'
              ]}
              labelFormatter={(label) => `Mês: ${label}`}
            />
            <ReferenceLine 
              y={monthlyGoal} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="5 5"
              label={{ value: 'Meta Mensal', position: 'right', fontSize: 10 }}
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
        <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
          Receita Realizada (dados históricos reais)
        </p>
      </CardContent>
    </Card>
  );
}
