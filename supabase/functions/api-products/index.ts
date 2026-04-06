import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeApiKey(rawValue: string | null): string {
  if (!rawValue) return "";

  let value = rawValue.trim();

  if (value.toLowerCase().startsWith("bearer ")) {
    value = value.slice(7).trim();
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value.replace(/[\r\n\t]/g, "").trim();
}

// Validate API key and return organization_id
async function authenticateApiKey(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ organizationId: string; keyId: string } | Response> {
  const rawApiKey =
    req.headers.get("x-api-key") ||
    req.headers.get("X-API-Key") ||
    req.headers.get("X-Api-Key") ||
    req.headers.get("apikey") ||
    req.headers.get("Authorization");

  const apiKey = normalizeApiKey(rawApiKey);
  if (!apiKey) {
    return jsonResponse({ success: false, error: "Missing API key" }, 401);
  }

  // Hash the key with SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: keyData, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, organization_id, scopes, active, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyData) {
    return jsonResponse({ success: false, error: "Invalid API key" }, 401);
  }

  if (!keyData.active) {
    return jsonResponse({ success: false, error: "API key is inactive" }, 401);
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return jsonResponse({ success: false, error: "API key has expired" }, 401);
  }

  // Update last_used_at
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id);

  return { organizationId: keyData.organization_id, keyId: keyData.id };
}

function hasScope(scopes: string[] | null, required: string): boolean {
  if (!scopes || scopes.length === 0) return true; // empty scopes = full access
  return scopes.includes(required) || scopes.includes("*");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate
    const authResult = await authenticateApiKey(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;
    const { organizationId } = authResult;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    if (req.method === "GET") {
      if (action === "list") {
        return await handleList(supabaseAdmin, organizationId, url);
      }
      if (action === "get") {
        return await handleGet(supabaseAdmin, organizationId, url);
      }
      return jsonResponse({ success: false, error: "Unknown action. Use ?action=list or ?action=get" }, 400);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const postAction = body.action || action;

      if (postAction === "upsert") {
        return await handleUpsert(supabaseAdmin, organizationId, body.data);
      }
      if (postAction === "bulk_upsert") {
        return await handleBulkUpsert(supabaseAdmin, organizationId, body.items);
      }
      return jsonResponse({ success: false, error: "Unknown action. Use upsert or bulk_upsert" }, 400);
    }

    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("api-products error:", err);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});

// --- Handlers ---

async function handleList(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL
) {
  const active = url.searchParams.get("active");
  const q = url.searchParams.get("q");
  const type = url.searchParams.get("type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .order("name")
    .range(offset, offset + limit - 1);

  if (active !== null) {
    query = query.eq("active", active === "true");
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,external_id.ilike.%${q}%`);
  }
  if (type) {
    query = query.eq("type", type);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return jsonResponse({
    success: true,
    data,
    total: count || 0,
    limit,
    offset,
    synced_at: new Date().toISOString(),
  });
}

async function handleGet(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL
) {
  const id = url.searchParams.get("id");
  const externalId = url.searchParams.get("external_id");

  if (!id && !externalId) {
    return jsonResponse({ success: false, error: "Provide id or external_id parameter" }, 400);
  }

  let query = supabase
    .from("products")
    .select("*")
    .eq("organization_id", orgId);

  if (id) {
    query = query.eq("id", id);
  } else if (externalId) {
    query = query.eq("external_id", externalId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;

  if (!data) {
    return jsonResponse({ success: false, error: "Product not found" }, 404);
  }

  return jsonResponse({ success: true, data, synced_at: new Date().toISOString() });
}

async function handleUpsert(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  productData: unknown
) {
  if (!productData || typeof productData !== "object") {
    return jsonResponse({ success: false, error: "Missing data object" }, 400);
  }

  const d = productData as Record<string, unknown>;

  if (!d.external_id || typeof d.external_id !== "string") {
    return jsonResponse({ success: false, error: "external_id is required for upsert" }, 400);
  }
  if (!d.name || typeof d.name !== "string") {
    return jsonResponse({ success: false, error: "name is required" }, 400);
  }

  const now = new Date().toISOString();

  const record = {
    organization_id: orgId,
    external_id: d.external_id,
    external_source: (d.external_source as string) || "human_erp",
    name: d.name,
    code: d.code ?? null,
    description: d.description ?? null,
    price: typeof d.price === "number" ? d.price : null,
    cost: typeof d.cost === "number" ? d.cost : null,
    type: d.type === "servico" ? "servico" : "produto",
    unit: (d.unit as string) || "un",
    active: d.active !== false,
    reference: d.reference ?? null,
    ipi_percent: typeof d.ipi_percent === "number" ? d.ipi_percent : 0,
    billing_type: d.billing_type === "recurring" ? "recurring" : "one_time",
    billing_cycle: d.billing_cycle ?? null,
    monthly_price: typeof d.monthly_price === "number" ? d.monthly_price : null,
    minimum_contract_months:
      typeof d.minimum_contract_months === "number"
        ? d.minimum_contract_months
        : null,
    counts_for_commission: d.counts_for_commission !== false,
    last_synced_at: now,
  };

  // Check if product exists by external_id + org
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("organization_id", orgId)
    .eq("external_id", d.external_id)
    .eq("external_source", record.external_source)
    .maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from("products")
      .update(record)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    result = { data, created: false };
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert([record])
      .select()
      .single();
    if (error) throw error;
    result = { data, created: true };
  }

  return jsonResponse({
    success: true,
    data: result.data,
    created: result.created,
    synced_at: now,
  });
}

async function handleBulkUpsert(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  items: unknown
) {
  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse({ success: false, error: "items must be a non-empty array" }, 400);
  }

  if (items.length > 100) {
    return jsonResponse({ success: false, error: "Maximum 100 items per request" }, 400);
  }

  const results: Array<{ external_id: string; success: boolean; created?: boolean; error?: string }> = [];
  const now = new Date().toISOString();

  for (const item of items) {
    try {
      if (!item.external_id || !item.name) {
        results.push({ external_id: item.external_id || "unknown", success: false, error: "external_id and name required" });
        continue;
      }

      const record = {
        organization_id: orgId,
        external_id: item.external_id,
        external_source: item.external_source || "human_erp",
        name: item.name,
        code: item.code ?? null,
        description: item.description ?? null,
        price: typeof item.price === "number" ? item.price : null,
        cost: typeof item.cost === "number" ? item.cost : null,
        type: item.type === "servico" ? "servico" : "produto",
        unit: item.unit || "un",
        active: item.active !== false,
        reference: item.reference ?? null,
        ipi_percent: typeof item.ipi_percent === "number" ? item.ipi_percent : 0,
        billing_type: item.billing_type === "recurring" ? "recurring" : "one_time",
        billing_cycle: item.billing_cycle ?? null,
        monthly_price: typeof item.monthly_price === "number" ? item.monthly_price : null,
        minimum_contract_months: typeof item.minimum_contract_months === "number" ? item.minimum_contract_months : null,
        counts_for_commission: item.counts_for_commission !== false,
        last_synced_at: now,
      };

      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("organization_id", orgId)
        .eq("external_id", item.external_id)
        .eq("external_source", record.external_source)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("products")
          .update(record)
          .eq("id", existing.id);
        if (error) throw error;
        results.push({ external_id: item.external_id, success: true, created: false });
      } else {
        const { error } = await supabase
          .from("products")
          .insert([record]);
        if (error) throw error;
        results.push({ external_id: item.external_id, success: true, created: true });
      }
    } catch (err) {
      results.push({ external_id: item.external_id || "unknown", success: false, error: (err as Error).message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  return jsonResponse({
    success: errorCount === 0,
    results,
    summary: { total: items.length, success: successCount, errors: errorCount },
    synced_at: now,
  });
}
