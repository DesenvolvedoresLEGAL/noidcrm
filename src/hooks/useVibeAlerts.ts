import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VibeAlert {
  id: string;
  organization_id: string;
  opportunity_id: string;
  user_id: string;
  alert_type: 'energy_drop' | 'silence_warning' | 'hot_timing' | 'vibe_break_risk' | 'ready_to_close' | 'needs_nurturing' | 'objection_pattern' | 'engagement_spike';
  title: string;
  message: string;
  recommendation: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  trigger_data: any;
  status: 'active' | 'acknowledged' | 'dismissed' | 'acted';
  acknowledged_at: string | null;
  dismissed_at: string | null;
  acted_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function useVibeAlerts(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['vibe-alerts', opportunityId],
    queryFn: async (): Promise<VibeAlert[]> => {
      if (!opportunityId) return [];
      
      const { data, error } = await supabase
        .from('vibe_alerts')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as VibeAlert[];
    },
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

export function useActiveVibeAlertsCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['vibe-alerts-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      const { count, error } = await supabase
        .from('vibe_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 minuto
  });
}

export function useUpdateVibeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      alertId, 
      status 
    }: { 
      alertId: string; 
      status: 'acknowledged' | 'dismissed' | 'acted';
    }) => {
      const updateData: any = { status };
      
      if (status === 'acknowledged') updateData.acknowledged_at = new Date().toISOString();
      if (status === 'dismissed') updateData.dismissed_at = new Date().toISOString();
      if (status === 'acted') updateData.acted_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('vibe_alerts')
        .update(updateData)
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vibe-alerts', data.opportunity_id] });
      queryClient.invalidateQueries({ queryKey: ['vibe-alerts-count'] });
    },
  });
}
