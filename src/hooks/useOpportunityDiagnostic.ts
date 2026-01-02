import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DiagnosticResult {
  id: string;
  opportunity_id: string | null;
  contact_id: string | null;
  organization_id: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_whatsapp: string | null;
  lead_company: string | null;
  answers: {
    questionId: number;
    areaKey: string;
    selectedOption: number;
    points: number;
  }[];
  area_scores: Record<string, number>;
  total_score: number;
  classification: string;
  created_at: string;
}

export function useOpportunityDiagnostic(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ["opportunity-diagnostic", opportunityId],
    queryFn: async (): Promise<DiagnosticResult | null> => {
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from("diagnostic_results")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching diagnostic:", error);
        throw error;
      }

      if (!data) return null;

      // Cast the JSONB fields properly
      return {
        ...data,
        answers: data.answers as DiagnosticResult["answers"],
        area_scores: data.area_scores as Record<string, number>,
      };
    },
    enabled: !!opportunityId,
  });
}
