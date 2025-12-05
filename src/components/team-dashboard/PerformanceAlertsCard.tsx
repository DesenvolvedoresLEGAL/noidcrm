import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Bell, 
  AlertTriangle, 
  Trophy, 
  TrendingDown,
  PartyPopper,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface Alert {
  id: string;
  type: 'warning' | 'celebration' | 'critical';
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  message: string;
  metric: string;
  value: number;
  target: number;
  timestamp: Date;
}

interface SellerMetrics {
  id: string;
  name: string;
  avatar_url?: string;
  goal_progress: number;
  won_value: number;
}

interface PerformanceAlertsCardProps {
  teamMembers: SellerMetrics[];
  teamGoal: number;
}

export function PerformanceAlertsCard({ teamMembers, teamGoal }: PerformanceAlertsCardProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    generateAlerts();
  }, [teamMembers, teamGoal]);

  const generateAlerts = () => {
    const newAlerts: Alert[] = [];
    const individualGoal = teamGoal / Math.max(teamMembers.length, 1);

    teamMembers.forEach((member) => {
      // Critical: Below 30% of goal
      if (member.goal_progress < 30) {
        newAlerts.push({
          id: `critical-${member.id}`,
          type: 'critical',
          sellerId: member.id,
          sellerName: member.name,
          sellerAvatar: member.avatar_url,
          message: `${member.name} está significativamente abaixo da meta`,
          metric: 'Meta',
          value: member.won_value,
          target: individualGoal,
          timestamp: new Date()
        });
      }
      // Warning: Between 30% and 60% of goal
      else if (member.goal_progress < 60) {
        newAlerts.push({
          id: `warning-${member.id}`,
          type: 'warning',
          sellerId: member.id,
          sellerName: member.name,
          sellerAvatar: member.avatar_url,
          message: `${member.name} precisa de atenção para atingir a meta`,
          metric: 'Meta',
          value: member.won_value,
          target: individualGoal,
          timestamp: new Date()
        });
      }
      // Celebration: Reached or exceeded goal
      else if (member.goal_progress >= 100) {
        newAlerts.push({
          id: `celebration-${member.id}`,
          type: 'celebration',
          sellerId: member.id,
          sellerName: member.name,
          sellerAvatar: member.avatar_url,
          message: `🎉 ${member.name} atingiu a meta!`,
          metric: 'Meta',
          value: member.won_value,
          target: individualGoal,
          timestamp: new Date()
        });
      }
    });

    // Sort: celebrations first, then critical, then warnings
    newAlerts.sort((a, b) => {
      const order = { celebration: 0, critical: 1, warning: 2 };
      return order[a.type] - order[b.type];
    });

    setAlerts(newAlerts);
  };

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const celebrate = (sellerName: string) => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    toast.success(`Parabéns ${sellerName}! Meta atingida! 🎉`);
  };

  const createNotification = async (alert: Alert) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get organization_id
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      await supabase.from('notifications').insert({
        user_id: alert.sellerId,
        organization_id: membership.organization_id,
        type: alert.type === 'celebration' ? 'achievement' : 'alert',
        title: alert.type === 'celebration' ? '🎉 Meta Atingida!' : '⚠️ Alerta de Performance',
        message: alert.message,
        metadata: {
          metric: alert.metric,
          value: alert.value,
          target: alert.target
        }
      });

      toast.success('Notificação enviada ao vendedor');
    } catch (error) {
      console.error('Error creating notification:', error);
      toast.error('Erro ao enviar notificação');
    }
  };

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'celebration': return PartyPopper;
      case 'critical': return TrendingDown;
      case 'warning': return AlertTriangle;
    }
  };

  const getAlertColors = (type: Alert['type']) => {
    switch (type) {
      case 'celebration': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950';
      case 'critical': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      case 'warning': return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950';
    }
  };

  const getIconColors = (type: Alert['type']) => {
    switch (type) {
      case 'celebration': return 'text-green-600';
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas de Performance
          </CardTitle>
          {visibleAlerts.length > 0 && (
            <Badge variant="secondary">
              {visibleAlerts.length} alerta{visibleAlerts.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {visibleAlerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum alerta no momento</p>
            <p className="text-xs">Todos os vendedores estão no caminho certo!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleAlerts.map((alert) => {
              const Icon = getAlertIcon(alert.type);
              
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${getAlertColors(alert.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${getIconColors(alert.type)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={alert.sellerAvatar} />
                          <AvatarFallback className="text-xs">
                            {alert.sellerName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{alert.sellerName}</span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.message}
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {alert.metric}: R$ {alert.value.toLocaleString('pt-BR')} / R$ {alert.target.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">
                          {((alert.value / alert.target) * 100).toFixed(0)}%
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {alert.type === 'celebration' ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => celebrate(alert.sellerName)}
                          >
                            <PartyPopper className="h-3 w-3 mr-1" />
                            Celebrar
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => createNotification(alert)}
                          >
                            <Bell className="h-3 w-3 mr-1" />
                            Notificar
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      <X className="h-4 w-4" />
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
