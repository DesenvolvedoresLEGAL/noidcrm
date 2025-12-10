import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PieChart } from "lucide-react";

interface PipelineSnapshotChartProps {
  data: { stage: string; avgDays: number; dropRate: number; value: number }[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(340, 82%, 52%)',
];

export function PipelineSnapshotChart({ data }: PipelineSnapshotChartProps) {
  // Transform data for horizontal bar chart
  const chartData = data.map((item, index) => ({
    name: item.stage.length > 15 ? item.stage.substring(0, 15) + '...' : item.stage,
    fullName: item.stage,
    value: item.value,
    color: COLORS[index % COLORS.length],
  }));

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          Pipeline Snapshot por Estágio
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Valor total: {formatCurrency(totalValue)}
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum dado de pipeline disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis 
                type="number" 
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 10 }}
                width={100}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Valor']}
                labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
