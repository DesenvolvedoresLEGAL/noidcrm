import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUpdateVibeAlert } from '@/hooks/useVibeAlerts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Clock, 
  AlertTriangle,
  ExternalLink,
  Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VibeAlert {
  id: string;
  entity_id: string | null;
  user_id: string;
  alert_type: string;
  title: string;
  message: string;
  metadata: any;
  priority: string;
  status: string;
  created_at: string;
  opportunity?: {
    title: string;
    account?: {
      razao_social: string;
    };
  } | null;
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgente', color: 'bg-red-500', icon: AlertTriangle },
  high: { label: 'Alta', color: 'bg-orange-500', icon: Zap },
  critical: { label: 'Crítico', color: 'bg-red-500', icon: AlertTriangle },
  medium: { label: 'Média', color: 'bg-amber-500', icon: Clock },
  low: { label: 'Baixa', color: 'bg-blue-500', icon: Bell }
};

export function VibeAlertsListCard() {
  const navigate = useNavigate();
  const { profile } = useCurrentUser();
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const updateAlert = useUpdateVibeAlert();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['all-vibe-alerts', profile?.id, statusFilter],
    queryFn: async () => {
      if (!profile?.id) return [];

      let query = supabase
        .from('ai_alerts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('entity_type', 'opportunity')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: alertsData, error } = await query;
      if (error) throw error;
      
      // Fetch opportunity details for each alert
      const opportunityIds = [...new Set(alertsData?.map(a => a.entity_id).filter(Boolean) || [])];
      
      if (opportunityIds.length > 0) {
        const { data: opportunities } = await supabase
          .from('opportunities')
          .select('id, title, account:accounts(razao_social)')
          .in('id', opportunityIds);
        
        const opportunityMap = new Map(opportunities?.map(o => [o.id, o]) || []);
        
        return (alertsData || []).map(alert => ({
          ...alert,
          opportunity: alert.entity_id ? opportunityMap.get(alert.entity_id) : null
        })) as VibeAlert[];
      }
      
      return (alertsData || []).map(alert => ({ ...alert, opportunity: null })) as VibeAlert[];
    },
    enabled: !!profile?.id
  });

  const handleAcknowledge = async (alertId: string) => {
    await updateAlert.mutateAsync({ alertId, status: 'acknowledged' });
  };

  const handleDismiss = async (alertId: string) => {
    await updateAlert.mutateAsync({ alertId, status: 'resolved' });
  };

  const handleAct = async (alertId: string, entityId: string | null) => {
    if (!entityId) return;
    await updateAlert.mutateAsync({ alertId, status: 'resolved' });
    navigate(`/app/opportunities/${entityId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas de Vibe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Alertas de Vibe
            </CardTitle>
            <CardDescription>
              Notificações sobre mudanças de estado emocional dos seus leads
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="acknowledged">Reconhecidos</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!alerts || alerts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum alerta {statusFilter === 'active' ? 'ativo' : ''} encontrado.</p>
            <p className="text-sm">
              Os alertas aparecem quando há mudanças importantes nos seus deals.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const priorityConfig = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.medium;
              const PriorityIcon = priorityConfig.icon;

              return (
                <div
                  key={alert.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${priorityConfig.color}/10`}>
                        <PriorityIcon className={`h-4 w-4 text-${priorityConfig.color.replace('bg-', '')}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {alert.alert_type}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${priorityConfig.color} text-white`}
                          >
                            {priorityConfig.label}
                          </Badge>
                          {alert.status !== 'active' && (
                            <Badge variant="outline" className="text-xs">
                              {alert.status === 'acknowledged' && 'Reconhecido'}
                              {alert.status === 'resolved' && 'Resolvido'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">
                          {alert.opportunity?.title || 'Oportunidade'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.opportunity?.account?.razao_social}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(alert.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                      </div>
                    </div>

                    {alert.status === 'active' && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          title="Reconhecer"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(alert.id)}
                          title="Dispensar"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAct(alert.id, alert.entity_id)}
                          className="gap-1"
                          disabled={!alert.entity_id}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver
                        </Button>
                      </div>
                    )}
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
