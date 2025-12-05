import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, AlertTriangle, TrendingDown, Target, Clock, CheckCircle, Eye, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useActiveAlerts, useAcknowledgeAlert, useResolveAlert, useDismissAlert } from '@/hooks/useAISupervision';
import { getAlertTypeLabel } from '@/services/crm/ai-supervision';
import { useNavigate } from 'react-router-dom';

const alertIcons: Record<string, React.ReactNode> = {
  high_value_risk: <TrendingDown className="h-4 w-4 text-red-500" />,
  exception: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  imminent_close: <Target className="h-4 w-4 text-green-500" />,
  performance_below: <TrendingDown className="h-4 w-4 text-yellow-500" />,
  escalation: <Clock className="h-4 w-4 text-purple-500" />,
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

export function AIAlertsCard() {
  const navigate = useNavigate();
  const { data: alerts, isLoading } = useActiveAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();
  const dismissAlert = useDismissAlert();

  const handleViewEntity = (alert: typeof alerts[0]) => {
    if (alert.entity_type === 'opportunity' && alert.entity_id) {
      navigate(`/app/opportunities/${alert.entity_id}`);
    } else if (alert.entity_type === 'account' && alert.entity_id) {
      navigate(`/app/accounts/${alert.entity_id}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-500" />
          Alertas Inteligentes
        </CardTitle>
        <CardDescription>
          Situações que requerem atenção humana
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : alerts && alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {alertIcons[alert.alert_type] || <Bell className="h-4 w-4" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{alert.title}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs text-white ${priorityColors[alert.priority]}`}
                          >
                            {alert.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Alert Metadata */}
                  {alert.metadata && Object.keys(alert.metadata as object).length > 0 && (
                    <div className="p-2 rounded bg-muted/50 text-sm space-y-1">
                      {(alert.metadata as Record<string, unknown>).deal_value && (
                        <p>Valor: R$ {Number((alert.metadata as Record<string, unknown>).deal_value).toLocaleString('pt-BR')}</p>
                      )}
                      {(alert.metadata as Record<string, unknown>).days_stale && (
                        <p>Dias estagnado: {String((alert.metadata as Record<string, unknown>).days_stale)}</p>
                      )}
                      {(alert.metadata as Record<string, unknown>).close_probability && (
                        <p>Probabilidade: {String((alert.metadata as Record<string, unknown>).close_probability)}%</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {alert.entity_id && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewEntity(alert)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    )}
                    <Button 
                      size="sm"
                      onClick={() => acknowledgeAlert.mutate(alert.id)}
                      disabled={acknowledgeAlert.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Reconhecer
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => resolveAlert.mutate(alert.id)}
                      disabled={resolveAlert.isPending}
                    >
                      Resolver
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => dismissAlert.mutate(alert.id)}
                      disabled={dismissAlert.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mb-3 text-green-500" />
              <p className="font-medium">Nenhum alerta ativo</p>
              <p className="text-sm">Tudo funcionando normalmente</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
