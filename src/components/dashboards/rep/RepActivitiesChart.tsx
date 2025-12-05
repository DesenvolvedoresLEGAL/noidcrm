import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { RepDashboardData } from "@/hooks/useRepDashboard";
import { Phone, Mail, Calendar, MessageCircle } from "lucide-react";

interface RepActivitiesChartProps {
  data: RepDashboardData["weeklyActivities"];
}

const ACTIVITY_CONFIG = [
  { key: "calls", label: "Ligações", color: "#3B82F6", icon: Phone },
  { key: "emails", label: "E-mails", color: "#10B981", icon: Mail },
  { key: "meetings", label: "Reuniões", color: "#8B5CF6", icon: Calendar },
  { key: "whatsapp", label: "WhatsApp", color: "#22C55E", icon: MessageCircle },
];

export function RepActivitiesChart({ data }: RepActivitiesChartProps) {
  const chartData = ACTIVITY_CONFIG.map((config) => ({
    name: config.label,
    value: data[config.key as keyof typeof data] || 0,
    color: config.color,
  })).filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Atividades da Semana</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Nenhuma atividade registrada
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {ACTIVITY_CONFIG.map((config) => {
                const Icon = config.icon;
                const value = data[config.key as keyof typeof data] || 0;
                return (
                  <div key={config.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{config.label}</span>
                    </div>
                    <span className="text-sm font-semibold">{value}</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-bold">{total}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
