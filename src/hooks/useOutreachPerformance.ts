import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOutreachPerformance(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["outreach-performance", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_performance" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .order("sent", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
