import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { Phone, Mail, Calendar, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityHeatmapProps {
  data: ManagerDashboardData["activityHeatmap"];
}

const ACTIVITY_TYPES = [
  { key: "calls", label: "Ligações", icon: Phone, color: "bg-blue-500" },
  { key: "emails", label: "E-mails", icon: Mail, color: "bg-green-500" },
  { key: "meetings", label: "Reuniões", icon: Calendar, color: "bg-purple-500" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "bg-emerald-500" },
];

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const maxActivity = Math.max(...data.map((d) => d.total), 1);

  const getIntensity = (value: number) => {
    const ratio = value / maxActivity;
    if (ratio >= 0.8) return "bg-green-500";
    if (ratio >= 0.6) return "bg-green-400";
    if (ratio >= 0.4) return "bg-yellow-400";
    if (ratio >= 0.2) return "bg-orange-400";
    if (value > 0) return "bg-red-400";
    return "bg-muted";
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Heatmap de Atividades (7 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left pb-2 font-medium">Vendedor</th>
                {ACTIVITY_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <th key={type.key} className="pb-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-normal text-muted-foreground hidden md:block">
                          {type.label}
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th className="text-center pb-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((member) => (
                <tr key={member.userId} className="border-t">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[100px]">{member.name.split(" ")[0]}</span>
                    </div>
                  </td>
                  {ACTIVITY_TYPES.map((type) => {
                    const value = member[type.key as keyof typeof member] as number;
                    return (
                      <td key={type.key} className="py-2 text-center">
                        <div
                          className={cn(
                            "mx-auto w-8 h-8 rounded flex items-center justify-center text-xs font-medium",
                            value > 0 ? "text-white" : "text-muted-foreground",
                            getIntensity(value)
                          )}
                        >
                          {value}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2 text-center">
                    <span className="font-semibold">{member.total}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma atividade registrada esta semana
          </p>
        )}
        
        <div className="mt-4 pt-4 border-t flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-400" />
            <span>Baixo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-400" />
            <span>Médio</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Alto</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
