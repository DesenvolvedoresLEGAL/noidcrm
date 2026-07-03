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
  const hasEmail = !!input.email;
  const hasPhone = !!input.phone;
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
    email_revealed: hasEmail,
    email_revealed_at: hasEmail ? new Date().toISOString() : null,
    phone_revealed: hasPhone,
    phone_revealed_at: hasPhone ? new Date().toISOString() : null,
    phone_source: hasPhone ? 'apollo_web' : null,
    phone_quality_reason: hasPhone ? 'unverified_manual' : null,
    reveal_source: 'apollo_web_manual',
    import_note: input.note ?? 'Imported manually from Apollo Web',
  }).select('id').single();
  if (error) throw error;
  return data;
}

// ─── KAI.18.9 Apollo Recovery Mode ──────────────────────────────────────

/**
 * Best-effort Apollo Web URL. Prefers stored URL on enriched_company_profiles.
 * Falls back to a domain/name search on Apollo.
 */
export function buildApolloWebUrl(opts: {
  storedUrl?: string | null;
  domain?: string | null;
  companyName?: string | null;
}): string {
  if (opts.storedUrl) return opts.storedUrl;
  if (opts.domain) {
    return `https://app.apollo.io/#/people?qOrganizationDomainsList[]=${encodeURIComponent(
      opts.domain,
    )}&sortAscending=false&sortByField=%5Bnone%5D&page=1`;
  }
  const q = encodeURIComponent(opts.companyName ?? '');
  return `https://app.apollo.io/#/companies?qOrganizationKeywordTags[]=${q}&sortAscending=false&sortByField=%5Bnone%5D&page=1`;
}

/**
 * Returns how many API runs in the last 24h returned zero with credit consumption.
 * >=2 means the credit guard will block new attempts.
 */
export async function getApolloZeroResultStats(prospectId: string): Promise<{
  zeroWithCreditsCount: number;
  blocked: boolean;
}> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await (supabase as any)
    .from('apollo_query_logs')
    .select('id', { count: 'exact', head: true })
    .eq('prospect_id', prospectId)
    .eq('zero_result_with_credits', true)
    .gte('created_at', cutoff);
  const c = count ?? 0;
  return { zeroWithCreditsCount: c, blocked: c >= 2 };
}

export interface ParsedManualContact {
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

/**
 * Parses free-form text pasted from Apollo Web. Accepts:
 *  - Tab/pipe/semicolon/comma-separated columns
 *  - Order (flexible): Nome | Cargo | Email | Telefone | LinkedIn
 * Detects email/phone/LinkedIn heuristically regardless of column order.
 */
export function parseManualContacts(raw: string): ParsedManualContact[] {
  const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/i;
  const linkedinRe = /https?:\/\/[^\s|,;]*linkedin\.com\/[^\s|,;]+/i;
  const phoneRe = /(?:\+?\d[\d\s().-]{7,}\d)/;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const out: ParsedManualContact[] = [];
  for (const line of lines) {
    // skip obvious header rows
    if (/^(nome|name)\b/i.test(line) && /(cargo|title|role|email|telefone|phone)/i.test(line)) continue;
    const cols = line
      .split(/\t|\s*\|\s*|\s*;\s*|,(?=\s)/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (cols.length === 0) continue;

    const emailMatch = line.match(emailRe)?.[0] ?? null;
    const linkedinMatch = line.match(linkedinRe)?.[0] ?? null;
    // strip email/linkedin before phone match to avoid false hits
    const scrub = line.replace(emailRe, ' ').replace(linkedinRe, ' ');
    const phoneMatch = scrub.match(phoneRe)?.[0]?.trim() ?? null;

    const remaining = cols.filter((c) => {
      if (emailMatch && c.includes(emailMatch)) return false;
      if (linkedinMatch && c.includes(linkedinMatch)) return false;
      if (phoneMatch && c.replace(/\s+/g, '').includes(phoneMatch.replace(/\s+/g, ''))) return false;
      return true;
    });
    const full_name = remaining[0] ?? cols[0];
    const role_title = remaining[1] ?? null;
    if (!full_name) continue;
    out.push({
      full_name,
      role_title,
      email: emailMatch,
      phone: phoneMatch,
      linkedin_url: linkedinMatch,
    });
  }
  return out;
}
