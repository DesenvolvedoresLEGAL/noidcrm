import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLifecycleTimeline(prospectId: string | undefined) {
  return useQuery({
    queryKey: ["lifecycle-timeline", prospectId],
    enabled: !!prospectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_events")
        .select("id, event_type, event_class, channel, event_subtype, payload, created_at, source")
        .eq("prospect_id", prospectId!)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useConversionFunnel(organizationId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ["conversion-funnel", organizationId, days],
    enabled: !!organizationId,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await supabase
        .from("revenue_events")
        .select("event_type")
        .eq("organization_id", organizationId!)
        .gte("created_at", since)
        .limit(10000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        counts[r.event_type] = (counts[r.event_type] ?? 0) + 1;
      });
      return counts;
    },
  });
}
