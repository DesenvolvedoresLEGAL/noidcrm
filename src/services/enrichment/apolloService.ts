import { supabase } from "@/integrations/supabase/client";

export interface ApolloEnrichmentAttempt {
  endpoint: string;
  status: number;
  ok: boolean;
  inaccessible: boolean;
  count: number;
  error?: string;
}

export interface ApolloEnrichmentResult {
  status: "done" | "partial" | "failed" | "skipped";
  reason?: string;
  contacts_found?: number;
  decision_makers_found?: number;
  max_contact_score?: number;
  endpoint_used?: string | null;
  attempts?: ApolloEnrichmentAttempt[];
}

export async function runApolloEnrichment(
  prospectId: string,
  trigger_source: "user" | "system" | "automation" = "user",
  customTitles?: string[],
): Promise<ApolloEnrichmentResult> {
  const { data, error } = await supabase.functions.invoke("run-apollo-enrichment", {
    body: {
      prospect_id: prospectId,
      trigger_source,
      ...(customTitles && customTitles.length > 0 ? { custom_titles: customTitles } : {}),
    },
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
  revealed_at?: string | null;
  reveal_status?: string | null;
  last_reveal_attempt_at?: string | null;
  // KAI.15.1 — Reveal Governance
  email_revealed?: boolean | null;
  phone_revealed?: boolean | null;
  email_reveal_status?: string | null;
  phone_reveal_status?: string | null;
  email_revealed_at?: string | null;
  phone_revealed_at?: string | null;
  preferred_channel?: string | null;
}

export async function listEnrichedContacts(prospectId: string): Promise<EnrichedContact[]> {
  const { data, error } = await (supabase
    .from("enriched_contact_profiles") as any)
    .select("id, prospect_id, full_name, first_name, last_name, role_title, seniority, department, email, email_status, phone, linkedin_url, provider, confidence_score, is_primary, created_at, revealed_at, reveal_status, last_reveal_attempt_at, email_revealed, phone_revealed, email_reveal_status, phone_reveal_status, email_revealed_at, phone_revealed_at, preferred_channel")
    .eq("prospect_id", prospectId)
    .eq("is_merged", false)
    .order("is_primary", { ascending: false })
    .order("confidence_score", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as EnrichedContact[];
}

export async function listMergedContacts(prospectId: string): Promise<EnrichedContact[]> {
  const { data, error } = await (supabase
    .from("enriched_contact_profiles") as any)
    .select("id, prospect_id, full_name, first_name, last_name, role_title, seniority, department, email, email_status, phone, linkedin_url, provider, confidence_score, is_primary, created_at, merged_into")
    .eq("prospect_id", prospectId)
    .eq("is_merged", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EnrichedContact[];
}

export async function setPrimaryContact(prospectId: string, contactId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)("resolve_primary_contact_manual", {
    p_prospect_id: prospectId,
    p_contact_id: contactId,
  });
  if (error) throw error;
}

export interface SyncEnrichedContactsResult {
  created: number;
  updated: number;
  skipped: number;
  primary_contact_id: string | null;
}

export async function syncEnrichedContactsToAccount(
  prospectId: string,
  accountId: string,
  contactIds: string[],
): Promise<SyncEnrichedContactsResult> {
  const { data, error } = await (supabase.rpc as any)("sync_enriched_contacts_to_account", {
    p_prospect_id: prospectId,
    p_account_id: accountId,
    p_contact_ids: contactIds,
  });
  if (error) throw error;
  return data as SyncEnrichedContactsResult;
}

export interface RevealApolloContactResult {
  status: "revealed" | "partial" | "pending" | "no_data" | "skipped" | "failed";
  contact_id?: string;
  email?: string | null;
  phone?: string | null;
  credits_used?: number;
  reason?: string;
  inaccessible?: boolean;
}

export async function revealApolloContact(contactId: string): Promise<RevealApolloContactResult> {
  const { data, error } = await supabase.functions.invoke("reveal-apollo-contact", {
    body: { contact_id: contactId },
  });
  if (error) throw error;
  return data as RevealApolloContactResult;
}

