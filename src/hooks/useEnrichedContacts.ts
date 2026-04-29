import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listEnrichedContacts, runApolloEnrichment, setPrimaryContact } from "@/services/enrichment/apolloService";

export function useEnrichedContacts(prospectId: string | null | undefined) {
  const qc = useQueryClient();
  const key = ["enriched-contacts", prospectId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => listEnrichedContacts(prospectId!),
    enabled: !!prospectId,
  });

  useEffect(() => {
    if (!prospectId) return;
    const ch = supabase
      .channel(`ectp-${prospectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enriched_contact_profiles", filter: `prospect_id=eq.${prospectId}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [prospectId, qc]);

  const enrich = useMutation({
    mutationFn: () => runApolloEnrichment(prospectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const setPrimary = useMutation({
    mutationFn: (contactId: string) => setPrimaryContact(prospectId!, contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { ...query, enrich, setPrimary };
}
