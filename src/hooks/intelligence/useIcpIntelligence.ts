import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { computeIcpIntelligence, type IntelligenceICP } from '@/services/intelligence/icpIntelligence';

export type { IntelligenceICP };

export function useIcpIntelligence() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['icp-intelligence', organization?.id],
    queryFn: () => computeIcpIntelligence(organization!.id),
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });
}
