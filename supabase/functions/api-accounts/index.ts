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

// --- Auth: same X-API-Key SHA-256 pattern as api-deals ---
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

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id);

  return { organizationId: keyData.organization_id, keyId: keyData.id };
}

// ===================== GET handlers (pull) =====================

async function handleList(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL
) {
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const cnpj = url.searchParams.get("cnpj");
  const cpf = url.searchParams.get("cpf");
  const segmento = url.searchParams.get("segmento");
  const q = url.searchParams.get("q");
  const updated_since = url.searchParams.get("updated_since");

  let query = supabase
    .from("accounts")
    .select(
      "id, razao_social, nome_fantasia, cnpj, cpf, tipo_pessoa, segmento, tamanho, porte, " +
      "cnae, cnaes_secundarios, capital_social, natureza_juridica, situacao_cadastral, " +
      "data_situacao_cadastral, data_fundacao, opcao_simples, opcao_mei, matriz_filial, " +
      "tipo_empresa, inscricao_estadual, inscricao_municipal, " +
      "lifecycle_stage, origem_principal, lead_score, lead_grade, fit_score, intent_score, " +
      "score_financeiro, risco_financeiro, score_fatores, score_calculado_em, score_updated_at, " +
      "total_titulos, titulos_pagos, titulos_vencidos, taxa_pagamento_pct, valor_total, valor_vencido, " +
      "emails, telefones, website, email_nota_fiscal, " +
      "linkedin, instagram, facebook, logo_url, " +
      "cidade, uf, cep, logradouro, numero, bairro, complemento, latitude, longitude, " +
      "owner_user_id, cs_user_id, parent_account_id, " +
      "data_tornou_cliente, qualified_at, codigo_externo, observacoes, pontuacao_nps, " +
      "erp_sync_at, created_at, updated_at",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (cnpj) query = query.eq("cnpj", cnpj);
  if (cpf) query = query.eq("cpf", cpf);
  if (segmento) query = query.eq("segmento", segmento);
  if (q) query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`);
  if (updated_since) query = query.gte("updated_at", updated_since);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return jsonResponse({
    success: true,
    data: (data || []).map(formatAccount),
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
  const cnpj = url.searchParams.get("cnpj");
  const cpf = url.searchParams.get("cpf");
  const codigo_externo = url.searchParams.get("codigo_externo");

  if (!id && !cnpj && !cpf && !codigo_externo) {
    return jsonResponse(
      { success: false, error: "Provide id, cnpj, cpf, or codigo_externo parameter" },
      400
    );
  }

  let query = supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", orgId)
    .is("deleted_at", null);

  if (id) query = query.eq("id", id);
  else if (cnpj) query = query.eq("cnpj", cnpj);
  else if (cpf) query = query.eq("cpf", cpf);
  else if (codigo_externo) query = query.eq("codigo_externo", codigo_externo);

  const { data: account, error } = await query.maybeSingle();
  if (error) throw error;
  if (!account) {
    return jsonResponse({ success: false, error: "Account not found" }, 404);
  }

  // Enrich with counts
  const [opps, contacts, contracts] = await Promise.all([
    supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("account_id", account.id),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("account_id", account.id),
    supabase.from("contracts").select("*", { count: "exact", head: true }).eq("account_id", account.id),
  ]);

  return jsonResponse({
    success: true,
    data: {
      ...formatAccount(account),
      opportunities_count: opps.count || 0,
      contacts_count: contacts.count || 0,
      contracts_count: contracts.count || 0,
    },
    synced_at: new Date().toISOString(),
  });
}

// ===================== POST handler (push/webhook) =====================

interface WebhookEvent {
  event_type: string;
  account_identifier: {
    cnpj?: string;
    cpf?: string;
    codigo_externo?: string;
    id?: string;
  };
  data: Record<string, unknown>;
  timestamp?: string;
}

const ALLOWED_UPDATE_FIELDS = new Set([
  // Cadastral
  "razao_social", "nome_fantasia",
  "pontuacao_nps", "codigo_externo", "observacoes",
  "segmento", "tamanho", "origem_principal", "data_tornou_cliente",
  // Address
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  // Contact
  "telefones", "emails", "website",
  // Registration
  "inscricao_estadual", "inscricao_municipal",
  "situacao_cadastral", "data_situacao_cadastral",
  // Financial (from ERP)
  "score_financeiro", "risco_financeiro", "score_fatores", "score_calculado_em",
  "total_titulos", "titulos_pagos", "titulos_vencidos", "taxa_pagamento_pct",
  "valor_total", "valor_vencido",
]);

async function handleWebhook(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  body: unknown
) {
  if (!body || typeof body !== "object") {
    return jsonResponse({ success: false, error: "Invalid request body" }, 400);
  }

  const events: WebhookEvent[] = Array.isArray(body) ? body : [body as WebhookEvent];

  if (events.length > 100) {
    return jsonResponse({ success: false, error: "Max 100 events per batch" }, 400);
  }

  const results: Array<{ status: string; identifier: unknown; error?: string }> = [];

  for (const event of events) {
    try {
      if (!event.event_type || !event.account_identifier) {
        results.push({ status: "error", identifier: null, error: "Missing event_type or account_identifier" });
        continue;
      }

      const ident = event.account_identifier;
      // Find the account
      let query = supabase
        .from("accounts")
        .select("id")
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (ident.id) query = query.eq("id", ident.id);
      else if (ident.cnpj) query = query.eq("cnpj", ident.cnpj);
      else if (ident.cpf) query = query.eq("cpf", ident.cpf);
      else if (ident.codigo_externo) query = query.eq("codigo_externo", ident.codigo_externo);
      else {
        results.push({ status: "error", identifier: ident, error: "No valid identifier provided" });
        continue;
      }

      const { data: account, error: findError } = await query.maybeSingle();
      if (findError || !account) {
        results.push({ status: "error", identifier: ident, error: "Account not found" });
        continue;
      }

      if (event.event_type === "account.updated") {
        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(event.data || {})) {
          if (ALLOWED_UPDATE_FIELDS.has(key)) {
            updateData[key] = value;
          }
        }

        if (Object.keys(updateData).length === 0) {
          results.push({ status: "skipped", identifier: ident, error: "No updatable fields provided" });
          continue;
        }

        updateData.updated_at = new Date().toISOString();
        updateData.erp_sync_at = new Date().toISOString();

        const { error: updateError } = await supabase
          .from("accounts")
          .update(updateData)
          .eq("id", account.id);

        if (updateError) {
          results.push({ status: "error", identifier: ident, error: updateError.message });
          continue;
        }

        results.push({ status: "updated", identifier: ident });

      } else if (event.event_type === "financial.updated") {
        // ERP sends financial metrics → update financial columns
        const financialData: Record<string, unknown> = {};
        const financialKeys = [
          "score_financeiro", "risco_financeiro", "score_fatores", "score_calculado_em",
          "total_titulos", "titulos_pagos", "titulos_vencidos", "taxa_pagamento_pct",
          "valor_total", "valor_vencido",
          "pontuacao_nps", "observacoes",
        ];
        for (const [key, value] of Object.entries(event.data || {})) {
          if (financialKeys.includes(key)) {
            financialData[key] = value;
          }
        }

        if (Object.keys(financialData).length > 0) {
          financialData.updated_at = new Date().toISOString();
          financialData.erp_sync_at = new Date().toISOString();
          const { error: upErr } = await supabase.from("accounts").update(financialData).eq("id", account.id);
          if (upErr) {
            results.push({ status: "error", identifier: ident, error: upErr.message });
            continue;
          }
        }

        // Log to audit
        await supabase.from("audit_log").insert({
          action: "erp_financial_update",
          entity_type: "account",
          entity_id: account.id,
          organization_id: orgId,
          metadata: { event_type: event.event_type, data: event.data, timestamp: event.timestamp },
        });

        results.push({ status: "financial_updated", identifier: ident });

      } else if (event.event_type === "score.refresh") {
        // Update score fields directly from ERP data
        const scoreData: Record<string, unknown> = {};
        const scoreKeys = ["score_financeiro", "risco_financeiro", "score_fatores"];
        for (const [key, value] of Object.entries(event.data || {})) {
          if (scoreKeys.includes(key)) {
            scoreData[key] = value;
          }
        }

        scoreData.score_calculado_em = new Date().toISOString();
        scoreData.updated_at = new Date().toISOString();
        scoreData.erp_sync_at = new Date().toISOString();

        const { error: scoreErr } = await supabase.from("accounts").update(scoreData).eq("id", account.id);
        if (scoreErr) {
          results.push({ status: "error", identifier: ident, error: scoreErr.message });
          continue;
        }

        // Also log
        await supabase.from("audit_log").insert({
          action: "erp_score_refresh",
          entity_type: "account",
          entity_id: account.id,
          organization_id: orgId,
          metadata: { event_type: event.event_type, data: event.data, timestamp: event.timestamp },
        });

        results.push({ status: "score_refreshed", identifier: ident });

      } else {
        results.push({ status: "skipped", identifier: ident, error: `Unknown event_type: ${event.event_type}` });
      }

    } catch (err) {
      results.push({
        status: "error",
        identifier: event?.account_identifier || null,
        error: (err as Error).message,
      });
    }
  }

  const successCount = results.filter((r) => !["error", "skipped"].includes(r.status)).length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return jsonResponse({
    success: errorCount === 0,
    processed: results.length,
    success_count: successCount,
    error_count: errorCount,
    results,
    synced_at: new Date().toISOString(),
  });
}

// ===================== Format helper =====================

function formatAccount(account: Record<string, unknown>) {
  // Extract emails/phones from JSONB
  const rawEmails = account.emails as unknown;
  let primaryEmail: string | null = null;
  if (Array.isArray(rawEmails) && rawEmails.length > 0) {
    const primary = rawEmails.find((e: Record<string, unknown>) => e.is_primary) || rawEmails[0];
    primaryEmail = typeof primary === "string" ? primary : (primary as Record<string, unknown>)?.value as string || null;
  }

  const rawPhones = account.telefones as unknown;
  let primaryPhone: string | null = null;
  if (Array.isArray(rawPhones) && rawPhones.length > 0) {
    const primary = rawPhones.find((p: Record<string, unknown>) => p.is_primary) || rawPhones[0];
    primaryPhone = typeof primary === "string" ? primary : (primary as Record<string, unknown>)?.numero as string || (primary as Record<string, unknown>)?.value as string || null;
  }

  return {
    id: account.id,

    // Identificação
    razao_social: account.razao_social,
    nome_fantasia: account.nome_fantasia,
    cnpj: account.cnpj,
    cpf: account.cpf,
    tipo_pessoa: account.tipo_pessoa,
    tipo_empresa: account.tipo_empresa,
    matriz_filial: account.matriz_filial,
    inscricao_estadual: account.inscricao_estadual,
    inscricao_municipal: account.inscricao_municipal,

    // Classificação
    segmento: account.segmento,
    tamanho: account.tamanho,
    porte: account.porte,
    cnae: account.cnae,
    cnaes_secundarios: account.cnaes_secundarios,
    natureza_juridica: account.natureza_juridica,
    situacao_cadastral: account.situacao_cadastral,
    data_situacao_cadastral: account.data_situacao_cadastral,
    data_fundacao: account.data_fundacao,
    capital_social: account.capital_social,
    opcao_simples: account.opcao_simples,
    opcao_mei: account.opcao_mei,

    // Lifecycle / Origem
    lifecycle_stage: account.lifecycle_stage,
    origem_principal: account.origem_principal,
    data_tornou_cliente: account.data_tornou_cliente,
    qualified_at: account.qualified_at,

    // Lead Score (CRM-side)
    lead_score: account.lead_score,
    lead_grade: account.lead_grade,
    fit_score: account.fit_score,
    intent_score: account.intent_score,
    score_updated_at: account.score_updated_at,

    // Contact (flattened + raw)
    primary_email: primaryEmail,
    primary_phone: primaryPhone,
    emails: account.emails,
    telefones: account.telefones,
    website: account.website,
    email_nota_fiscal: account.email_nota_fiscal,

    // Social / Visual
    linkedin: account.linkedin,
    instagram: account.instagram,
    facebook: account.facebook,
    logo_url: account.logo_url,

    // Address
    cidade: account.cidade,
    uf: account.uf,
    cep: account.cep,
    logradouro: account.logradouro,
    numero: account.numero,
    bairro: account.bairro,
    complemento: account.complemento,
    latitude: account.latitude,
    longitude: account.longitude,
    endereco: [account.logradouro, account.numero, account.complemento, account.bairro]
      .filter(Boolean)
      .join(", ") || null,

    // Owners / IDs
    owner_user_id: account.owner_user_id,
    cs_user_id: account.cs_user_id,
    parent_account_id: account.parent_account_id,
    codigo_externo: account.codigo_externo,

    // Notas / NPS
    observacoes: account.observacoes,
    pontuacao_nps: account.pontuacao_nps,

    // Financial (ERP)
    score_financeiro: account.score_financeiro,
    risco_financeiro: account.risco_financeiro,
    score_fatores: account.score_fatores,
    score_calculado_em: account.score_calculado_em,
    total_titulos: account.total_titulos,
    titulos_pagos: account.titulos_pagos,
    titulos_vencidos: account.titulos_vencidos,
    taxa_pagamento_pct: account.taxa_pagamento_pct,
    valor_total: account.valor_total,
    valor_vencido: account.valor_vencido,
    erp_sync_at: account.erp_sync_at,

    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

// ===================== Main handler =====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // GET → Pull (consulta)
    if (req.method === "GET") {
      const action = url.searchParams.get("action") || "";
      if (action === "list") return await handleList(supabaseAdmin, organizationId, url);
      if (action === "get") return await handleGet(supabaseAdmin, organizationId, url);
      return jsonResponse({ success: false, error: "Unknown action. Use ?action=list or ?action=get" }, 400);
    }

    // POST → Push (webhook do ERP)
    if (req.method === "POST") {
      const body = await req.json();
      return await handleWebhook(supabaseAdmin, organizationId, body);
    }

    return jsonResponse({ success: false, error: "Method not allowed. Use GET or POST" }, 405);

  } catch (err) {
    console.error("api-accounts error:", err);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});
