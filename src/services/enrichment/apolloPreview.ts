import { supabase } from "@/integrations/supabase/client";

export interface ApolloPreview {
  eligible: boolean;
  reason: string | null;
  warning: string | null;
  estimated_credits: number;
  domain: string | null;
  company_name: string | null;
  score: number;
  quality_label: string | null;
  already_enriched: boolean;
  decision_maker_found: boolean;
  last_job_at: string | null;
  last_job_status: string | null;
  last_contacts_found: number | null;
}

export async function previewApolloEnrichment(prospectId: string): Promise<ApolloPreview> {
  const { data, error } = await supabase.functions.invoke("preview-apollo-enrichment", {
    body: { prospect_id: prospectId },
  });
  if (error) throw error;
  return data as ApolloPreview;
}
