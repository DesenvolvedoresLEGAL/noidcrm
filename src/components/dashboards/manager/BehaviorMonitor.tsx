import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { Activity, Phone, AlertTriangle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface BehaviorMonitorProps {
  data: ManagerDashboardData["behaviorMonitor"];
}

export function BehaviorMonitor({ data }: BehaviorMonitorProps) {
  const getActivityStatus = (count: number) => {
    if (count >= 10) return { label: "Ativo", variant: "default" as const, color: "text-green-500" };
    if (count >= 5) return { label: "Moderado", variant: "secondary" as const, color: "text-yellow-500" };
    if (count > 0) return { label: "Baixo", variant: "outline" as const, color: "text-orange-500" };
    return { label: "Inativo", variant: "destructive" as const, color: "text-red-500" };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Monitor de Comportamento do Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((member) => {
            const status = getActivityStatus(member.activitiesLogged);
            return (
              <div
                key={member.userId}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{member.name}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Activity className={cn("h-3 w-3", status.color)} />
                      <span>{member.activitiesLogged} atividades</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <span>{member.callsMade} ligações</span>
                    </div>
                    {member.dealsAbandoned > 0 && (
                      <div className="flex items-center gap-1 text-red-500">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{member.dealsAbandoned} abandonados</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {member.lastActivity
                        ? formatDistanceToNow(new Date(member.lastActivity), {
                            locale: ptBR,
                            addSuffix: true,
                          })
                        : "Sem atividade"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum membro do time encontrado
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
