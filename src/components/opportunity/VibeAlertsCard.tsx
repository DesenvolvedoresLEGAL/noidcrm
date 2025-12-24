import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Bell,
  Check,
  X,
  Zap,
  TrendingDown,
  Clock,
  Target,
  Heart,
  Flame,
  Volume2,
} from 'lucide-react';
import { useVibeAlerts, useUpdateVibeAlert, VibeAlert } from '@/hooks/useVibeAlerts';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VibeAlertsCardProps {
  opportunityId: string;
}

const ALERT_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string }> = {
  energy_drop: { icon: TrendingDown, color: 'text-blue-500' },
  silence_warning: { icon: Clock, color: 'text-yellow-500' },
  hot_timing: { icon: Flame, color: 'text-orange-500' },
  vibe_break_risk: { icon: AlertTriangle, color: 'text-red-500' },
  ready_to_close: { icon: Target, color: 'text-green-500' },
  needs_nurturing: { icon: Heart, color: 'text-pink-500' },
  objection_pattern: { icon: Volume2, color: 'text-purple-500' },
  engagement_spike: { icon: Zap, color: 'text-yellow-500' },
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'border-l-muted-foreground/30',
  medium: 'border-l-yellow-500',
  high: 'border-l-orange-500',
  critical: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
};

export function VibeAlertsCard({ opportunityId }: VibeAlertsCardProps) {
  const { data: alerts, isLoading } = useVibeAlerts(opportunityId);
  const updateAlert = useUpdateVibeAlert();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Alertas de Vibe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Alertas de Vibe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum alerta ativo</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Alertas de Vibe
            <Badge variant="secondary" className="ml-1">
              {alerts.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => {
          const config = ALERT_CONFIG[alert.alert_type] || { icon: Bell, color: 'text-muted-foreground' };
          const Icon = config.icon;
          
          return (
            <div
              key={alert.id}
              className={cn(
                "p-3 rounded-lg border-l-4 bg-card",
                PRIORITY_STYLES[alert.priority]
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{alert.title}</span>
                    {alert.priority === 'critical' && (
                      <Badge variant="destructive" className="text-[10px] h-4">
                        Crítico
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{alert.message}</p>
                  {alert.recommendation && (
                    <p className="text-xs text-primary italic">💡 {alert.recommendation}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateAlert.mutate({ alertId: alert.id, status: 'acted' })}
                        title="Marcar como resolvido"
                      >
                        <Check className="h-3 w-3 text-green-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateAlert.mutate({ alertId: alert.id, status: 'dismissed' })}
                        title="Dispensar"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
