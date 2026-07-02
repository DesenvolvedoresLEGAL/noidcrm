// KAI.18.7 — Apollo Browser Parity Check
// Compares Apollo Web (via HAR export) with the last Kairós Apollo query
// and classifies the parity_status + root_cause.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APOLLO_URL_HINTS = [
  "people", "mixed_people", "organizations", "suggested",
  "search", "contacts", "recommendations", "leads",
];

interface HarEntry {
  request: { method: string; url: string; postData?: { text?: string } };
  response: { status: number; content?: { size?: number; text?: string } };
  time?: number;
}

function extractApolloRequestsFromHar(har: any): any[] {
  const entries: HarEntry[] = har?.log?.entries ?? [];
  const out: any[] = [];
  for (const e of entries) {
    const url = e?.request?.url ?? "";
    if (!url.includes("apollo.io")) continue;
    const lower = url.toLowerCase();
    if (!APOLLO_URL_HINTS.some((h) => lower.includes(h))) continue;
    let payload: any = null;
    try {
      const raw = e.request.postData?.text;
      if (raw) payload = JSON.parse(raw);
    } catch { /* ignore */ }
    let responseJson: any = null;
    try {
      const raw = e.response.content?.text;
      if (raw) responseJson = JSON.parse(raw);
    } catch { /* ignore */ }
    const peopleCount =
      responseJson?.people?.length ??
      responseJson?.contacts?.length ??
      responseJson?.pagination?.total_entries ??
      null;
    out.push({
      method: e.request.method,
      url,
      status: e.response.status,
      size: e.response.content?.size ?? null,
      time_ms: e.time ?? null,
      payload,
      response_summary: {
        people_count: peopleCount,
        keys: responseJson ? Object.keys(responseJson).slice(0, 20) : [],
      },
    });
  }
  return out;
}

function diffPayloads(kairos: any, web: any) {
  const kk = new Set(Object.keys(kairos ?? {}));
  const wk = new Set(Object.keys(web ?? {}));
  const onlyKairos = [...kk].filter((k) => !wk.has(k));
  const onlyWeb = [...wk].filter((k) => !kk.has(k));
  const diff: any[] = [];
  for (const k of [...kk].filter((x) => wk.has(x))) {
    const a = JSON.stringify(kairos[k]);
    const b = JSON.stringify(web[k]);
    if (a !== b) diff.push({ key: k, kairos: kairos[k], web: web[k] });
  }
  return { only_kairos: onlyKairos, only_web: onlyWeb, different: diff };
}

function classify(
  kairosCount: number,
  webCount: number | null,
  harRequests: any[],
  bestHar: any | null,
  kairosPayload: any,
): { parity_status: string; root_cause: string } {
  if (webCount == null) return { parity_status: "no_har", root_cause: "unknown" };
  if (kairosCount === webCount && kairosCount > 0) return { parity_status: "match", root_cause: "unknown" };
  if (kairosCount > 0 && webCount > 0 && kairosCount !== webCount) {
    return { parity_status: "mismatch", root_cause: "public_api_differs_from_web" };
  }
  if (kairosCount === 0 && webCount > 0) {
    if (!bestHar) return { parity_status: "mismatch", root_cause: "public_api_differs_from_web" };
    const webPayload = bestHar.payload ?? {};
    const hasOrgId = !!(webPayload.organization_ids || webPayload.organization_id);
    const kairosHasOrgId = !!(kairosPayload?.organization_ids || kairosPayload?.organization_id);
    if (hasOrgId && !kairosHasOrgId) {
      return { parity_status: "payload_mismatch", root_cause: "payload_missing_organization_id" };
    }
    const kairosEndpoint = kairosPayload?.endpoint ?? "";
    if (bestHar.url && kairosEndpoint && !bestHar.url.includes(kairosEndpoint.split("/").pop() ?? "")) {
      return { parity_status: "endpoint_mismatch", root_cause: "endpoint_wrong" };
    }
    if (bestHar.status === 401 || bestHar.status === 403) {
      return { parity_status: "auth_scope_mismatch", root_cause: "auth_scope_missing" };
    }
    return { parity_status: "mismatch", root_cause: "public_api_differs_from_web" };
  }
  return { parity_status: "unknown", root_cause: "unknown" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";

    const body = await req.json().catch(() => ({}));
    const {
      prospect_id,
      apollo_web_contacts_count,
      apollo_web_url,
      har_json,
      selected_request_index,
    } = body ?? {};

    if (!prospect_id) {
      return new Response(JSON.stringify({ error: "prospect_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Load last apollo_query_log for this prospect
    const { data: lastLog } = await sb
      .from("apollo_query_logs")
      .select("*")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: prospect } = await sb
      .from("prospects")
      .select("id, organization_id, company_name, normalized_domain, website")
      .eq("id", prospect_id)
      .maybeSingle();

    if (!prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract HAR
    let harCandidates: any[] = [];
    let harSummary: any = null;
    let selectedHar: any = null;
    if (har_json) {
      harCandidates = extractApolloRequestsFromHar(har_json);
      harSummary = {
        total_entries: har_json?.log?.entries?.length ?? 0,
        apollo_entries: harCandidates.length,
      };
      const idx = typeof selected_request_index === "number" ? selected_request_index : 0;
      selectedHar = harCandidates[idx] ?? harCandidates.find((h) => (h.response_summary?.people_count ?? 0) > 0) ?? null;
    }

    const kairosPayload = lastLog?.request_payload ?? null;
    const kairosContactsCount = lastLog?.people_returned ?? 0;
    const webContacts = typeof apollo_web_contacts_count === "number" ? apollo_web_contacts_count : null;

    const diffSummary = selectedHar
      ? diffPayloads(kairosPayload ?? {}, selectedHar.payload ?? {})
      : null;

    const { parity_status, root_cause } = classify(
      kairosContactsCount,
      webContacts,
      harCandidates,
      selectedHar,
      { ...(kairosPayload ?? {}), endpoint: lastLog?.endpoint },
    );

    const { data: inserted, error: insErr } = await sb
      .from("apollo_browser_parity_logs")
      .insert({
        organization_id: prospect.organization_id,
        prospect_id,
        company_name: prospect.company_name,
        domain: prospect.normalized_domain,
        apollo_web_url: apollo_web_url ?? null,
        apollo_web_contacts_count: webContacts,
        kairos_endpoint: lastLog?.endpoint ?? null,
        kairos_payload: kairosPayload,
        kairos_response_summary: lastLog?.response_body ?? null,
        kairos_contacts_count: kairosContactsCount,
        kairos_parser_count: lastLog?.parser_count ?? null,
        kairos_filter_count: lastLog?.filter_count ?? null,
        kairos_credits_used: lastLog?.credits_used ?? null,
        kairos_status: lastLog?.status ?? null,
        kairos_request_id: lastLog?.apollo_request_id ?? null,
        har_uploaded: !!har_json,
        har_summary: harSummary,
        har_candidate_requests: harCandidates,
        selected_har_request: selectedHar,
        diff_summary: diffSummary,
        parity_status,
        root_cause,
      })
      .select("id")
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // System events
    await sb.from("system_events").insert([
      {
        organization_id: prospect.organization_id,
        event_type: "apollo_parity_check_completed",
        source: "apollo_browser_parity",
        payload: { prospect_id, parity_status, root_cause, id: inserted?.id },
      },
      ...(parity_status !== "match" && parity_status !== "unknown" ? [{
        organization_id: prospect.organization_id,
        event_type: "apollo_parity_mismatch_detected",
        source: "apollo_browser_parity",
        payload: { prospect_id, parity_status, root_cause },
      }] : []),
    ]);

    return new Response(JSON.stringify({
      id: inserted?.id,
      parity_status,
      root_cause,
      har_summary: harSummary,
      har_candidates_count: harCandidates.length,
      selected_har_request: selectedHar,
      diff_summary: diffSummary,
      kairos_contacts_count: kairosContactsCount,
      apollo_web_contacts_count: webContacts,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("apollo-browser-parity-check error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
