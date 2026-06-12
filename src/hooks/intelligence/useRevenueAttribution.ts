import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAttributions,
  syncAttribution,
  type AttributionFilters,
} from "@/services/intelligence/revenueAttribution";

export function useRevenueAttributions(filters: AttributionFilters) {
  return useQuery({
    queryKey: ["kairos-revenue-attribution", filters],
    queryFn: () => listAttributions(filters),
    staleTime: 30_000,
  });
}

export function useSyncAttribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opportunityId?: string) => syncAttribution(opportunityId),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["kairos-revenue-attribution"] });
      toast.success(
        `Reconciliação concluída — ${data?.updated ?? 0}/${data?.processed ?? 0} atualizados`,
      );
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao reconciliar receita"),
  });
}
