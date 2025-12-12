import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DailyBriefing {
  id: string;
  organization_id: string;
  user_id: string;
  briefing_date: string;
  briefing_type: string;
  summary: string;
  priority_actions: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    opportunity_id?: string;
  }>;
  hot_opportunities: Array<{
    id: string;
    title: string;
    value: number;
    temperature: string;
  }>;
  at_risk_deals: Array<{
    id: string;
    title: string;
    value: number;
    days_since_contact?: number;
  }>;
  coaching_insights: Array<{
    seller: string;
    insight: string;
    action: string;
  }>;
  strategic_recommendations: Array<{
    area: string;
    insight: string;
  }>;
  team_highlights: Array<{
    name: string;
    xp?: number;
    level?: number;
  }>;
  created_at: string;
}

export function useDailyBriefing(briefingType?: 'owner' | 'manager' | 'sales') {
  const { data: briefing, isLoading, error, refetch } = useQuery({
    queryKey: ['daily-briefing', briefingType],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('daily-briefing-generator', {
        body: briefingType ? { briefingType } : {}
      });

      if (error) {
        console.error('Error fetching daily briefing:', error);
        throw error;
      }

      return data as DailyBriefing;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  });

  return {
    briefing,
    isLoading,
    error,
    refetch
  };
}
