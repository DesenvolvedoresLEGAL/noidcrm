import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { Clock } from "lucide-react";

interface PipelineAgingChartProps {
  data: ManagerDashboardData["pipelineAging"];
}

const COLORS = ["#22C55E", "#84CC16", "#F59E0B", "#F97316", "#EF4444"];

export function PipelineAgingChart({ data }: PipelineAgingChartProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
    return `R$${value}`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Pipeline Aging
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.every((d) => d.count === 0) ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Nenhuma oportunidade no pipeline
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data}>
                <XAxis dataKey="range" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value} opps (${formatCurrency(props.payload.value)})`,
                    "Quantidade",
                  ]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
              {data.map((item, index) => (
                <div key={item.range}>
                  <div
                    className="w-full h-1 rounded mb-1"
                    style={{ backgroundColor: COLORS[index] }}
                  />
                  <span className="text-muted-foreground">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
