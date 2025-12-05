import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { RepDashboardData } from "@/hooks/useRepDashboard";

interface RepPipelineChartProps {
  data: RepDashboardData["pipelineByStage"];
}

export function RepPipelineChart({ data }: RepPipelineChartProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
    return `R$${value}`;
  };

  const chartData = data.map((stage) => ({
    name: stage.stageName,
    value: stage.value,
    count: stage.count,
    color: stage.color,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Pipeline por Etapa</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Nenhuma oportunidade no pipeline
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" tickFormatter={formatCurrency} fontSize={12} />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100} 
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Valor"]}
                labelFormatter={(label) => {
                  const stage = chartData.find((s) => s.name === label);
                  return `${label} (${stage?.count || 0} opps)`;
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
