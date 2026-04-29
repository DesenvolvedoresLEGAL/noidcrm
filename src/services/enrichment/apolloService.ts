import { supabase } from "@/integrations/supabase/client";

export interface ApolloEnrichmentResult {
  status: "done" | "partial" | "failed" | "skipped";
  reason?: string;
  contacts_found?: number;
  decision_makers_found?: number;
  max_contact_score?: number;
}

export async function runApolloEnrichment(prospectId: string): Promise<ApolloEnrichmentResult> {
  const { data, error } = await supabase.functions.invoke("run-apollo-enrichment", {
    body: { prospect_id: prospectId },
  });
  if (error) throw error;
  return data as ApolloEnrichmentResult;
}

export interface EnrichedContact {
  id: string;
  prospect_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role_title: string | null;
  seniority: string | null;
  department: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
  provider: string | null;
  confidence_score: number | null;
  is_primary: boolean | null;
  created_at: string;
}

export async function listEnrichedContacts(prospectId: string): Promise<EnrichedContact[]> {
  const { data, error } = await supabase
    .from("enriched_contact_profiles")
    .select("id, prospect_id, full_name, first_name, last_name, role_title, seniority, department, email, email_status, phone, linkedin_url, provider, confidence_score, is_primary, created_at")
    .eq("prospect_id", prospectId)
    .order("is_primary", { ascending: false })
    .order("confidence_score", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as EnrichedContact[];
}

export async function setPrimaryContact(prospectId: string, contactId: string): Promise<void> {
  const { error: e1 } = await supabase
    .from("enriched_contact_profiles")
    .update({ is_primary: false })
    .eq("prospect_id", prospectId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("enriched_contact_profiles")
    .update({ is_primary: true })
    .eq("id", contactId);
  if (e2) throw e2;
}
