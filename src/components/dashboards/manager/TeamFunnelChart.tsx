import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";

interface TeamFunnelChartProps {
  data: ManagerDashboardData["teamFunnel"];
}

const FUNNEL_STAGES = [
  { key: "leads", label: "Leads", color: "#6366F1" },
  { key: "opportunities", label: "Oportunidades", color: "#8B5CF6" },
  { key: "proposals", label: "Propostas", color: "#A855F7" },
  { key: "won", label: "Ganhos", color: "#22C55E" },
];

export function TeamFunnelChart({ data }: TeamFunnelChartProps) {
  const maxValue = Math.max(data.leads, data.opportunities, data.proposals, data.won, 1);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Funil da Equipe</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {FUNNEL_STAGES.map((stage, index) => {
            const value = data[stage.key as keyof typeof data];
            const prevValue = index > 0 ? data[FUNNEL_STAGES[index - 1].key as keyof typeof data] : value;
            const conversionRate = prevValue > 0 ? Math.round((value / prevValue) * 100) : 0;
            const widthPercentage = (value / maxValue) * 100;

            return (
              <div key={stage.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{value}</span>
                    {index > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({conversionRate}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-500 flex items-center justify-center"
                    style={{
                      width: `${widthPercentage}%`,
                      backgroundColor: stage.color,
                      minWidth: value > 0 ? "40px" : "0",
                    }}
                  >
                    <span className="text-xs font-medium text-white">{value}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Conversão Lead → Venda</span>
            <span className="font-bold text-primary">
              {data.leads > 0 ? Math.round((data.won / data.leads) * 100) : 0}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
