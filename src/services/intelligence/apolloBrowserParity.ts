import { supabase } from '@/integrations/supabase/client';

export interface ApolloParityLog {
  id: string;
  organization_id: string;
  prospect_id: string | null;
  company_name: string | null;
  domain: string | null;
  apollo_web_url: string | null;
  apollo_web_contacts_count: number | null;
  kairos_endpoint: string | null;
  kairos_payload: any;
  kairos_response_summary: any;
  kairos_contacts_count: number | null;
  kairos_parser_count: number | null;
  kairos_filter_count: number | null;
  kairos_credits_used: number | null;
  kairos_status: string | null;
  kairos_request_id: string | null;
  har_uploaded: boolean;
  har_summary: any;
  har_candidate_requests: any;
  selected_har_request: any;
  diff_summary: any;
  parity_status: string;
  root_cause: string | null;
  created_at: string;
}

export interface RunParityCheckInput {
  prospect_id: string;
  apollo_web_contacts_count?: number | null;
  apollo_web_url?: string | null;
  har_json?: any;
  selected_request_index?: number;
}

export async function runApolloParityCheck(input: RunParityCheckInput) {
  const { data, error } = await supabase.functions.invoke('apollo-browser-parity-check', {
    body: input,
  });
  if (error) throw error;
  return data;
}

export async function listApolloParityLogs(prospect_id: string, limit = 10): Promise<ApolloParityLog[]> {
  const { data, error } = await (supabase.from as any)('apollo_browser_parity_logs')
    .select('*')
    .eq('prospect_id', prospect_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ApolloParityLog[];
}

export interface ManualContactInput {
  prospect_id: string;
  workspace_id: string;
  full_name: string;
  role_title?: string | null;
  department?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
}

export async function addApolloManualContact(input: ManualContactInput) {
  const { data, error } = await (supabase.from as any)('enriched_contact_profiles').insert({
    prospect_id: input.prospect_id,
    workspace_id: input.workspace_id,
    full_name: input.full_name,
    role_title: input.role_title ?? null,
    department: input.department ?? null,
    linkedin_url: input.linkedin_url ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    provider: 'apollo_web_manual',
    confidence_score: 70,
    manual_import: true,
    requires_validation: true,
    import_note: input.note ?? 'Imported manually from Apollo Web',
  }).select('id').single();
  if (error) throw error;
  return data;
}
