import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface SellerProductivityChartProps {
  data: { name: string; winRate: number; revenue: number; deals: number }[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
};

export function SellerProductivityChart({ data }: SellerProductivityChartProps) {
  const chartData = data.slice(0, 8).map(d => ({
    ...d,
    shortName: d.name.split(' ')[0]
  }));

  const avgWinRate = data.length > 0 
    ? data.reduce((sum, d) => sum + d.winRate, 0) / data.length 
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Taxa de Fechamento por Vendedor</CardTitle>
        <span className="text-sm text-muted-foreground">
          Média: {avgWinRate.toFixed(0)}%
        </span>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Nenhum vendedor com dados
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="shortName" 
                tick={{ fontSize: 11 }}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'winRate') return [`${value.toFixed(0)}%`, 'Taxa de Conversão'];
                  return [value, name];
                }}
                labelFormatter={(label) => `Vendedor: ${label}`}
              />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.winRate >= avgWinRate ? 'hsl(142, 76%, 36%)' : 'hsl(var(--muted-foreground))'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
