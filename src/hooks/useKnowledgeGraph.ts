import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEntityGraph,
  getEntityInsights,
  getOrganizationInsights,
  updateInsightStatus,
  getGraphStats,
  getGraphBuilds,
  triggerGraphBuild,
  getOpportunityNetworkSummary,
  EntityGraph,
  GraphInsight,
  GraphBuild
} from '@/services/crm/knowledge-graph';
import { toast } from 'sonner';

export function useEntityGraph(entityType: string, entityId: string | undefined, depth: number = 2) {
  return useQuery({
    queryKey: ['entity-graph', entityType, entityId, depth],
    queryFn: () => getEntityGraph(entityType, entityId!, depth),
    enabled: !!entityId,
    staleTime: 30 * 1000, // 30 seconds - reduced to avoid stale data
    refetchOnMount: true,
  });
}

export function useEntityInsights(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity-insights', entityType, entityId],
    queryFn: () => getEntityInsights(entityType, entityId!),
    enabled: !!entityId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useOrganizationInsights(status: string = 'active', limit: number = 50) {
  return useQuery({
    queryKey: ['organization-insights', status, limit],
    queryFn: () => getOrganizationInsights(status, limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useGraphStats() {
  return useQuery({
    queryKey: ['graph-stats'],
    queryFn: getGraphStats,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGraphBuilds(limit: number = 10) {
  return useQuery({
    queryKey: ['graph-builds', limit],
    queryFn: () => getGraphBuilds(limit),
    staleTime: 1 * 60 * 1000,
  });
}

export function useOpportunityNetworkSummary(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['opportunity-network-summary', opportunityId],
    queryFn: () => getOpportunityNetworkSummary(opportunityId!),
    enabled: !!opportunityId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateInsightStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ insightId, status }: { insightId: string; status: 'acknowledged' | 'resolved' | 'dismissed' }) =>
      updateInsightStatus(insightId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-insights'] });
      queryClient.invalidateQueries({ queryKey: ['organization-insights'] });
      queryClient.invalidateQueries({ queryKey: ['graph-stats'] });
      toast.success('Insight atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar insight');
    }
  });
}

export function useTriggerGraphBuild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (buildType: string = 'full') => triggerGraphBuild(buildType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph-stats'] });
      queryClient.invalidateQueries({ queryKey: ['graph-builds'] });
      queryClient.invalidateQueries({ queryKey: ['entity-graph'] });
      queryClient.invalidateQueries({ queryKey: ['entity-insights'] });
      queryClient.invalidateQueries({ queryKey: ['organization-insights'] });
      toast.success('Build do grafo iniciado');
    },
    onError: () => {
      toast.error('Erro ao iniciar build do grafo');
    }
  });
}
