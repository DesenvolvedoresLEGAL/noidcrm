// Edge function: ai-loss-semantic-analyzer
//
// Para uma oportunidade perdida, lê os textos livres (loss_comment + proposals.declined_reason
// + win_loss_records.reason_free_text/customer_feedback) e o motivo humano selecionado,
// gera inferência semântica via OpenAI (cache por context_signature), e persiste em
// loss_semantic_analyses. A IA NUNCA escreve em loss_reason_id / client_loss_reason_id /
// win_loss_records — apenas enriquece.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RULE_VERSION = "v1";
const MODEL = "openai/gpt-5-mini";

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface SourceTexts {
  seller_diagnosis: string | null;
  customer_comment: string | null;
  free_text: string | null;
  origins: Array<{ field: string; source: "seller" | "customer" | "interview"; captured_at: string | null }>;
}

function buildPrompt(
  seller: string | null,
  customer: string | null,
  free: string | null,
  sellerSelectedReason: string | null,
  sellerSelectedCategory: string | null,
  clientSelectedReason: string | null,
  competitor: string | null,
): { system: string; user: string } {
  const system =
    "Você é um analista de Win/Loss. Analise os textos livres do vendedor e do cliente de uma oportunidade PERDIDA e produza JSON estrito. " +
    "Nunca invente fatos: só infira o que está nos textos. Categorias permitidas: price, timing, competition, no_fit, sales_process, operational, internal, other. " +
    "Se houver contradição entre o motivo selecionado pelo vendedor e o que o cliente disse, marque seller_customer_gap=true e explique em gap_explanation. " +
    "Recomende UMA ação concreta para o time comercial (até 200 chars). " +
    "ai_summary_short deve ter no máximo 160 caracteres. Responda APENAS com JSON válido, sem markdown.";

  const user = JSON.stringify({
    motivo_selecionado_pelo_vendedor: sellerSelectedReason,
    categoria_selecionada_pelo_vendedor: sellerSelectedCategory,
    motivo_selecionado_pelo_cliente: clientSelectedReason,
    concorrente_informado: competitor,
    diagnostico_do_vendedor: seller,
    comentario_do_cliente: customer,
    texto_livre_entrevista: free,
    formato_resposta: {
      ai_detected_loss_category: "price|timing|competition|no_fit|sales_process|operational|internal|other",
      ai_detected_loss_reason: "string curta (até 80 chars) descrevendo o motivo real provável",
      ai_detected_competitor: "string ou null",
      ai_confidence_score: "inteiro 0-100",
      ai_summary_short: "até 160 chars",
      recommended_action: "até 200 chars",
      seller_customer_gap: "boolean",
      gap_explanation: "string ou null",
      is_recoverable_inferred: "boolean ou null",
    },
  });

  return { system, user };
}

// Cálculo determinístico de qualidade do diagnóstico (mirror do TS)
const CAUSE_REGEX =
  /\b(porque|pois|devido|por causa|em razão|já que|uma vez que|motivo|gerou|provocou|resultou em|por conta de|fizemos|escolheram?)\b/i;
const CONTEXT_REGEX =
  /\b(proposta|reunião|reuniao|negocia[cç][ãa]o|prazo|deadline|decisor|cliente|stage|etapa|orçamento|or[cç]amento|aprova[cç][ãa]o|contrato|envio)\b/i;
const TOPIC_REGEX =
  /\b(pre[cç]o|caro|barato|valor|desconto|concorr[êe]ncia|concorrente|fornecedor|timing|tempo|prazo|urg[êe]ncia|produto|funcionalidade|feature|opera[cç][ãa]o|implanta[cç][ãa]o|suporte|instala[cç][ãa]o|equipamento)\b/i;
const ACTION_REGEX =
  /\b(revisar|criar|atualizar|implementar|treinar|alertar|monitorar|recontatar|reativar|negociar|reduzir|priorizar|acompanhar|automatizar|configurar)\b/i;

function diagnosisQuality(
  seller: string,
  customer: string,
  free: string,
  sellerCat: string | null,
  aiCat: string | null,
  recommendedAction: string,
): number {
  const combined = [seller, customer, free].filter(Boolean).join(" \n ");
  if (!combined) return 0;
  let s = 0;
  const longest = Math.max(seller.length, customer.length, free.length);
  if (longest >= 100) s += 20;
  else if (longest >= 50) s += 12;
  else if (longest >= 20) s += 6;
  if (CAUSE_REGEX.test(combined)) s += 20;
  else if (combined.length > 80) s += 8;
  if (CONTEXT_REGEX.test(combined)) s += 15;
  else if (combined.length > 60) s += 5;
  if (TOPIC_REGEX.test(combined)) s += 15;
  if (recommendedAction && recommendedAction.trim().length > 10) s += 15;
  else if (ACTION_REGEX.test(combined)) s += 10;
  const a = (sellerCat || "").toLowerCase().trim();
  const b = (aiCat || "").toLowerCase().trim();
  if (!a || !b) s += 8;
  else if (a === b) s += 15;
  else s += 3;
  return Math.min(100, s);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { opportunityId, force_refresh = false } = body || {};
    if (!opportunityId || typeof opportunityId !== "string") {
      return new Response(JSON.stringify({ error: "opportunityId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Carrega oportunidade + motivos humanos
    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select(
        `id, organization_id, status, loss_comment, valor_previsto,
         loss_reason:loss_reasons!opportunities_loss_reason_id_fkey(name, category),
         client_loss_reason:loss_reasons!opportunities_client_loss_reason_id_fkey(name, category)`,
      )
      .eq("id", opportunityId)
      .single();
    if (oppErr || !opp) {
      return new Response(JSON.stringify({ error: "opportunity not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (opp.status !== "lost") {
      return new Response(JSON.stringify({ error: "opportunity is not lost" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Recusas públicas (últimas)
    const { data: declines } = await supabase
      .from("proposals")
      .select("declined_reason, declined_at")
      .eq("opportunity_id", opportunityId)
      .not("declined_reason", "is", null)
      .order("declined_at", { ascending: false })
      .limit(1);
    const customerComment: string | null = declines?.[0]?.declined_reason || null;

    // 3. Win/loss record (texto livre + competitor)
    const { data: wlr } = await supabase
      .from("win_loss_records")
      .select("reason_free_text, customer_feedback, competitor")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(1);
    const freeText: string | null =
      wlr?.[0]?.reason_free_text || wlr?.[0]?.customer_feedback || null;
    const competitorHuman: string | null = wlr?.[0]?.competitor || null;

    const sellerDiagnosis: string | null = opp.loss_comment || null;
    const sellerReason = (opp.loss_reason as any)?.name || null;
    const sellerCategory = (opp.loss_reason as any)?.category || null;
    const clientReason = (opp.client_loss_reason as any)?.name || null;

    const sourceTexts: SourceTexts = {
      seller_diagnosis: sellerDiagnosis,
      customer_comment: customerComment,
      free_text: freeText,
      origins: [
        sellerDiagnosis ? { field: "loss_comment", source: "seller" as const, captured_at: null } : null,
        customerComment ? { field: "proposals.declined_reason", source: "customer" as const, captured_at: declines?.[0]?.declined_at || null } : null,
        freeText ? { field: "win_loss_records.reason_free_text", source: "interview" as const, captured_at: null } : null,
      ].filter(Boolean) as SourceTexts["origins"],
    };

    // 4. Sem nenhum texto → grava registro vazio determinístico (qualidade=0) e sai.
    const anyText = sellerDiagnosis || customerComment || freeText;
    const signaturePayload = JSON.stringify({
      s: sellerDiagnosis,
      c: customerComment,
      f: freeText,
      sr: sellerReason,
      sc: sellerCategory,
      cr: clientReason,
      cp: competitorHuman,
      rv: RULE_VERSION,
    });
    const contextSignature = await sha256(signaturePayload);

    // 5. Cache check
    if (!force_refresh) {
      const { data: existing } = await supabase
        .from("loss_semantic_analyses")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .maybeSingle();
      if (existing && existing.context_signature === contextSignature) {
        return new Response(
          JSON.stringify({ ...existing, from_cache: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 6. Sem texto → persistir registro neutro
    if (!anyText) {
      const row = {
        organization_id: opp.organization_id,
        opportunity_id: opportunityId,
        source_texts: sourceTexts as unknown as Record<string, unknown>,
        ai_detected_loss_category: sellerCategory,
        ai_detected_loss_reason: sellerReason,
        ai_detected_competitor: competitorHuman,
        ai_confidence_score: 0,
        ai_summary_short: null,
        recommended_action: null,
        seller_customer_gap: false,
        gap_explanation: null,
        is_recoverable_inferred: null,
        diagnosis_quality_score: 0,
        model_used: null,
        rule_version: RULE_VERSION,
        context_signature: contextSignature,
        analyzed_at: new Date().toISOString(),
      };
      const { data: up, error: upErr } = await supabase
        .from("loss_semantic_analyses")
        .upsert(row, { onConflict: "opportunity_id" })
        .select()
        .single();
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ ...up, from_cache: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Chamada IA
    const { system, user } = buildPrompt(
      sellerDiagnosis,
      customerComment,
      freeText,
      sellerReason,
      sellerCategory,
      clientReason,
      competitorHuman,
    );

    const ai = await callAI({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      reasoning_effort: "minimal",
      feature: "loss-semantic-analyzer",
      organization_id: opp.organization_id,
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(ai.content || "{}");
    } catch (_e) {
      parsed = {};
    }

    const aiCategory = (parsed.ai_detected_loss_category as string) || null;
    const aiReason = (parsed.ai_detected_loss_reason as string) || null;
    const aiCompetitor = (parsed.ai_detected_competitor as string) || competitorHuman;
    const aiConfidence =
      typeof parsed.ai_confidence_score === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.ai_confidence_score as number)))
        : null;
    const aiSummary = ((parsed.ai_summary_short as string) || "").slice(0, 160) || null;
    const recommendedAction = ((parsed.recommended_action as string) || "").slice(0, 200) || null;
    const gap = Boolean(parsed.seller_customer_gap);
    const gapExplanation = (parsed.gap_explanation as string) || null;
    const isRecoverable =
      typeof parsed.is_recoverable_inferred === "boolean" ? (parsed.is_recoverable_inferred as boolean) : null;

    const quality = diagnosisQuality(
      sellerDiagnosis || "",
      customerComment || "",
      freeText || "",
      sellerCategory,
      aiCategory,
      recommendedAction || "",
    );

    const row = {
      organization_id: opp.organization_id,
      opportunity_id: opportunityId,
      source_texts: sourceTexts as unknown as Record<string, unknown>,
      ai_detected_loss_category: aiCategory,
      ai_detected_loss_reason: aiReason,
      ai_detected_competitor: aiCompetitor,
      ai_confidence_score: aiConfidence,
      ai_summary_short: aiSummary,
      recommended_action: recommendedAction,
      seller_customer_gap: gap,
      gap_explanation: gapExplanation,
      is_recoverable_inferred: isRecoverable,
      diagnosis_quality_score: quality,
      model_used: ai.model_used,
      rule_version: RULE_VERSION,
      context_signature: contextSignature,
      analyzed_at: new Date().toISOString(),
    };

    const { data: up, error: upErr } = await supabase
      .from("loss_semantic_analyses")
      .upsert(row, { onConflict: "opportunity_id" })
      .select()
      .single();
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ...up, from_cache: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-loss-semantic-analyzer] error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
