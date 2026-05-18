// kairos-match-company
// Classifica uma empresa capturada no Kairós em:
// customer | opportunity_existing | account_existing | new_prospect
//
// Regras (curto-circuito):
// 1) CNPJ exato -> match exato (confidence 100)
// 2) Domínio igual -> match forte (confidence 90)
// 3) Nome similar via find_similar_accounts (pg_trgm) -> >= 0.85 forte, 0.70-0.85 dúvida
// 4) Sem match -> new_prospect
//
// Sempre escopado por organization_id do usuário logado.
// Se prospect_id for passado, persiste o resultado em prospects.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RelationshipStatus =
  | "customer"
  | "opportunity_existing"
  | "account_existing"
  | "new_prospect";

interface MatchInput {
  prospect_id?: string;
  company_name?: string;
  cnpj?: string;
  domain?: string;
}

interface MatchResult {
  relationship_status: RelationshipStatus;
  matched_account_id: string | null;
  matched_opportunity_id: string | null;
  confidence: number;
  reason: string;
}

function onlyDigits(v?: string | null): string | null {
  if (!v) return null;
  const d = String(v).replace(/\D/g, "");
  return d.length ? d : null;
}

function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  return s || null;
}

async function classifyAccount(
  sb: ReturnType<typeof createClient>,
  orgId: string,
  accountId: string,
): Promise<{ status: RelationshipStatus; opportunity_id: string | null }> {
  // 1) Cliente?
  const { data: acc } = await sb
    .from("accounts")
    .select("id, lifecycle_stage")
    .eq("id", accountId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (acc?.lifecycle_stage && String(acc.lifecycle_stage).toLowerCase() === "cliente") {
    return { status: "customer", opportunity_id: null };
  }

  // 2) Oportunidade ativa?
  const { data: opp } = await sb
    .from("opportunities")
    .select("id")
    .eq("account_id", accountId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (opp?.id) return { status: "opportunity_existing", opportunity_id: opp.id };

  return { status: "account_existing", opportunity_id: null };
}

async function runMatch(
  sb: ReturnType<typeof createClient>,
  orgId: string,
  input: MatchInput,
): Promise<MatchResult> {
  const cnpjDigits = onlyDigits(input.cnpj);
  const domain = normalizeDomain(input.domain);
  const companyName = (input.company_name || "").trim();

  // 1) CNPJ exato
  if (cnpjDigits) {
    const { data: byCnpj } = await sb
      .from("accounts")
      .select("id, cnpj")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .not("cnpj", "is", null)
      .limit(2000);

    const hit = (byCnpj || []).find(
      (a) => onlyDigits(a.cnpj as string) === cnpjDigits,
    );
    if (hit) {
      const cls = await classifyAccount(sb, orgId, hit.id as string);
      return {
        relationship_status: cls.status,
        matched_account_id: hit.id as string,
        matched_opportunity_id: cls.opportunity_id,
        confidence: 100,
        reason: "CNPJ idêntico na base",
      };
    }
  }

  // 2) Domínio igual
  if (domain) {
    const { data: byDomain } = await sb
      .from("accounts")
      .select("id, website")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .not("website", "is", null)
      .limit(5000);

    const hit = (byDomain || []).find(
      (a) => normalizeDomain(a.website as string) === domain,
    );
    if (hit) {
      const cls = await classifyAccount(sb, orgId, hit.id as string);
      return {
        relationship_status: cls.status,
        matched_account_id: hit.id as string,
        matched_opportunity_id: cls.opportunity_id,
        confidence: 90,
        reason: `Domínio ${domain} já existe na base`,
      };
    }
  }

  // 3) Nome similar (pg_trgm)
  if (companyName.length >= 3) {
    const { data: sims, error } = await sb.rpc("find_similar_accounts", {
      p_name: companyName,
      p_org_id: orgId,
      p_threshold: 0.7,
      p_tipo_pessoa: null,
      p_parent_account_id: null,
    });

    if (!error && Array.isArray(sims) && sims.length > 0) {
      const top = sims[0] as { id: string; similarity: number; razao_social: string };
      const sim = Number(top.similarity || 0);
      const confidence = Math.round(sim * 100);

      if (sim >= 0.85) {
        const cls = await classifyAccount(sb, orgId, top.id);
        return {
          relationship_status: cls.status,
          matched_account_id: top.id,
          matched_opportunity_id: cls.opportunity_id,
          confidence,
          reason: `Nome muito similar a "${top.razao_social}" (${confidence}%)`,
        };
      }

      if (sim >= 0.7) {
        // dúvida: classifica como account_existing por segurança
        const cls = await classifyAccount(sb, orgId, top.id);
        const status: RelationshipStatus =
          cls.status === "customer" ? "customer" : "account_existing";
        return {
          relationship_status: status,
          matched_account_id: top.id,
          matched_opportunity_id: cls.opportunity_id,
          confidence,
          reason: `Match provável por nome com "${top.razao_social}" (${confidence}%)`,
        };
      }
    }
  }

  return {
    relationship_status: "new_prospect",
    matched_account_id: null,
    matched_opportunity_id: null,
    confidence: 100,
    reason: "Nenhuma conta similar encontrada",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sbUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const sbAdmin = createClient(supabaseUrl, supabaseService);

    const { data: orgData, error: orgErr } = await sbUser.rpc(
      "get_user_organization_id",
    );
    if (orgErr || !orgData) {
      return new Response(
        JSON.stringify({ error: "User has no organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const orgId = orgData as string;

    const body = (await req.json().catch(() => ({}))) as MatchInput;

    // Se prospect_id veio, hidrata input a partir do banco
    let effective: MatchInput = { ...body };
    if (body.prospect_id) {
      const { data: p } = await sbAdmin
        .from("prospects")
        .select(
          "id, organization_id, company_name, normalized_domain, website, raw_data",
        )
        .eq("id", body.prospect_id)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (!p) {
        return new Response(
          JSON.stringify({ error: "Prospect not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const rawCnpj =
        (p as any).cnpj ||
        ((p.raw_data as any) || {}).cnpj ||
        ((p.raw_data as any) || {}).cnpj_raw ||
        null;

      effective = {
        prospect_id: p.id as string,
        company_name: effective.company_name || (p.company_name as string),
        cnpj: effective.cnpj || rawCnpj,
        domain:
          effective.domain ||
          (p.normalized_domain as string) ||
          (p.website as string) ||
          null,
      };
    }

    const result = await runMatch(sbAdmin, orgId, effective);

    // Persiste no prospect, se aplicável
    if (effective.prospect_id) {
      await sbAdmin
        .from("prospects")
        .update({
          relationship_status: result.relationship_status,
          matched_account_id: result.matched_account_id,
          dedupe_status:
            result.relationship_status === "new_prospect" ? "clean" : "matched",
          updated_at: new Date().toISOString(),
        })
        .eq("id", effective.prospect_id)
        .eq("organization_id", orgId);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[kairos-match-company] error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
