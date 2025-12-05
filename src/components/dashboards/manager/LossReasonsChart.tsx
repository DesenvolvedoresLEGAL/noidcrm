import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { XCircle } from "lucide-react";

interface LossReasonsChartProps {
  data: ManagerDashboardData["lossReasons"];
}

const COLORS = ["#EF4444", "#F97316", "#F59E0B", "#84CC16", "#06B6D4", "#8B5CF6"];

export function LossReasonsChart({ data }: LossReasonsChartProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  const chartData = data.slice(0, 6).map((item, index) => ({
    name: item.reason,
    value: item.count,
    amount: item.value,
    color: COLORS[index % COLORS.length],
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500" />
          Causas das Perdas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Nenhuma perda registrada
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value} (${formatCurrency(props.payload.amount)})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {chartData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{item.value}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({Math.round((item.value / total) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
