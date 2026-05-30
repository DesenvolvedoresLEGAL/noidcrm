import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { getResultsMode, getResultsCopy, type ResultsMode } from '@/lib/results/resultsMode';

export function useResultsMode(): {
  mode: ResultsMode;
  copy: ReturnType<typeof getResultsCopy>;
  loading: boolean;
} {
  const { organization, loading } = useCurrentOrganization();
  const mode = getResultsMode(organization);
  return { mode, copy: getResultsCopy(mode), loading };
}
