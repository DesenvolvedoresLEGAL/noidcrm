// KAI.18.8 — Apollo Endpoint Matrix / Replay Engine
// Executa endpoints do Apollo isoladamente e persiste resultados em apollo_endpoint_matrix.
// Não altera nenhum módulo do CRM/Pipeline/Forecast/OTE/Scoring.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization, prefer, accept, accept-profile, content-profile",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

const ENDPOINT_MAP: Record<string, string> = {
  "organizations/enrich": "https://api.apollo.io/api/v1/organizations/enrich",
  "mixed_companies/search": "https://api.apollo.io/api/v1/mixed_companies/search",
  "mixed_people/search": "https://api.apollo.io/api/v1/mixed_people/search",
  "mixed_people/api_search": "https://api.apollo.io/api/v1/mixed_people/api_search",
  "people/search": "https://api.apollo.io/api/v1/people/search",
  "contacts/search": "https://api.apollo.io/api/v1/contacts/search",
};

const COMPARATIVE_ORDER = [
  "organizations/enrich",
  "mixed_people/search",
  "mixed_people/api_search",
  "people/search",
  "contacts/search",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function countPeople(resp: any): { contacts: number; companies: number } {
  const contacts =
    (Array.isArray(resp?.people) ? resp.people.length : 0) +
    (Array.isArray(resp?.contacts) ? resp.contacts.length : 0);
  const companies =
    (Array.isArray(resp?.organizations) ? resp.organizations.length : 0) +
    (resp?.organization ? 1 : 0);
  return { contacts, companies };
}

async function callApollo(url: string, apiKey: string, payload: any) {
  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(payload ?? {}),
  });
  const latency = Date.now() - start;
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return {
    status: res.status,
    latency_ms: latency,
    body,
    credits_used: Number(res.headers.get("x-24-hour-usage") ?? 0) || null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) return json({ error: "APOLLO_API_KEY not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const {
      prospect_id,
      mode = "comparative_replay",
      endpoint,
      payload_override,
    } = body ?? {};

    if (!prospect_id) return json({ error: "prospect_id required" }, 400);

    const authHeader = req.headers.get("authorization") ?? "";
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: prospect } = await sb
      .from("prospects")
      .select("id, organization_id, company_name, normalized_domain, website")
      .eq("id", prospect_id)
      .maybeSingle();
    if (!prospect) return json({ error: "prospect not found" }, 404);

    // Base payloads
    const domain = prospect.normalized_domain || prospect.website || null;
    const basePayload = {
      per_page: 25,
      page: 1,
      ...(domain ? { q_organization_domains: domain } : {}),
      ...(prospect.company_name ? { q_keywords: prospect.company_name } : {}),
    };

    const toRun = mode === "single_replay" && endpoint
      ? [endpoint]
      : COMPARATIVE_ORDER;

    const results: any[] = [];
    for (const ep of toRun) {
      const url = ENDPOINT_MAP[ep];
      if (!url) {
        results.push({ endpoint: ep, error: "unknown_endpoint" });
        continue;
      }
      const payload = payload_override && mode === "single_replay"
        ? payload_override
        : ep === "organizations/enrich"
          ? { domain: domain ?? "" }
          : ep === "mixed_companies/search"
            ? { q_organization_domains: domain ?? "", per_page: 5 }
            : basePayload;

      const r = await callApollo(url, APOLLO_API_KEY, payload);
      const { contacts, companies } = countPeople(r.body);
      results.push({
        endpoint: ep,
        status: r.status,
        latency_ms: r.latency_ms,
        returned_contacts: contacts,
        returned_companies: companies,
        credits_used: r.credits_used,
        payload,
        response_summary: {
          people_count: contacts,
          companies_count: companies,
          keys: r.body ? Object.keys(r.body).slice(0, 20) : [],
          pagination: r.body?.pagination ?? null,
        },
      });
    }

    // Rank
    const sorted = [...results].sort((a, b) => {
      const ac = a.returned_contacts ?? -1, bc = b.returned_contacts ?? -1;
      if (bc !== ac) return bc - ac;
      const acr = a.credits_used ?? 9999, bcr = b.credits_used ?? 9999;
      if (acr !== bcr) return acr - bcr;
      return (a.latency_ms ?? 9999) - (b.latency_ms ?? 9999);
    });
    const top = sorted[0]?.returned_contacts ?? 0;

    const rows = sorted.map((r, i) => {
      const contacts = r.returned_contacts ?? 0;
      const efficiency = top > 0 ? contacts / top : 0;
      return {
        organization_id: prospect.organization_id,
        prospect_id,
        endpoint: r.endpoint,
        method: "POST",
        http_status: r.status ?? null,
        payload: r.payload ?? null,
        response_summary: r.response_summary ?? null,
        returned_contacts: r.returned_contacts ?? null,
        returned_companies: r.returned_companies ?? null,
        credits_used: r.credits_used ?? null,
        latency_ms: r.latency_ms ?? null,
        ranking: i + 1,
        stars: Math.max(0, Math.min(5, Math.round(efficiency * 5))),
        recommended: i === 0 && contacts > 0,
        confidence_score: Number((efficiency * 100).toFixed(2)),
        source: "replay",
        strategy: mode,
      };
    });

    if (rows.length > 0) {
      await sb.from("apollo_endpoint_matrix").insert(rows);
    }

    await sb.from("system_events").insert({
      organization_id: prospect.organization_id,
      event_type: "apollo_endpoint_matrix_replay",
      source: "apollo_endpoint_matrix",
      payload: {
        prospect_id,
        mode,
        endpoints_run: toRun,
        winner: sorted[0]?.endpoint ?? null,
        top_contacts: top,
      },
    });

    return json({
      mode,
      winner: sorted[0]?.endpoint ?? null,
      results: sorted,
    });
  } catch (error) {
    console.error("apollo-endpoint-matrix error:", error);
    return json({ error: String(error) }, 500);
  }
});
