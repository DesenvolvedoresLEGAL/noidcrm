import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { vibeKeys } from '@/lib/query-keys';

export interface VibeAlert {
  id: string;
  organization_id: string;
  entity_id: string | null;
  entity_type: string | null;
  user_id: string;
  alert_type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata: any;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function useVibeAlerts(opportunityId: string | undefined) {
  return useQuery({
    queryKey: vibeKeys.alertsByOpportunity(opportunityId),
    queryFn: async (): Promise<VibeAlert[]> => {
      if (!opportunityId) return [];
      
      const { data, error } = await supabase
        .from('ai_alerts')
        .select('*')
        .eq('entity_id', opportunityId)
        .eq('entity_type', 'opportunity')
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
    queryKey: vibeKeys.alertsCount(userId),
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
      status: 'acknowledged' | 'resolved';
    }) => {
      const updateData: any = { status };
      
      if (status === 'acknowledged') updateData.acknowledged_at = new Date().toISOString();
      if (status === 'resolved') updateData.resolved_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('ai_alerts')
        .update(updateData)
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vibeKeys.alertsByOpportunity(data.entity_id) });
      queryClient.invalidateQueries({ queryKey: vibeKeys.alertsCountAll() });
    },
  });
}
