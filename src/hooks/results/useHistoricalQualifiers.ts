import { useQuery } from '@tanstack/react-query';
import { getHistoricalQualifiersInPeriod, type HistoricalQualifierCount } from '@/services/results/historicalQualifications';

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
