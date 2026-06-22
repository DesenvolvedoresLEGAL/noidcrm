import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analyzeCoverage, getLatestCoverage, type CoverageAnalysis } from "@/services/intelligence/coverage";

export function useCoverageAnalysis(prospectId: string | null | undefined) {
  return useQuery<CoverageAnalysis | null>({
    queryKey: ["kairos-coverage", prospectId],
    enabled: !!prospectId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getLatestCoverage(prospectId!),
  });
}

export function useRecalculateCoverage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prospectId, force = true }: { prospectId: string; force?: boolean }) =>
      analyzeCoverage(prospectId, force),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["kairos-coverage", vars.prospectId] });
      qc.invalidateQueries({ queryKey: ["kairos-qualified-queue"] });
    },
  });
}
