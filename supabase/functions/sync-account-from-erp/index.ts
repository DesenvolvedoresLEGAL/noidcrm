import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function normalizeBaseUrl(rawValue: string | null): string {
  if (!rawValue) return "";

  let value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  value = value.replace(/[\r\n\t]/g, "").replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  if (!/\/functions\/v1$/i.test(value)) {
    value = `${value}/functions/v1`;
  }

  return value;
}

function getFetchErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const upper = message.toUpperCase();

  if (upper.includes("NAME_NOT_RESOLVED") || upper.includes("DNS") || upper.includes("ENOTFOUND")) {
    return {
      error: "Não foi possível localizar o ERP. Verifique a URL base configurada.",
      error_type: "ERP_BASE_URL_INVALID",
    };
  }

  if (upper.includes("TIMED OUT") || upper.includes("TIMEOUT")) {
    return {
      error: "ERP demorou demais para responder. Tente novamente em alguns minutos.",
      error_type: "ERP_TIMEOUT",
    };
  }

  return {
    error: "ERP indisponível — tente novamente em alguns minutos",
    error_type: "ERP_NETWORK_ERROR",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
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

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = user.id;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { account_id } = await req.json();
    if (!account_id) {
      return jsonResponse({ error: "account_id is required" }, 400);
    }

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

    const erpApiKey = normalizeApiKey(Deno.env.get("HUMAN_ERP_API_KEY"));
    const erpBaseUrl = normalizeBaseUrl(Deno.env.get("HUMAN_ERP_BASE_URL"));

    if (!erpApiKey || !erpBaseUrl) {
      return jsonResponse({
        success: false,
        error: "ERP não configurado",
        error_type: "ERP_NOT_CONFIGURED",
        fallback: true,
      });
    }

    const cleanDoc = document.replace(/\D/g, "");
    const erpUrl = `${erpBaseUrl}/account-data?document=${cleanDoc}`;

    console.log(`[sync-account-from-erp] Fetching from ERP: ${erpUrl}`);
    console.log(`[sync-account-from-erp] Using ERP key prefix: ${erpApiKey.slice(0, 12)}`);

    let erpResponse: Response;
    try {
      erpResponse = await fetch(erpUrl, {
        headers: {
          "X-API-Key": erpApiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (fetchErr) {
      console.error("[sync-account-from-erp] ERP network error:", fetchErr);
      const fetchError = getFetchErrorMessage(fetchErr);
      return jsonResponse({
        success: false,
        error: fetchError.error,
        error_type: fetchError.error_type,
        fallback: true,
      });
    }

    if (!erpResponse.ok) {
      const errText = await erpResponse.text();
      const trimmedErr = errText.trim();
      const isAuthError =
        erpResponse.status === 401 &&
        !/name_not_resolved|dns|enotfound/i.test(trimmedErr);

      console.error(`[sync-account-from-erp] ERP error ${erpResponse.status}: ${trimmedErr}`);

      const errorMessages: Record<number, string> = {
        401: "ERP rejeitou a autenticação. Revise a chave e confirme se ela foi criada para o endpoint account-data.",
        403: "Acesso negado pelo ERP. Verifique as permissões da chave de API.",
        404: "Conta não encontrada no ERP para o documento informado.",
        429: "ERP com limite de requisições excedido. Tente novamente em alguns minutos.",
        500: "Erro interno no servidor do ERP.",
        502: "ERP temporariamente indisponível (Bad Gateway).",
        503: "ERP em manutenção. Tente novamente mais tarde.",
      };

      return jsonResponse({
        success: false,
        error: errorMessages[erpResponse.status] || `ERP retornou erro ${erpResponse.status}`,
        error_type: isAuthError ? "ERP_AUTH_INVALID" : "ERP_API_ERROR",
        erp_status: erpResponse.status,
        fallback: true,
      });
    }

    const erpData = await erpResponse.json();
    console.log(`[sync-account-from-erp] ERP response: ${JSON.stringify(erpData)}`);

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      erp_sync_at: new Date().toISOString(),
    };

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

    const scoreData = erpData.score || erpData.financial || erpData;

    for (const [erpKey, crmKey] of Object.entries(fieldMap)) {
      if (scoreData?.[erpKey] !== undefined) {
        updateData[crmKey] = scoreData[erpKey];
      }
    }

    if (scoreData?.value !== undefined && updateData.score_financeiro === undefined) {
      updateData.score_financeiro = scoreData.value;
    }
    if (scoreData?.risk_level !== undefined && updateData.risco_financeiro === undefined) {
      updateData.risco_financeiro = scoreData.risk_level;
    }
    if (scoreData?.factors !== undefined && updateData.score_fatores === undefined) {
      updateData.score_fatores = scoreData.factors;
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", account.id);

    if (updateError) {
      console.error("[sync-account-from-erp] Update error:", updateError);
      return jsonResponse({ success: false, error: "Falha ao atualizar conta no banco" });
    }

    await supabase.from("audit_log").insert({
      action: "erp_manual_sync",
      entity_type: "account",
      entity_id: account.id,
      organization_id: account.organization_id,
      actor_user_id: userId,
      metadata: {
        source: "manual_pull",
        document: cleanDoc,
        fields_updated: Object.keys(updateData).filter(
          (key) => key !== "updated_at" && key !== "erp_sync_at",
        ),
      },
    });

    console.log(`[sync-account-from-erp] Successfully synced account ${account.id}`);

    return jsonResponse({
      success: true,
      synced_fields: Object.keys(updateData).filter(
        (key) => key !== "updated_at" && key !== "erp_sync_at",
      ),
      erp_sync_at: updateData.erp_sync_at,
    });
  } catch (err) {
    console.error("[sync-account-from-erp] Error:", err);
    return jsonResponse({
      success: false,
      error: "Erro interno — tente novamente",
      error_type: "INTERNAL_ERROR",
      fallback: true,
    });
  }
});
