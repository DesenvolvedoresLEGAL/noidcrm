import { Bell, BellOff, BellRing, AlertTriangle, Monitor } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications, type PushState } from "@/hooks/usePushNotifications";

export function PushNotificationOptIn() {
  const { state, subscribe, unsubscribe, isRegistering } = usePushNotifications();

  // Don't show in unsupported or preview environments
  if (state === "loading" || state === "unsupported" || state === "preview") {
    return null;
  }

  if (state === "subscribed") {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <BellRing className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Alertas do navegador ativos</p>
              <p className="text-xs text-muted-foreground">
                Você receberá notificações mesmo em outra aba
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={unsubscribe} className="text-xs">
            Desativar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "denied") {
    return (
      <Card className="border-destructive/20">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-full bg-destructive/10">
            <BellOff className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium">Notificações bloqueadas</p>
            <p className="text-xs text-muted-foreground">
              Acesse as configurações do navegador para permitir notificações deste site
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // state === "prompt"
  return (
    <Card className="border-accent/30 bg-gradient-to-r from-accent/5 to-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-accent/10 shrink-0 mt-0.5">
            <Bell className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold">Ative alertas em tempo real</p>
              <Badge variant="secondary" className="text-[10px] px-1.5">Novo</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Receba notificações no desktop quando um cliente visualizar sua proposta, 
              responder ou quando uma atividade crítica estiver atrasada — mesmo em outra aba.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={subscribe}
                disabled={isRegistering}
                className="gap-1.5 text-xs"
              >
                <BellRing className="h-3.5 w-3.5" />
                {isRegistering ? "Ativando..." : "Ativar alertas"}
              </Button>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Monitor className="h-3 w-3" />
                Funciona em todas as abas
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
