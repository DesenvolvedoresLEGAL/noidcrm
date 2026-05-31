import { useQuery } from '@tanstack/react-query';
import {
  getHistoricalQualifiersInPeriod,
  getQualifiedOpportunitiesByUser,
  type HistoricalQualifierCount,
  type QualifiedOpportunity,
} from '@/services/results/historicalQualifications';

export function useHistoricalQualifiers(params: {
  organizationId?: string;
  start?: string;
  end?: string;
}) {
  const enabled = Boolean(params.organizationId && params.start && params.end);
  return useQuery<HistoricalQualifierCount[]>({
    queryKey: ['historical-qualifiers', params.organizationId, params.start, params.end],
    enabled,
    staleTime: 30_000,
    queryFn: () => getHistoricalQualifiersInPeriod({
      organizationId: params.organizationId!,
      start: params.start!,
      end: params.end!,
    }),
  });
}

export function useQualifiedOpportunitiesByUser(params: {
  organizationId?: string;
  userId?: string;
  start?: string;
  end?: string;
  enabled?: boolean;
}) {
  const enabled = (params.enabled ?? true) && Boolean(params.organizationId && params.userId && params.start && params.end);
  return useQuery<QualifiedOpportunity[]>({
    queryKey: ['qualified-opportunities-by-user', params.organizationId, params.userId, params.start, params.end],
    enabled,
    staleTime: 30_000,
    queryFn: () => getQualifiedOpportunitiesByUser({
      organizationId: params.organizationId!,
      userId: params.userId!,
      start: params.start!,
      end: params.end!,
    }),
  });
}
