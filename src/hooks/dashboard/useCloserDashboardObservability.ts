import { useQuery } from '@tanstack/react-query';
import {
  getCloserDashboardHealthSummary,
  getCloserDashboardUserAdoption,
  getCloserDashboardPerformanceSummary,
  getCloserRolloutDecisionData,
  getActiveCloserPilots,
  getEligibleClosers,
} from '@/services/crm/closerDashboardObservability';
import {
  getDynamicDashboardFeedbackSummary,
  getDynamicDashboardFeedbackList,
} from '@/services/crm/dynamicDashboardFeedback';
import { fetchRuntimeLogs } from '@/services/crm/dynamicDashboardRuntimeLogs';

export const MAX_CLOSER_PILOTS = 3;

export function useCloserDashboardObservability(tenantId: string | null | undefined) {
  const enabled = !!tenantId;

  const health = useQuery({
    queryKey: ['closer-observability', 'health', tenantId],
    queryFn: () => getCloserDashboardHealthSummary(tenantId as string),
    enabled,
    staleTime: 30_000,
  });

  const adoption = useQuery({
    queryKey: ['closer-observability', 'adoption', tenantId],
    queryFn: () => getCloserDashboardUserAdoption(tenantId as string),
    enabled,
    staleTime: 30_000,
  });

  const performance = useQuery({
    queryKey: ['closer-observability', 'performance', tenantId],
    queryFn: () => getCloserDashboardPerformanceSummary(tenantId as string),
    enabled,
    staleTime: 30_000,
  });

  const feedbackSummary = useQuery({
    queryKey: ['closer-observability', 'feedback-summary', tenantId],
    queryFn: () => getDynamicDashboardFeedbackSummary(tenantId as string),
    enabled,
    staleTime: 30_000,
  });

  const feedbackList = useQuery({
    queryKey: ['closer-observability', 'feedback-list', tenantId],
    queryFn: () => getDynamicDashboardFeedbackList(tenantId as string, 20),
    enabled,
    staleTime: 30_000,
  });

  const decision = useQuery({
    queryKey: ['closer-observability', 'decision', tenantId],
    queryFn: () => getCloserRolloutDecisionData(tenantId as string),
    enabled,
    staleTime: 30_000,
  });

  const activePilots = useQuery({
    queryKey: ['closer-observability', 'active-pilots', tenantId],
    queryFn: () => getActiveCloserPilots(tenantId as string),
    enabled,
    staleTime: 30_000,
  });

  const eligibleClosers = useQuery({
    queryKey: ['closer-observability', 'eligible', tenantId],
    queryFn: () => getEligibleClosers(tenantId as string),
    enabled,
    staleTime: 30_000,
  });

  const runtimeLogs = useQuery({
    queryKey: ['closer-observability', 'runtime-logs', tenantId],
    queryFn: () => fetchRuntimeLogs(tenantId as string, 50),
    enabled,
    staleTime: 30_000,
  });

  return {
    healthSummary: health.data,
    adoptionByUser: adoption.data ?? [],
    performanceSummary: performance.data,
    feedbackSummary: feedbackSummary.data,
    feedbackList: feedbackList.data ?? [],
    rolloutDecision: decision.data,
    activePilots: activePilots.data ?? [],
    eligibleClosers: eligibleClosers.data ?? [],
    runtimeLogs: runtimeLogs.data ?? [],
    canEnableMore: (activePilots.data?.length ?? 0) < MAX_CLOSER_PILOTS,
    maxPilots: MAX_CLOSER_PILOTS,
    isLoading:
      health.isLoading ||
      adoption.isLoading ||
      performance.isLoading ||
      feedbackSummary.isLoading ||
      decision.isLoading ||
      activePilots.isLoading ||
      eligibleClosers.isLoading,
    error:
      health.error ||
      adoption.error ||
      performance.error ||
      feedbackSummary.error ||
      decision.error,
    refetch: () => {
      health.refetch();
      adoption.refetch();
      performance.refetch();
      feedbackSummary.refetch();
      feedbackList.refetch();
      decision.refetch();
      activePilots.refetch();
      eligibleClosers.refetch();
      runtimeLogs.refetch();
    },
  };
}
