import { supabase } from "@/integrations/supabase/client";

export interface ApolloEnrichmentResult {
  status: "done" | "partial" | "failed" | "skipped";
  reason?: string;
  contacts_found?: number;
  decision_makers_found?: number;
  max_contact_score?: number;
}

export async function runApolloEnrichment(
  prospectId: string,
  trigger_source: "user" | "system" | "automation" = "user",
): Promise<ApolloEnrichmentResult> {
  const { data, error } = await supabase.functions.invoke("run-apollo-enrichment", {
    body: { prospect_id: prospectId, trigger_source },
  });
  if (error) throw error;
  return data as ApolloEnrichmentResult;
}

export interface EnrichmentJob {
  id: string;
  prospect_id: string | null;
  workspace_id: string;
  provider: string;
  status: string;
  credits_used: number | null;
  estimated_credits: number | null;
  contacts_found: number | null;
  decision_makers_found: number | null;
  trigger_source: string | null;
  skip_reason: string | null;
  error: string | null;
  request: any;
  response: any;
  response_summary: any;
  created_at: string;
  completed_at: string | null;
}

export async function listEnrichmentJobs(prospectId: string): Promise<EnrichmentJob[]> {
  const { data, error } = await supabase
    .from("enrichment_jobs" as any)
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EnrichmentJob[];
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
    .eq("is_merged" as any, false)
    .order("is_primary", { ascending: false })
    .order("confidence_score", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as EnrichedContact[];
}

export async function listMergedContacts(prospectId: string): Promise<EnrichedContact[]> {
  const { data, error } = await supabase
    .from("enriched_contact_profiles")
    .select("id, prospect_id, full_name, first_name, last_name, role_title, seniority, department, email, email_status, phone, linkedin_url, provider, confidence_score, is_primary, created_at")
    .eq("prospect_id", prospectId)
    .eq("is_merged" as any, true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EnrichedContact[];
}

export async function setPrimaryContact(prospectId: string, contactId: string): Promise<void> {
  const { error } = await supabase.rpc("resolve_primary_contact_manual" as any, {
    p_prospect_id: prospectId,
    p_contact_id: contactId,
  });
  if (error) throw error;
}
