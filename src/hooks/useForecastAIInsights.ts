import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIInsightFactor {
  type: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface AIInsightRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
}

export interface ForecastAIInsights {
  reasoning: string;
  confidence: number;
  factors: AIInsightFactor[];
  recommendations: AIInsightRecommendation[];
  scenarios?: {
    pessimistic: number;
    realistic: number;
    optimistic: number;
  };
}

interface Params {
  organizationId?: string | null;
  pipelineId?: string;
  enabled?: boolean;
}

export function useForecastAIInsights({ organizationId, pipelineId, enabled = true }: Params) {
  return useQuery<ForecastAIInsights>({
    queryKey: ['forecast-ai-insights', organizationId, pipelineId],
    queryFn: async () => {
      // Resolve org if not provided
      let orgId = organizationId;
      if (!orgId) {
        const { data } = await supabase.rpc('get_user_organization_id');
        orgId = data as string | null;
      }
      if (!orgId) throw new Error('Organization not found');

      const { data, error } = await supabase.functions.invoke('generate-forecast-prediction', {
        body: {
          organization_id: orgId,
          pipeline_id: pipelineId,
          forecast_type: 'monthly',
        },
      });

      if (error) throw error;
      const f = data?.forecast || {};
      return {
        reasoning: f.aiReasoning || '',
        confidence: f.confidence ?? 70,
        factors: Array.isArray(f.factors) ? f.factors : [],
        recommendations: Array.isArray(f.recommendations) ? f.recommendations : [],
        scenarios: f.scenarios,
      };
    },
    enabled: enabled && !!(organizationId !== null),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
