import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, TrendingUp, TrendingDown, Users, 
  ArrowUpRight, AlertCircle, CheckCircle, Bell
} from 'lucide-react';
import { useSeatAlerts, SeatAlert } from '@/hooks/useSeatAlerts';
import { useState } from 'react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const alertConfig = {
  expansion: {
    icon: ArrowUpRight,
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
  },
  high_growth: {
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
  },
  new_revenue: {
    icon: TrendingUp,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500',
  },
  churn_risk: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500',
  },
  contraction_warning: {
    icon: TrendingDown,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500',
  },
};

const severityConfig = {
  critical: { badge: 'destructive' as const, label: 'Crítico' },
  warning: { badge: 'outline' as const, label: 'Alerta' },
  success: { badge: 'default' as const, label: 'Oportunidade' },
  info: { badge: 'secondary' as const, label: 'Info' },
};

export function SeatAlertsCard() {
  const { data: alerts, isLoading } = useSeatAlerts();
  const [filter, setFilter] = useState<'all' | 'critical' | 'opportunities'>('all');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="space-y-3">
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredAlerts = (alerts || []).filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'critical') return alert.severity === 'critical' || alert.severity === 'warning';
    if (filter === 'opportunities') return alert.type === 'high_growth' || alert.type === 'new_revenue';
    return true;
  });

  const criticalCount = (alerts || []).filter(a => a.severity === 'critical').length;
  const opportunityCount = (alerts || []).filter(a => a.type === 'high_growth' || a.type === 'new_revenue').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Alertas de Revenue</CardTitle>
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
              </Badge>
            )}
            {opportunityCount > 0 && (
              <Badge variant="default" className="gap-1 bg-green-500">
                <ArrowUpRight className="h-3 w-3" />
                {opportunityCount} oportunidade{opportunityCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todos ({alerts?.length || 0})
          </Button>
          <Button
            variant={filter === 'critical' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setFilter('critical')}
          >
            Críticos
          </Button>
          <Button
            variant={filter === 'opportunities' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('opportunities')}
            className={filter === 'opportunities' ? 'bg-green-500 hover:bg-green-600' : ''}
          >
            Oportunidades
          </Button>
        </div>

        {/* Alerts list */}
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>Nenhum alerta encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const config = alertConfig[alert.type];
              const Icon = config.icon;
              const sevConfig = severityConfig[alert.severity];

              return (
                <div
                  key={alert.id}
                  className={`border-l-4 ${config.borderColor} rounded-lg p-4 ${config.bgColor}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{alert.title}</h4>
                          <Badge variant={sevConfig.badge} className="text-xs">
                            {sevConfig.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        
                        {/* Metrics */}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                          {alert.metrics.mrr !== undefined && (
                            <span className="bg-background/50 px-2 py-1 rounded">
                              MRR: {formatCurrency(alert.metrics.mrr)}
                            </span>
                          )}
                          {alert.metrics.active_seats !== undefined && (
                            <span className="bg-background/50 px-2 py-1 rounded">
                              Seats: {alert.metrics.active_seats}
                            </span>
                          )}
                          {alert.metrics.delta_mrr !== undefined && (
                            <span className={`px-2 py-1 rounded ${alert.metrics.delta_mrr < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              Δ MRR: {formatCurrency(alert.metrics.delta_mrr)}
                            </span>
                          )}
                          {alert.metrics.consecutive_changes !== undefined && alert.metrics.consecutive_changes > 1 && (
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">
                              {alert.metrics.consecutive_changes} mudanças
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      {alert.action}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
