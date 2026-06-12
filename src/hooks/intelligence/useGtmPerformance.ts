import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listGtmPerformance,
  listGtmRecommendations,
  refreshGtmPerformance,
  updateRecommendationStatus,
  type GtmFilters,
  type GtmRecommendation,
} from "@/services/intelligence/gtmPerformance";

export function useGtmPerformance(filters: GtmFilters) {
  return useQuery({
    queryKey: ["kairos-gtm-performance", filters],
    queryFn: () => listGtmPerformance(filters),
    staleTime: 30_000,
  });
}

export function useGtmRecommendations() {
  return useQuery({
    queryKey: ["kairos-gtm-recommendations"],
    queryFn: listGtmRecommendations,
    staleTime: 30_000,
  });
}

export function useRefreshGtmPerformance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refreshGtmPerformance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kairos-gtm-performance"] });
      qc.invalidateQueries({ queryKey: ["kairos-gtm-recommendations"] });
      toast.success("Performance GTM atualizada");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao atualizar performance"),
  });
}

export function useUpdateRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: GtmRecommendation["status"] }) =>
      updateRecommendationStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kairos-gtm-recommendations"] });
      toast.success("Recomendação atualizada");
    },
  });
}
