import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Phone, 
  Eye, 
  Mail, 
  Download, 
  MessageSquare,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Alert {
  id: string;
  type: "proposal_viewed" | "lead_response" | "next_step";
  message: string;
  timestamp: string;
}

interface RepQuickActionsProps {
  alerts?: Alert[];
}

export function RepQuickActions({ alerts = [] }: RepQuickActionsProps) {
  const navigate = useNavigate();

  // Mock alerts for demonstration - in production, these would come from real-time data
  const mockAlerts: Alert[] = [
    {
      id: "1",
      type: "proposal_viewed",
      message: "Cliente XYZ visualizou sua proposta",
      timestamp: "há 5 min",
    },
    {
      id: "2",
      type: "next_step",
      message: "IA sugere: Ligar para Lead ABC hoje",
      timestamp: "agora",
    },
  ];

  const displayAlerts = alerts.length > 0 ? alerts : mockAlerts.slice(0, 2);

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "proposal_viewed":
        return Eye;
      case "lead_response":
        return Mail;
      case "next_step":
        return Sparkles;
      default:
        return MessageSquare;
    }
  };

  const getAlertColor = (type: Alert["type"]) => {
    switch (type) {
      case "proposal_viewed":
        return "text-green-500";
      case "lead_response":
        return "text-blue-500";
      case "next_step":
        return "text-purple-500";
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
        {displayAlerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Alertas em Tempo Real
            </p>
            <div className="space-y-2">
              {displayAlerts.map((alert) => {
                const Icon = getAlertIcon(alert.type);
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Icon className={`h-4 w-4 mt-0.5 ${getAlertColor(alert.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{alert.message}</p>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
