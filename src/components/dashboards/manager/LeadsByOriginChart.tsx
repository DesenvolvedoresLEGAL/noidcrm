import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { Users } from "lucide-react";

interface LeadsByOriginChartProps {
  data: ManagerDashboardData["leadsByOrigin"];
}

const COLORS = ["#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E"];

export function LeadsByOriginChart({ data }: LeadsByOriginChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Leads por Origem
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-muted-foreground">
            Nenhum lead registrado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" fontSize={10} tickLine={false} />
              <YAxis
                type="category"
                dataKey="origin"
                width={80}
                fontSize={10}
                tickLine={false}
                tickFormatter={(value) =>
                  value.length > 12 ? `${value.slice(0, 12)}...` : value
                }
              />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
