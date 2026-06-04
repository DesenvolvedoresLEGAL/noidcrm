import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { opportunityKeys, forecastKeys } from '@/lib/query-keys';

export interface ForecastPrediction {
  id: string;
  organization_id: string;
  opportunity_id: string | null;
  prediction_type: 'win_probability' | 'close_date' | 'value' | 'health';
  prediction_source: 'ai_model' | 'human' | 'algorithmic';
  model_version: string | null;
  predicted_value: number;
  confidence_level: number | null;
  confidence_interval_low: number | null;
  confidence_interval_high: number | null;
  evidence_factors: EvidenceFactor[];
  actual_value: number | null;
  was_accurate: boolean | null;
  error_value: number | null;
  error_percentage: number | null;
  pipeline_id: string | null;
  stage_id: string | null;
  predicted_at: string;
  outcome_recorded_at: string | null;
}

export interface EvidenceFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  source: 'graph' | 'memory' | 'behavior' | 'history';
  description: string;
}

export interface AccuracyMetrics {
  organization_id: string;
  prediction_type: string;
  prediction_source: string;
  total_predictions: number;
  predictions_with_outcome: number;
  mean_absolute_error: number | null;
  mean_percentage_error: number | null;
  error_std_dev: number | null;
  mae_high_confidence: number | null;
  mae_low_confidence: number | null;
  ai_accuracy_rate: number | null;
  human_accuracy_rate: number | null;
  recent_mae: number | null;
}

export function useForecastPredictions(opportunityId?: string) {
  return useQuery({
    queryKey: forecastKeys.predictions(opportunityId),
    queryFn: async () => {
      let query = supabase
        .from('forecast_predictions')
        .select('*')
        .order('predicted_at', { ascending: false });

      if (opportunityId) {
        query = query.eq('opportunity_id', opportunityId);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        evidence_factors: (d.evidence_factors || []) as unknown as EvidenceFactor[]
      })) as ForecastPrediction[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useForecastAccuracyMetrics(pipelineId?: string, userId?: string) {
  return useQuery({
    queryKey: forecastKeys.accuracyMetrics(pipelineId, userId),
    queryFn: async () => {
      let query = supabase
        .from('forecast_accuracy_metrics')
        .select('*');

      // Note: forecast_accuracy_metrics is a view, filtering by pipeline/user would require
      // modifying the view or filtering the underlying data
      
      const { data, error } = await query;
      if (error) throw error;
      return data as AccuracyMetrics[];
    },
    enabled: !!pipelineId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalculateExplainableProbability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opportunityId: string) => {
      const { data, error } = await supabase.functions.invoke('calculate-explainable-probability', {
        body: { opportunityId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, opportunityId) => {
      queryClient.invalidateQueries({ queryKey: forecastKeys.predictions(opportunityId) });
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      toast.success(`Probabilidade calculada: ${data.probability}%`);
    },
    onError: (error) => {
      console.error('Error calculating probability:', error);
      toast.error('Erro ao calcular probabilidade');
    }
  });
}

export function useRecordHumanPrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opportunityId,
      predictionType,
      predictedValue,
      pipelineId,
      stageId
    }: {
      opportunityId: string;
      predictionType: 'win_probability' | 'value';
      predictedValue: number;
      pipelineId?: string;
      stageId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('forecast_predictions')
        .insert({
          organization_id: profile.organization_id,
          opportunity_id: opportunityId,
          prediction_type: predictionType,
          prediction_source: 'human',
          predicted_value: predictedValue,
          confidence_level: 0.7,
          evidence_factors: [{ factor: 'human_judgment', impact: 'neutral', weight: 1, source: 'behavior', description: 'Previsão manual do vendedor' }],
          pipeline_id: pipelineId,
          stage_id: stageId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { opportunityId }) => {
      queryClient.invalidateQueries({ queryKey: forecastKeys.predictions(opportunityId) });
      toast.success('Previsão registrada');
    },
    onError: () => {
      toast.error('Erro ao registrar previsão');
    }
  });
}

export function useAccuracyComparison(pipelineId?: string, userId?: string) {
  return useQuery({
    queryKey: forecastKeys.accuracyComparison(pipelineId, userId),
    queryFn: async () => {
      let query = supabase
        .from('forecast_predictions')
        .select('prediction_source, was_accurate, predicted_at, pipeline_id, opportunity_id')
        .not('was_accurate', 'is', null)
        .order('predicted_at', { ascending: true });

      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // If userId filter is set, we need to filter by opportunity owner
      let filteredData = data || [];
      if (userId && filteredData.length > 0) {
        const oppIds = [...new Set(filteredData.map(d => d.opportunity_id).filter(Boolean))];
        if (oppIds.length > 0) {
          const { data: opps } = await supabase
            .from('opportunities')
            .select('id')
            .eq('owner_user_id', userId)
            .in('id', oppIds as string[]);
          
          const userOppIds = new Set(opps?.map(o => o.id) || []);
          filteredData = filteredData.filter(d => d.opportunity_id && userOppIds.has(d.opportunity_id));
        }
      }

      // Group by month and source
      const grouped: Record<string, { ai: { correct: number; total: number }; human: { correct: number; total: number } }> = {};

      for (const pred of filteredData) {
        const month = pred.predicted_at.substring(0, 7);
        if (!grouped[month]) {
          grouped[month] = {
            ai: { correct: 0, total: 0 },
            human: { correct: 0, total: 0 }
          };
        }

        const source = pred.prediction_source === 'ai_model' ? 'ai' : 'human';
        grouped[month][source].total++;
        if (pred.was_accurate) {
          grouped[month][source].correct++;
        }
      }

      return Object.entries(grouped).map(([month, data]) => ({
        month,
        aiAccuracy: data.ai.total > 0 ? (data.ai.correct / data.ai.total) * 100 : null,
        humanAccuracy: data.human.total > 0 ? (data.human.correct / data.human.total) * 100 : null,
        aiTotal: data.ai.total,
        humanTotal: data.human.total
      }));
    },
    enabled: !!pipelineId,
    staleTime: 5 * 60 * 1000,
  });
}
