import { useQuery } from '@tanstack/react-query';
import { fetchDailyMetrics, fetchMetricsSummary, fetchOutcomes, type MetricsFilters } from '@/services/ai-agents/metricsService';
import { aiAgentKeys } from '@/lib/query-keys';

export function useEmailAgentMetrics(filters: MetricsFilters | null) {
  return useQuery({
    queryKey: aiAgentKeys.emailMetrics(filters),
    queryFn: () => fetchDailyMetrics(filters!),
    enabled: !!filters?.agent_id,
  });
}

export function useEmailAgentMetricsSummary(filters: MetricsFilters | null) {
  return useQuery({
    queryKey: aiAgentKeys.emailMetricsSummary(filters),
    queryFn: () => fetchMetricsSummary(filters!),
    enabled: !!filters?.agent_id,
  });
}

export function useEmailAgentOutcomes(agentId: string | undefined, outcomeType?: string) {
  return useQuery({
    queryKey: aiAgentKeys.emailOutcomes(agentId, outcomeType),
    queryFn: () => fetchOutcomes({ agent_id: agentId!, outcome_type: outcomeType }),
    enabled: !!agentId,
  });
}
