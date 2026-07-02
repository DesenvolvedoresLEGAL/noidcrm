import { supabase } from "@/integrations/supabase/client";

export interface EndpointMatrixRow {
  id: string;
  organization_id: string;
  prospect_id: string | null;
  endpoint: string;
  method: string;
  http_status: number | null;
  payload: any;
  response_summary: any;
  returned_contacts: number | null;
  returned_companies: number | null;
  credits_used: number | null;
  latency_ms: number | null;
  ranking: number | null;
  stars: number | null;
  recommended: boolean;
  confidence_score: number | null;
  strategy: string | null;
  source: "web" | "api" | "manual" | "replay" | string;
  headers_seen: any;
  notes: string | null;
  created_at: string;
}

export interface EndpointDiscoveryRow {
  id: string;
  endpoint: string;
  method: string;
  status: string;
  available: boolean;
  documentation_url: string | null;
  requires_auth_scope: string | null;
  requires_cookie: boolean;
  graphql: boolean;
  internal_only: boolean;
  public_only: boolean;
  notes: string | null;
}

export async function fetchEndpointMatrix(prospectId: string): Promise<EndpointMatrixRow[]> {
  const { data, error } = await (supabase as any)
    .from("apollo_endpoint_matrix")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as EndpointMatrixRow[];
}

export async function fetchEndpointDiscovery(): Promise<EndpointDiscoveryRow[]> {
  const { data, error } = await (supabase as any)
    .from("apollo_endpoint_discovery")
    .select("*")
    .order("endpoint", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EndpointDiscoveryRow[];
}

export async function runEndpointMatrixReplay(params: {
  prospect_id: string;
  mode?: "comparative_replay" | "single_replay";
  endpoint?: string;
  payload_override?: any;
}) {
  const { data, error } = await supabase.functions.invoke("apollo-endpoint-matrix", {
    body: params,
  });
  if (error) throw error;
  return data as {
    mode: string;
    winner: string | null;
    results: Array<{
      endpoint: string;
      status: number;
      latency_ms: number;
      returned_contacts: number;
      returned_companies: number;
      credits_used: number | null;
      payload: any;
      response_summary: any;
    }>;
  };
}

export async function getEndpointStrategy(organizationId: string): Promise<string> {
  const { data } = await (supabase as any)
    .from("organization_settings")
    .select("apollo_endpoint_strategy")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return (data?.apollo_endpoint_strategy as string) ?? "auto";
}

export async function setEndpointStrategy(organizationId: string, strategy: string) {
  const { error } = await (supabase as any)
    .from("organization_settings")
    .update({ apollo_endpoint_strategy: strategy })
    .eq("organization_id", organizationId);
  if (error) throw error;
}
