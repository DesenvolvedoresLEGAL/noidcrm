import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HealthDriver {
  id: string;
  organization_id: string;
  opportunity_id: string;
  driver_name: string;
  driver_category: 'engagement' | 'velocity' | 'relationship' | 'behavior';
  driver_source: 'graph' | 'memory' | 'behavior' | 'activity' | 'history';
  current_value: number;
  benchmark_value: number | null;
  impact_score: number;
  impact_direction: 'positive' | 'negative' | 'neutral';
  evidence_description: string;
  evidence_data: Record<string, any> | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  suggested_playbook_id: string | null;
  remediation_priority: 'critical' | 'high' | 'medium' | 'low' | null;
  created_at: string;
  updated_at: string;
}

export function useHealthDrivers(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['health-drivers', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];

      const { data, error } = await supabase
        .from('health_score_drivers')
        .select(`
          *,
          ai_playbooks:suggested_playbook_id (id, name, category)
        `)
        .eq('opportunity_id', opportunityId)
        .order('impact_score', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as (HealthDriver & { ai_playbooks?: { id: string; name: string; category: string } })[];
    },
    enabled: !!opportunityId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCalculateHealthDrivers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opportunityId: string) => {
      const { data, error } = await supabase.functions.invoke('calculate-health-drivers', {
        body: { opportunityId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, opportunityId) => {
      queryClient.invalidateQueries({ queryKey: ['health-drivers', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast.success(`Health Score: ${data.healthScore}`);
    },
    onError: () => {
      toast.error('Erro ao calcular health drivers');
    }
  });
}

export function useCriticalDrivers() {
  return useQuery({
    queryKey: ['critical-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_score_drivers')
        .select(`
          *,
          opportunities:opportunity_id (id, title, valor_previsto, owner_user_id, profiles:owner_user_id (full_name))
        `)
        .eq('remediation_priority', 'critical')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useDriversByCategory(opportunityId: string | undefined) {
  const { data: drivers, ...rest } = useHealthDrivers(opportunityId);

  const groupedDrivers = {
    engagement: drivers?.filter(d => d.driver_category === 'engagement') || [],
    velocity: drivers?.filter(d => d.driver_category === 'velocity') || [],
    relationship: drivers?.filter(d => d.driver_category === 'relationship') || [],
    behavior: drivers?.filter(d => d.driver_category === 'behavior') || [],
  };

  const categoryScores = {
    engagement: calculateCategoryScore(groupedDrivers.engagement),
    velocity: calculateCategoryScore(groupedDrivers.velocity),
    relationship: calculateCategoryScore(groupedDrivers.relationship),
    behavior: calculateCategoryScore(groupedDrivers.behavior),
  };

  return {
    drivers,
    groupedDrivers,
    categoryScores,
    ...rest
  };
}

function calculateCategoryScore(drivers: HealthDriver[]): number {
  if (drivers.length === 0) return 50;
  
  const totalImpact = drivers.reduce((sum, d) => sum + d.impact_score, 0);
  // Base score of 50, modified by impacts (which range from -100 to +100)
  return Math.max(0, Math.min(100, 50 + totalImpact / drivers.length));
}
