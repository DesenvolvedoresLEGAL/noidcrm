import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLearningSignals(organizationId: string | undefined, opts?: { minConfidence?: number }) {
  const minConfidence = opts?.minConfidence ?? 0;
  return useQuery({
    queryKey: ["learning-signals", organizationId, minConfidence],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_signals" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .gte("confidence", minConfidence)
        .order("impact_score", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
