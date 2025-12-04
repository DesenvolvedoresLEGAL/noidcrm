import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  Eye, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  X,
  Share2,
  Radio
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getProposalAlerts, markAlertAsRead, ProposalAlert } from '@/services/crm/proposal-analytics';
import { cn } from '@/lib/utils';

interface ProposalAlertsCardProps {
  proposalId: string;
}

const alertTypeConfig: Record<ProposalAlert['alert_type'], { icon: any; color: string }> = {
  high_engagement: { icon: TrendingUp, color: 'text-green-500' },
  price_focus: { icon: DollarSign, color: 'text-yellow-500' },
  multiple_views: { icon: Eye, color: 'text-blue-500' },
  long_session: { icon: Clock, color: 'text-purple-500' },
  stale_proposal: { icon: AlertTriangle, color: 'text-orange-500' },
  pending_approval: { icon: CheckCircle, color: 'text-cyan-500' },
  forwarded: { icon: Share2, color: 'text-indigo-500' },
  viewing_now: { icon: Radio, color: 'text-red-500' },
};

const severityColors: Record<ProposalAlert['severity'], string> = {
  info: 'bg-blue-500/10 border-blue-500/20',
  warning: 'bg-yellow-500/10 border-yellow-500/20',
  success: 'bg-green-500/10 border-green-500/20',
  critical: 'bg-red-500/10 border-red-500/20',
};

export function ProposalAlertsCard({ proposalId }: ProposalAlertsCardProps) {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['proposal-alerts', proposalId],
    queryFn: () => getProposalAlerts(proposalId),
    enabled: !!proposalId,
    refetchInterval: 60000, // Refresh every minute
  });

  const markReadMutation = useMutation({
    mutationFn: markAlertAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-alerts', proposalId] });
    },
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;

  if (!proposalId) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Alertas Inteligentes
          </CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5">
              {unreadCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Carregando alertas...
          </p>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum alerta detectado.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Alertas são gerados automaticamente com base no comportamento do cliente.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[250px]">
            <div className="space-y-2">
              {alerts.map(alert => {
                const config = alertTypeConfig[alert.alert_type];
                const AlertIcon = config.icon;
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'p-3 rounded-lg border transition-opacity',
                      severityColors[alert.severity],
                      alert.is_read && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('p-1.5 rounded-full bg-background', config.color)}>
                        <AlertIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{alert.title}</p>
                          {!alert.is_read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => markReadMutation.mutate(alert.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(alert.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
