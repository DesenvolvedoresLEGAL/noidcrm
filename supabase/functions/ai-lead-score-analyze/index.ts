// Lead Score Intelligence Engine v2 — single-account analyzer
// RAG: monta contexto rico (conta + opps + contatos + atividades + propostas + score financeiro + benchmarks de segmento)
// LLM: GPT-5-mini via wrapper centralizado, com tool calling para output estruturado
// Cache: lead_score_ai_analysis (TTL 7d, sobrescreve por account_id)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "emit_lead_analysis",
    description: "Retorna análise estruturada de Lead Score baseada em FIT e INTENT.",
    parameters: {
      type: "object",
      properties: {
        ai_score: { type: "integer", minimum: 0, maximum: 100 },
        ai_grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        conversion_probability: { type: "integer", minimum: 0, maximum: 100 },
        fit_justification: { type: "string", minLength: 30, maxLength: 600 },
        intent_justification: { type: "string", minLength: 30, maxLength: 600 },
        positive_signals: {
          type: "array",
          maxItems: 6,
          items: { type: "string", maxLength: 140 },
        },
        risk_signals: {
          type: "array",
          maxItems: 6,
          items: { type: "string", maxLength: 140 },
        },
        next_best_action: { type: "string", maxLength: 220 },
        recommended_owner_role: {
          type: "string",
          enum: ["sdr", "closer", "cs", "account_manager", "any"],
        },
      },
      required: [
        "ai_score",
        "ai_grade",
        "conversion_probability",
        "fit_justification",
        "intent_justification",
        "positive_signals",
        "risk_signals",
        "next_best_action",
        "recommended_owner_role",
      ],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accountId, triggeredBy = "manual", forceRefresh = false } = await req.json();
    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cache check (7 days)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("lead_score_ai_analysis")
        .select("*")
        .eq("account_id", accountId)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached) {
        return new Response(JSON.stringify({ success: true, cached: true, analysis: cached }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ---- RAG: build context ----
    const context = await buildAccountContext(supabase, accountId);
    if (!context) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- LLM call ----
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(context);

    const aiResult = await callAI({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "function", function: { name: "emit_lead_analysis" } },
      reasoning_effort: "low",
      feature: "lead_score_ai",
      organization_id: context.account.organization_id,
    });

    // Parse tool call
    const toolCall = aiResult.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("[ai-lead-score-analyze] No tool call returned");
      return new Response(
        JSON.stringify({ error: "AI did not return structured output" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("[ai-lead-score-analyze] Bad JSON:", e);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist (upsert by account_id)
    const row = {
      organization_id: context.account.organization_id,
      account_id: accountId,
      ai_score: clamp(parsed.ai_score, 0, 100),
      ai_grade: parsed.ai_grade,
      conversion_probability: clamp(parsed.conversion_probability, 0, 100),
      fit_justification: String(parsed.fit_justification || "").slice(0, 600),
      intent_justification: String(parsed.intent_justification || "").slice(0, 600),
      positive_signals: Array.isArray(parsed.positive_signals)
        ? parsed.positive_signals.slice(0, 6)
        : [],
      risk_signals: Array.isArray(parsed.risk_signals)
        ? parsed.risk_signals.slice(0, 6)
        : [],
      next_best_action: String(parsed.next_best_action || "").slice(0, 220),
      recommended_owner_role: parsed.recommended_owner_role || "any",
      context_snapshot: context.summary,
      model_used: aiResult.model_used,
      prompt_tokens: aiResult.usage?.prompt_tokens ?? null,
      completion_tokens: aiResult.usage?.completion_tokens ?? null,
      latency_ms: aiResult.latency_ms,
      triggered_by: triggeredBy,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data: upserted, error: upErr } = await supabase
      .from("lead_score_ai_analysis")
      .upsert(row, { onConflict: "account_id" })
      .select("*")
      .single();

    if (upErr) {
      console.error("[ai-lead-score-analyze] Upsert error:", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, cached: false, analysis: upserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[ai-lead-score-analyze] Error:", error);
    const msg = String(error?.message || error);
    const status = msg.startsWith("AI_RATE_LIMIT")
      ? 429
      : msg.startsWith("AI_PAYMENT_REQUIRED")
      ? 402
      : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function clamp(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

async function buildAccountContext(supabase: any, accountId: string) {
  const { data: account, error } = await supabase
    .from("accounts")
    .select(
      "id, organization_id, razao_social, nome_fantasia, segmento, tamanho, porte, cnae, cnaes_secundarios, capital_social, cidade, uf, data_fundacao, situacao_cadastral, fit_score, intent_score, lead_score, lead_grade, score_financeiro, risco_financeiro, taxa_pagamento_pct, valor_vencido, lifecycle_stage, tipo_empresa, data_tornou_cliente, observacoes",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error || !account) return null;

  const [oppsRes, contactsRes, activitiesRes, proposalsRes, benchmarkRes] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, status, valor_previsto, prob, stage_id, pipeline_id, close_date_prevista, closed_at, created_at, temperatura")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("contacts")
      .select("id, primeiro_nome, ultimo_nome, cargo, departamento")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .limit(10),
    supabase
      .from("activities")
      .select("type, status, completed_at, scheduled_date, title")
      .eq("account_id", accountId)
      .order("scheduled_date", { ascending: false })
      .limit(15),
    supabase
      .from("proposals")
      .select("id, status, total_amount, view_count, last_viewed_at, sent_at, created_at, opportunity_id")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("lead_segment_benchmarks")
      .select("*")
      .eq("organization_id", account.organization_id)
      .eq("segmento", account.segmento || "")
      .maybeSingle(),
  ]);

  const opps = oppsRes.data || [];
  const wonOpps = opps.filter((o: any) => o.status === "won");
  const lostOpps = opps.filter((o: any) => o.status === "lost");
  const openOpps = opps.filter((o: any) => !["won", "lost"].includes(o.status));

  const totalWonValue = wonOpps.reduce((s: number, o: any) => s + (o.valor_previsto || 0), 0);
  const openPipeline = openOpps.reduce((s: number, o: any) => s + (o.valor_previsto || 0), 0);

  const recentActivities = (activitiesRes.data || []).slice(0, 8).map((a: any) => ({
    type: a.type,
    status: a.status,
    when: a.completed_at || a.scheduled_date,
  }));

  const proposalSummary = (proposalsRes.data || []).map((p: any) => ({
    status: p.status,
    amount: p.total_amount,
    views: p.view_count,
    last_viewed_at: p.last_viewed_at,
  }));

  const summary = {
    account: {
      razao_social: account.razao_social,
      nome_fantasia: account.nome_fantasia,
      segmento: account.segmento,
      tamanho: account.tamanho,
      porte: account.porte,
      cnae_principal: account.cnae,
      cnaes_secundarios: Array.isArray(account.cnaes_secundarios) ? account.cnaes_secundarios.slice(0, 10) : null,
      uf: account.uf,
      cidade: account.cidade,
      capital_social: account.capital_social,
      data_fundacao: account.data_fundacao,
      situacao_cadastral: account.situacao_cadastral,
      lifecycle_stage: account.lifecycle_stage,
      tipo_empresa: account.tipo_empresa,
      score_financeiro: account.score_financeiro,
      risco_financeiro: account.risco_financeiro,
      taxa_pagamento_pct: account.taxa_pagamento_pct,
      valor_vencido: account.valor_vencido,
      observacoes: account.observacoes ? account.observacoes.slice(0, 400) : null,
    },
    determ_scores: {
      fit_score: account.fit_score,
      intent_score: account.intent_score,
      lead_score: account.lead_score,
      lead_grade: account.lead_grade,
    },
    opportunities: {
      total: opps.length,
      won: wonOpps.length,
      lost: lostOpps.length,
      open: openOpps.length,
      total_won_value: totalWonValue,
      open_pipeline_value: openPipeline,
      open_summary: openOpps.slice(0, 5).map((o: any) => ({
        title: o.title,
        prob: o.prob,
        valor: o.valor_previsto,
        stage: o.stage_id,
        temp: o.temperatura,
      })),
    },
    contacts: {
      count: (contactsRes.data || []).length,
      decision_makers: (contactsRes.data || [])
        .filter((c: any) => /diretor|ceo|gerente|cto|cmo|cfo|coo|head|vp|founder|s[óo]cio/i.test(c.cargo || ""))
        .map((c: any) => ({ name: `${c.primeiro_nome} ${c.ultimo_nome || ""}`.trim(), cargo: c.cargo })),
    },
    recent_activities: recentActivities,
    proposals: proposalSummary,
    segment_benchmark: benchmarkRes.data
      ? {
          win_rate: benchmarkRes.data.win_rate,
          avg_ticket: benchmarkRes.data.avg_ticket,
          avg_cycle_days: benchmarkRes.data.avg_cycle_days,
          top_win_factors: benchmarkRes.data.top_win_factors,
          top_loss_factors: benchmarkRes.data.top_loss_factors,
          sample_size: benchmarkRes.data.sample_size,
        }
      : null,
  };

  return { account, summary };
}

function buildSystemPrompt(): string {
  return `Você é o motor "NOID Lead Score Intelligence v2", especialista em qualificação B2B brasileira.

Sua tarefa: avaliar o potencial comercial de uma conta combinando dados firmográficos (FIT) com sinais comportamentais (INTENT), CALIBRADOS pelos benchmarks reais do segmento na organização.

Princípios:
1. SEJA REALISTA. Conta sem atividade recente, sem oportunidades abertas e sem contatos de decisão NÃO é grade A.
2. USE OS BENCHMARKS. Se o segmento tem win_rate baixo, ajuste a probabilidade pra baixo. Se ticket médio é R$ X, valide se a conta cabe.
3. DIFERENCIE FIT vs INTENT. FIT = perfil ideal (segmento, porte, geografia). INTENT = vontade de comprar agora (atividades, propostas vistas, deals abertos quentes).
4. SCORE FINANCEIRO IMPORTA. Conta com valor vencido alto OU risco financeiro alto NUNCA é grade A.
5. JUSTIFIQUE COM DADOS DO INPUT. Cite números reais (ex: "3 propostas enviadas, 12 visualizações nos últimos 7 dias"). Sem inventar.
6. PRÓXIMA AÇÃO PRECISA SER ESPECÍFICA. Não diga "fazer follow-up". Diga "Agendar reunião com [nome do decisor], focar em [pain point]".

Grades:
- A (>=80): pronto para fechar agora, alto fit + alto intent
- B (60-79): bom potencial, precisa nutrir
- C (40-59): possível, requer trabalho
- D (20-39): baixo, evitar gastar tempo
- F (<20): descartar ou reciclar

Responda APENAS via tool emit_lead_analysis.`;
}

function buildUserPrompt(context: any): string {
  return `Analise esta conta e retorne via emit_lead_analysis:

\`\`\`json
${JSON.stringify(context.summary, null, 2)}
\`\`\``;
}
