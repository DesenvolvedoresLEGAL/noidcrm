import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Phone, 
  Eye, 
  Download, 
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Clock,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRepAlerts, RepAlert } from "@/hooks/useRepAlerts";

export function RepQuickActions() {
  const navigate = useNavigate();
  const { data: alerts, isLoading } = useRepAlerts();

  const getAlertIcon = (type: RepAlert["type"]) => {
    switch (type) {
      case "proposal_viewed":
        return Eye;
      case "activity_overdue":
        return Clock;
      case "next_step":
        return Sparkles;
      case "opportunity_stale":
        return AlertTriangle;
      default:
        return MessageSquare;
    }
  };

  const getAlertColor = (type: RepAlert["type"]) => {
    switch (type) {
      case "proposal_viewed":
        return "text-green-500";
      case "activity_overdue":
        return "text-destructive";
      case "next_step":
        return "text-purple-500";
      case "opportunity_stale":
        return "text-amber-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="default" 
            size="sm" 
            className="gap-2"
            onClick={() => navigate("/app/opportunities?action=new")}
          >
            <FileText className="h-4 w-4" />
            Nova Oportunidade
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => navigate("/app/activities?action=new")}
          >
            <Phone className="h-4 w-4" />
            Registrar Atividade
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => navigate("/app/accounts?action=new")}
          >
            <Download className="h-4 w-4" />
            Nova Conta
          </Button>
        </div>

        {/* Real-time Alerts */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Alertas em Tempo Real
          </p>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : alerts && alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert) => {
                const Icon = getAlertIcon(alert.type);
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => {
                      if (alert.entityType === "opportunity" && alert.entityId) {
                        navigate(`/app/opportunities/${alert.entityId}`);
                      } else if (alert.entityType === "activity") {
                        navigate("/app/activities");
                      } else if (alert.entityType === "proposal" && alert.entityId) {
                        navigate(`/app/proposals/${alert.entityId}`);
                      }
                    }}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 ${getAlertColor(alert.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">{alert.timestamp}</p>
                    </div>
                    {alert.type === "next_step" && (
                      <Badge variant="secondary" className="shrink-0">
                        <Sparkles className="h-3 w-3 mr-1" />
                        IA
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Nenhum alerta no momento
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
