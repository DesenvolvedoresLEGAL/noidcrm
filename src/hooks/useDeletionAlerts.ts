import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';

interface DeletionAlert {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  entity_title: string | null;
  deleted_by: string | null;
  deleted_by_name: string | null;
  alert_reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_read: boolean;
  read_by: string | null;
  read_at: string | null;
  created_at: string;
}

export function useDeletionAlerts(organizationId?: string) {
  const queryClient = useQueryClient();
  // Sprint PERF 0.2 — exige organizationId. Sem org → nenhuma query, nenhum WS.
  // Evita canal realtime global e queries com `is_read=false` sem filtro de tenant.
  const enabled = !!organizationId;

  // Fetch unread alerts
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['deletion-alerts', organizationId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deletion_alerts')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching deletion alerts:', error);
        throw error;
      }

      return data as DeletionAlert[];
    },
  });

  // Mark alert as read
  const markAsReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('deletion_alerts')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-alerts'] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      let query = supabase
        .from('deletion_alerts')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('is_read', false);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-alerts'] });
      toast.success('Todos os alertas foram marcados como lidos');
    },
  });

  // Subscribe to realtime updates — só com organizationId e canal filtrado por tenant.
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`deletion-alerts-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deletion_alerts',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newAlert = payload.new as DeletionAlert;

          // Show toast for high/critical severity
          if (newAlert.severity === 'high' || newAlert.severity === 'critical') {
            toast.warning('Alerta de exclusão crítica', {
              description: `${newAlert.entity_title || newAlert.entity_type} foi deletado por ${newAlert.deleted_by_name || 'usuário desconhecido'}`,
              duration: 10000,
            });
          }

          // Invalidate query to refetch
          queryClient.invalidateQueries({ queryKey: ['deletion-alerts', organizationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high').length;

  return {
    alerts,
    unreadCount,
    criticalCount,
    isLoading,
    refetch,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
  };
}
