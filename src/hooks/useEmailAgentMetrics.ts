import { useQuery } from '@tanstack/react-query';
import { fetchDailyMetrics, fetchMetricsSummary, fetchOutcomes, type MetricsFilters } from '@/services/ai-agents/metricsService';

export function useEmailAgentMetrics(filters: MetricsFilters | null) {
  return useQuery({
    queryKey: ['email-agent-metrics', filters],
    queryFn: () => fetchDailyMetrics(filters!),
    enabled: !!filters?.agent_id,
  });
}

export function useEmailAgentMetricsSummary(filters: MetricsFilters | null) {
  return useQuery({
    queryKey: ['email-agent-metrics-summary', filters],
    queryFn: () => fetchMetricsSummary(filters!),
    enabled: !!filters?.agent_id,
  });
}

export function useEmailAgentOutcomes(agentId: string | undefined, outcomeType?: string) {
  return useQuery({
    queryKey: ['email-agent-outcomes', agentId, outcomeType],
    queryFn: () => fetchOutcomes({ agent_id: agentId!, outcome_type: outcomeType }),
    enabled: !!agentId,
  });
}
