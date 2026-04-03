import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const { account_id } = await req.json();
    if (!account_id) {
      return jsonResponse({ error: "account_id is required" }, 400);
    }

    // Get account with CNPJ
    const { data: account, error: accError } = await supabase
      .from("accounts")
      .select("id, cnpj, cpf, organization_id, razao_social")
      .eq("id", account_id)
      .maybeSingle();

    if (accError || !account) {
      return jsonResponse({ error: "Account not found" }, 404);
    }

    const document = account.cnpj || account.cpf;
    if (!document) {
      return jsonResponse({ error: "Account has no CNPJ/CPF to query ERP" }, 400);
    }

    // Call ERP API
    const erpApiKey = Deno.env.get("HUMAN_ERP_API_KEY");
    const erpBaseUrl = Deno.env.get("HUMAN_ERP_BASE_URL");

    if (!erpApiKey || !erpBaseUrl) {
      return jsonResponse({ error: "ERP API not configured" }, 500);
    }

    const cleanDoc = document.replace(/\D/g, "");
    const erpUrl = `${erpBaseUrl}/account-data?document=${cleanDoc}`;
    
    console.log(`[sync-account-from-erp] Fetching from ERP: ${erpUrl}`);

    const erpResponse = await fetch(erpUrl, {
      headers: {
        "X-API-Key": erpApiKey,
        "Content-Type": "application/json",
      },
    });

    if (!erpResponse.ok) {
      const errText = await erpResponse.text();
      console.error(`[sync-account-from-erp] ERP error ${erpResponse.status}: ${errText}`);
      return jsonResponse({ error: `ERP returned ${erpResponse.status}` }, 502);
    }

    const erpData = await erpResponse.json();
    console.log(`[sync-account-from-erp] ERP response:`, JSON.stringify(erpData));

    // Map ERP response to CRM fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      erp_sync_at: new Date().toISOString(),
    };

    // Financial score fields
    const fieldMap: Record<string, string> = {
      score_financeiro: "score_financeiro",
      risco_financeiro: "risco_financeiro",
      score_fatores: "score_fatores",
      score_calculado_em: "score_calculado_em",
      total_titulos: "total_titulos",
      titulos_pagos: "titulos_pagos",
      titulos_vencidos: "titulos_vencidos",
      taxa_pagamento_pct: "taxa_pagamento_pct",
      valor_total: "valor_total",
      valor_vencido: "valor_vencido",
    };

    // Try to extract from erpData.score or erpData directly
    const scoreData = erpData.score || erpData.financial || erpData;

    for (const [erpKey, crmKey] of Object.entries(fieldMap)) {
      if (scoreData[erpKey] !== undefined) {
        updateData[crmKey] = scoreData[erpKey];
      }
    }

    // Also map alternative field names from ERP
    if (scoreData.value !== undefined && updateData.score_financeiro === undefined) {
      updateData.score_financeiro = scoreData.value;
    }
    if (scoreData.risk_level !== undefined && updateData.risco_financeiro === undefined) {
      updateData.risco_financeiro = scoreData.risk_level;
    }
    if (scoreData.factors !== undefined && updateData.score_fatores === undefined) {
      updateData.score_fatores = scoreData.factors;
    }

    // Update account
    const { error: updateError } = await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", account.id);

    if (updateError) {
      console.error(`[sync-account-from-erp] Update error:`, updateError);
      return jsonResponse({ error: "Failed to update account" }, 500);
    }

    // Audit log
    await supabase.from("audit_log").insert({
      action: "erp_manual_sync",
      entity_type: "account",
      entity_id: account.id,
      organization_id: account.organization_id,
      actor_user_id: userId,
      metadata: {
        source: "manual_pull",
        document: cleanDoc,
        fields_updated: Object.keys(updateData).filter(k => k !== "updated_at" && k !== "erp_sync_at"),
      },
    });

    console.log(`[sync-account-from-erp] Successfully synced account ${account.id}`);

    return jsonResponse({
      success: true,
      synced_fields: Object.keys(updateData).filter(k => k !== "updated_at" && k !== "erp_sync_at"),
      erp_sync_at: updateData.erp_sync_at,
    });

  } catch (err) {
    console.error("[sync-account-from-erp] Error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
