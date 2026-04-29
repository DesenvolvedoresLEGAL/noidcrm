import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listEnrichmentJobs } from "@/services/enrichment/apolloService";

export function useEnrichmentJobs(prospectId: string | null | undefined) {
  const qc = useQueryClient();
  const key = ["enrichment-jobs", prospectId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => listEnrichmentJobs(prospectId!),
    enabled: !!prospectId,
  });

  useEffect(() => {
    if (!prospectId) return;
    const ch = supabase
      .channel(`ej-${prospectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enrichment_jobs", filter: `prospect_id=eq.${prospectId}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [prospectId, qc]);

  return query;
}
