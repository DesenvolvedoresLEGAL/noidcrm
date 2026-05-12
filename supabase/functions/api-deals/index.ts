import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

async function authenticateApiKey(
  req: Request,
  supabaseAdmin: any
): Promise<{ organizationId: string; keyId: string } | Response> {
  const rawApiKey =
    req.headers.get("x-api-key") ||
    req.headers.get("X-API-Key") ||
    req.headers.get("X-Api-Key") ||
    req.headers.get("apikey") ||
    req.headers.get("Authorization");

  const apiKey = normalizeApiKey(rawApiKey);

  if (!apiKey) {
    console.error("[api-deals] AUTH FAIL: Missing API key. Headers present:", [...new Headers(req.headers).keys()].join(", "));
    return jsonResponse({ success: false, error: "Missing API key" }, 401);
  }

  const keyPrefix = apiKey.substring(0, 12);
  console.log(`[api-deals] AUTH: Received normalized key with prefix '${keyPrefix}'`);

  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: keyDataRaw, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, organization_id, scopes, active, expires_at, name, key_prefix")
    .eq("key_hash", keyHash)
    .maybeSingle();
  const keyData = keyDataRaw as {
    id: string;
    organization_id: string;
    scopes: string[] | null;
    active: boolean;
    expires_at: string | null;
    name: string;
    key_prefix: string;
  } | null;

  if (error) {
    console.error("[api-deals] AUTH FAIL: DB error looking up key:", error.message);
    return jsonResponse({ success: false, error: "Internal auth error" }, 500);
  }

  if (!keyData) {
    const { data: prefixMatch } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, key_prefix, active")
      .eq("key_prefix", keyPrefix)
      .maybeSingle();

    if (prefixMatch) {
      console.error(`[api-deals] AUTH FAIL: Key prefix '${keyPrefix}' exists (name: '${prefixMatch.name}', active: ${prefixMatch.active}) but HASH DOES NOT MATCH after normalization.`);
    } else {
      console.error(`[api-deals] AUTH FAIL: No key found with prefix '${keyPrefix}' or matching hash after normalization.`);
    }
    return jsonResponse({ success: false, error: "Invalid API key" }, 401);
  }

  if (!keyData.active) {
    console.error(`[api-deals] AUTH FAIL: Key '${keyData.name}' (${keyData.key_prefix}) is INACTIVE.`);
    return jsonResponse({ success: false, error: "API key is inactive" }, 401);
  }

  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    console.error(`[api-deals] AUTH FAIL: Key '${keyData.name}' (${keyData.key_prefix}) EXPIRED at ${keyData.expires_at}.`);
    return jsonResponse({ success: false, error: "API key has expired" }, 401);
  }

  console.log(`[api-deals] AUTH OK: Key '${keyData.name}' (${keyData.key_prefix}) for org ${keyData.organization_id}`);

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id);

  return { organizationId: keyData.organization_id, keyId: keyData.id };
}

// Build a deal object from proposal + related data
async function buildDeal(
  supabase: any,
  proposal: Record<string, unknown>
) {
  const proposalId = proposal.id as string;
  const opportunityId = proposal.opportunity_id as string | null;
  const organizationId = proposal.organization_id as string;

  // Fetch opportunity
  let opportunity: Record<string, unknown> | null = null;
  if (opportunityId) {
    const { data } = await supabase
      .from("opportunities")
      .select("id, title, account_id, contact_id, valor_previsto, pipeline_id, stage_id")
      .eq("id", opportunityId)
      .maybeSingle();
    opportunity = data;
  }

  // Fetch account (company)
  let account: Record<string, unknown> | null = null;
  const accountId = opportunity?.account_id as string | null;
  if (accountId) {
    const { data } = await supabase
      .from("accounts")
      .select("id, razao_social, nome_fantasia, cnpj, cpf, emails, telefones, tipo_pessoa, cidade, uf, cep, logradouro, numero, bairro, complemento")
      .eq("id", accountId)
      .maybeSingle();
    account = data;
  }

  // Fetch contact
  let contact: Record<string, unknown> | null = null;
  const contactId = opportunity?.contact_id as string | null;
  if (contactId) {
    const { data } = await supabase
      .from("contacts")
      .select("id, nome, cargo, emails, telefones")
      .eq("id", contactId)
      .maybeSingle();
    contact = data;
  }

  // Fetch proposal items with correct column names
  const { data: items } = await supabase
    .from("proposal_items")
    .select("id, product_id, name, description, quantity, unit_price, discount_percent, total, billing_type, minimum_contract_months, order_index")
    .eq("proposal_id", proposalId)
    .order("order_index");

  // Proposal-level financials — SINGLE SOURCE OF TRUTH for ERP.
  // Priority for the NET amount actually charged to the client:
  //   1) payment_expected_amount  → NET after dynamic pricing AND manual discount (set by orchestrate_proposal_financials)
  //   2) dynamic_pricing_current_amount → gross vigente (dynamic pricing only)
  //   3) total_amount → sum of items (no dynamic pricing, no manual discount)
  //   4) subtotal - discount_amount
  const proposalSubtotal = Number(proposal.subtotal) || 0;
  const proposalDiscountAmount = Number(proposal.discount_amount) || 0;
  const proposalTotalAmount = Number(proposal.total_amount) || 0;
  const proposalPaymentExpected = Number((proposal as any).payment_expected_amount) || 0;
  const proposalDynamicCurrent = Number((proposal as any).dynamic_pricing_current_amount) || 0;

  const netTotal = proposalPaymentExpected > 0
    ? proposalPaymentExpected
    : proposalDynamicCurrent > 0
      ? proposalDynamicCurrent
      : proposalTotalAmount > 0
        ? proposalTotalAmount
        : Math.max(proposalSubtotal - proposalDiscountAmount, 0);
  const discountTotal = proposalDiscountAmount > 0
    ? proposalDiscountAmount
    : Math.max(proposalSubtotal - netTotal, 0);
  const discountPercent = proposalSubtotal > 0
    ? Number(((discountTotal / proposalSubtotal) * 100).toFixed(2))
    : 0;

  // Fetch payment terms with correct column names
  const { data: paymentTerms } = await supabase
    .from("proposal_payment_terms")
    .select("id, payment_type, installments, installment_interval_days, first_installment_date, first_payment_date, contract_start_date, contract_duration_months, monthly_value, contract_total, billing_day, comments")
    .eq("proposal_id", proposalId)
    .maybeSingle();

  // Calculate total amount using correct column
  // Items gross total (sum of line item totals — pre payment-discount)
  const itemsGrossTotal = (items || []).reduce((sum: number, item: Record<string, unknown>) => {
    return sum + (Number(item.total) || 0);
  }, 0);
  // Final amount = single source of truth = net total from proposal level
  const totalAmount = netTotal > 0 ? netTotal : itemsGrossTotal;

  // Derive vencimento from payment terms
  let vencimento: string | null = null;
  if (paymentTerms) {
    if (paymentTerms.payment_type === "one_time") {
      vencimento = (paymentTerms.first_installment_date as string) || null;
    } else {
      vencimento = (paymentTerms.first_payment_date as string) || (paymentTerms.contract_start_date as string) || null;
    }
  }

  // Extract first email/phone from account (JSONB format: [{value: "..."}])
  const rawEmails = account?.emails as unknown;
  let companyEmail: string | null = null;
  if (Array.isArray(rawEmails) && rawEmails.length > 0) {
    const first = rawEmails[0];
    companyEmail = typeof first === "string" ? first : (first as Record<string, unknown>)?.value as string || null;
  }

  const telefones = account?.telefones as unknown;
  let companyPhone: string | null = null;
  if (Array.isArray(telefones) && telefones.length > 0) {
    const first = telefones[0];
    companyPhone = typeof first === "string" ? first : (first as Record<string, unknown>)?.numero as string || (first as Record<string, unknown>)?.value as string || null;
  }

  return {
    id: proposalId,
    title: (opportunity?.title as string) || (proposal.title as string) || "Sem título",
    amount: totalAmount,
    // Financial breakdown — single source of truth (net = total - discount)
    net_total: netTotal,
    discount_total: discountTotal,
    discount_percent: discountPercent,
    subtotal: proposalSubtotal,
    gross_total: itemsGrossTotal,
    total_with_discount: netTotal,
    valor_liquido: netTotal,
    final_amount: netTotal,
    total_negotiated: netTotal,
    contract_total: paymentTerms?.contract_total ? Number(paymentTerms.contract_total) : netTotal,
    status: "won",
    won_date: (proposal.accepted_at as string) || null,
    created_at: proposal.created_at as string,
    expires_at: proposal.expires_at as string | null,
    vencimento,
    proposal_status: proposal.status as string,
    opportunity_id: opportunityId,

    // Company
    company_name: (account?.razao_social as string) || (proposal.client_name as string) || null,
    company_trade_name: (account?.nome_fantasia as string) || null,
    company_document: (account?.cnpj as string) || (account?.cpf as string) || null,
    company_document_type: account?.cnpj ? "cnpj" : account?.cpf ? "cpf" : null,
    company_email: companyEmail,
    company_phone: companyPhone,
    company_type: (account?.tipo_pessoa as string) || null,
    company_city: (account?.cidade as string) || null,
    company_state: (account?.uf as string) || null,
    company_zip: (account?.cep as string) || null,
    company_address: account ? [account.logradouro, account.numero, account.complemento, account.bairro].filter(Boolean).join(", ") : null,

    // Contact
    contact_name: (contact?.nome as string) || (proposal.client_name as string) || null,
    contact_email: (Array.isArray(contact?.emails) && contact.emails.length > 0
      ? (typeof contact.emails[0] === 'string'
          ? contact.emails[0]
          : (contact.emails[0] as Record<string, unknown>)?.value)
      : null) as string | null || (proposal.client_email as string) || null,
    contact_phone: (Array.isArray(contact?.telefones) && contact.telefones.length > 0
      ? (typeof contact.telefones[0] === 'string'
          ? contact.telefones[0]
          : ((contact.telefones[0] as Record<string, unknown>)?.numero || (contact.telefones[0] as Record<string, unknown>)?.value))
      : null) as string | null,
    contact_position: (contact?.cargo as string) || null,

    // Products
    products: (items || []).map((item: Record<string, unknown>) => ({
      id: item.id,
      product_id: item.product_id,
      name: item.name,
      description: item.description,
      price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 1,
      discount_percent: Number(item.discount_percent) || 0,
      total_price: Number(item.total) || 0,
      billing_type: item.billing_type || "one_time",
      minimum_contract_months: item.minimum_contract_months ? Number(item.minimum_contract_months) : null,
    })),

    // Payment terms
    payment_terms: paymentTerms
      ? {
          payment_type: paymentTerms.payment_type,
          installments: paymentTerms.installments,
          installment_interval_days: paymentTerms.installment_interval_days,
          first_installment_date: paymentTerms.first_installment_date,
          first_payment_date: paymentTerms.first_payment_date,
          contract_start_date: paymentTerms.contract_start_date,
          contract_duration_months: paymentTerms.contract_duration_months,
          monthly_value: paymentTerms.monthly_value ? Number(paymentTerms.monthly_value) : null,
          contract_total: paymentTerms.contract_total ? Number(paymentTerms.contract_total) : null,
          billing_day: paymentTerms.billing_day,
          comments: paymentTerms.comments,
          vencimento,
        }
      : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authResult = await authenticateApiKey(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;
    const { organizationId } = authResult;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    if (action === "list") {
      return await handleList(supabaseAdmin, organizationId, url);
    }
    if (action === "get") {
      return await handleGet(supabaseAdmin, organizationId, url);
    }

    return jsonResponse({ success: false, error: "Unknown action. Use ?action=list or ?action=get" }, 400);
  } catch (err) {
    console.error("api-deals error:", err);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});

async function handleList(
  supabase: any,
  orgId: string,
  url: URL
) {
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Map ERP status to proposal status
  let proposalStatuses: string[];
  if (status === "won") {
    proposalStatuses = ["accepted"];
  } else if (status === "all") {
    proposalStatuses = ["sent", "viewed", "accepted", "rejected"];
  } else {
    // Default: only accepted (won)
    proposalStatuses = ["accepted"];
  }

  const { data: proposals, error, count } = await supabase
    .from("proposals")
    .select("id, opportunity_id, organization_id, status, title, client_name, client_email, value, subtotal, discount_amount, total_amount, payment_expected_amount, dynamic_pricing_current_amount, created_at, accepted_at, expires_at", { count: "exact" })
    .eq("organization_id", orgId)
    .in("status", proposalStatuses)
    .is("deleted_at", null)
    .order("accepted_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const deals = [];
  for (const proposal of proposals || []) {
    deals.push(await buildDeal(supabase, proposal));
  }

  return jsonResponse({
    success: true,
    data: deals,
    total: count || 0,
    limit,
    offset,
    synced_at: new Date().toISOString(),
  });
}

async function handleGet(
  supabase: any,
  orgId: string,
  url: URL
) {
  const id = url.searchParams.get("id");
  if (!id) {
    return jsonResponse({ success: false, error: "Provide id parameter" }, 400);
  }

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("id, opportunity_id, organization_id, status, title, client_name, client_email, value, subtotal, discount_amount, total_amount, payment_expected_amount, dynamic_pricing_current_amount, created_at, accepted_at, expires_at")
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;

  if (!proposal) {
    return jsonResponse({ success: false, error: "Deal not found" }, 404);
  }

  const deal = await buildDeal(supabase, proposal);

  return jsonResponse({ success: true, data: deal, synced_at: new Date().toISOString() });
}
