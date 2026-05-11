import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');

function ensureAbsoluteUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function getDomainRoot(absoluteUrl: string): string | null {
  try {
    const u = new URL(absoluteUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

const FALLBACK_PATHS = [
  { path: "/about", source_type: "fallback_about" },
  { path: "/sobre", source_type: "fallback_sobre" },
  { path: "/empresa", source_type: "fallback_empresa" },
  { path: "/quem-somos", source_type: "fallback_quem_somos" },
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFallbackPage(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NoidEnrichmentBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html);
    return text.length > 200 ? text.slice(0, 20000) : null;
  } catch {
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hard timeout wrapper for any external fetch — prevents the function
// from hanging when Firecrawl/OpenAI/identity provider become slow.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

interface NormalizedProfile {
  company_summary: string | null;
  business_model: string | null;
  market_type: string | null;
  industry: string | null;
  sub_industry: string | null;
  target_customer: string | null;
  geo: string | null;
  company_size_hint: string | null;
  top_pains: string[];
  top_opportunities: string[];
  trigger_signals: string[];
  digital_maturity: string | null;
  confidence_notes: string | null;
}

function cleanNormalized(raw: any): NormalizedProfile {
  const arr = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 12) : []);
  const str = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    company_summary: str(raw?.company_summary),
    business_model: str(raw?.business_model),
    market_type: str(raw?.market_type),
    industry: str(raw?.industry),
    sub_industry: str(raw?.sub_industry),
    target_customer: str(raw?.target_customer),
    geo: str(raw?.geo),
    company_size_hint: str(raw?.company_size_hint),
    top_pains: arr(raw?.top_pains),
    top_opportunities: arr(raw?.top_opportunities),
    trigger_signals: arr(raw?.trigger_signals),
    digital_maturity: str(raw?.digital_maturity),
    confidence_notes: str(raw?.confidence_notes),
  };
}

function calculateConfidence(data: NormalizedProfile, contentLength: number, fallbackUsed: boolean): number {
  let score = 0;
  if (contentLength > 3000) score += 30;
  else if (contentLength > 1500) score += 20;
  else score += 10;
  if (data.top_pains.length >= 2) score += 20;
  if (data.top_opportunities.length >= 2) score += 20;
  if (data.industry) score += 10;
  if (data.business_model) score += 10;
  if (fallbackUsed) score -= 10;
  return Math.max(0, Math.min(score, 100));
}

function gradeFromScore(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

type QualityLabel = "high_confidence" | "usable" | "low_confidence" | "insufficient";

function qualityLabelFromGrade(grade: "A" | "B" | "C" | "D"): QualityLabel {
  switch (grade) {
    case "A": return "high_confidence";
    case "B": return "usable";
    case "C": return "low_confidence";
    case "D": return "insufficient";
  }
}

const REQUIRED_NORMALIZED_FIELDS: Array<keyof NormalizedProfile> = [
  "company_summary",
  "business_model",
  "market_type",
  "industry",
  "target_customer",
  "geo",
  "company_size_hint",
  "top_pains",
  "top_opportunities",
  "trigger_signals",
  "digital_maturity",
];

function computeMissingFields(data: NormalizedProfile): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_NORMALIZED_FIELDS) {
    const v = data[f];
    if (v == null) missing.push(f as string);
    else if (Array.isArray(v) && v.length === 0) missing.push(f as string);
  }
  return missing;
}

// Bump this string whenever the normalization prompt or schema changes
const PROMPT_VERSION = "enrichment.normalize.v2.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { prospect_id, workspace_id, force_fallback } = body;
    if (!prospect_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "prospect_id and workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get prospect data
    let { data: prospect, error: pErr } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();
    if (pErr || !prospect) {
      return new Response(JSON.stringify({ error: "Prospect not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create enrichment_run
    const { data: run, error: runErr } = await supabase
      .from("enrichment_runs")
      .insert({
        workspace_id,
        prospect_id,
        trigger_source: force_fallback ? "manual_force_fallback" : "manual",
        status: "running",
        providers_requested: ["internal_website"],
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);

    // === BACKGROUND PROCESSING ===
    // Heavy work (scraping + 2 OpenAI calls) frequently exceeds the 60s gateway
    // window, causing 504s for the user. We push everything to background and
    // return run_id immediately. The frontend polls enrichment_runs for status.
    const pipeline = (async () => {
     try {

    const providersCompleted: string[] = [];
    const providersFailed: string[] = [];

    // 3. Resolve target
    let scrapedContent = "";
    let website = ensureAbsoluteUrl(prospect.website || prospect.normalized_domain);
    let scrapeTarget = website
      || ensureAbsoluteUrl(prospect.exhibitor_profile_url)
      || ensureAbsoluteUrl(prospect.source_url)
      || ensureAbsoluteUrl(prospect.raw_data?._source_url);
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!website) {
      try {
        const identityResp = await fetchWithTimeout(`${supabaseUrl}/functions/v1/enrich-prospect-identity`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prospect_id }),
        }, 15000);
        if (identityResp.ok) {
          const identityData = await identityResp.json();
          prospect = { ...prospect, ...(identityData?.updates || {}) };
          website = ensureAbsoluteUrl(prospect.website || prospect.normalized_domain);
          scrapeTarget = website
            || ensureAbsoluteUrl(prospect.exhibitor_profile_url)
            || ensureAbsoluteUrl(prospect.source_url)
            || ensureAbsoluteUrl(prospect.raw_data?._source_url);
        }
      } catch (identityError) {
        console.warn("run-enrichment identity fallback exception", identityError);
      }
    }

    // 4. Scrape principal via Firecrawl
    let mainContentLength = 0;
    if (scrapeTarget && FIRECRAWL_API_KEY) {
      try {
        const scrapeResp = await fetchWithTimeout("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: scrapeTarget, formats: ["markdown"], onlyMainContent: true }),
        }, 45000);
        const scrapeData = await scrapeResp.json();
        const mainContent = scrapeData?.data?.markdown || scrapeData?.markdown || "";
        scrapedContent += mainContent;
        mainContentLength = mainContent.length;

        // raw source
        await supabase.from("enrichment_raw_sources").insert({
          organization_id: workspace_id,
          prospect_id,
          enrichment_run_id: run.id,
          source_type: website ? "firecrawl_main" : "firecrawl_directory",
          url: scrapeTarget,
          raw_content: mainContent.slice(0, 50000),
          content_length: mainContentLength,
        });

        await supabase.from("enrichment_provider_results").insert({
          workspace_id,
          enrichment_run_id: run.id,
          provider_name: "internal_website",
          provider_entity_type: "company",
          provider_status: "completed",
          raw_response: {
            content: mainContent.slice(0, 50000),
            target_url: scrapeTarget,
            source_type: website ? "official_website" : "directory_fallback",
          },
          confidence: mainContent.length > 200 ? 0.8 : 0.4,
        });
        providersCompleted.push("internal_website");
      } catch (e) {
        console.error("Firecrawl error:", e);
        providersFailed.push("internal_website");
        await supabase.from("enrichment_provider_results").insert({
          workspace_id,
          enrichment_run_id: run.id,
          provider_name: "internal_website",
          provider_entity_type: "company",
          provider_status: "failed",
          raw_response: { error: String(e) },
          confidence: 0,
        });
      }
    } else {
      providersFailed.push("internal_website");
      await supabase.from("enrichment_provider_results").insert({
        workspace_id,
        enrichment_run_id: run.id,
        provider_name: "internal_website",
        provider_entity_type: "company",
        provider_status: "failed",
        raw_response: {
          error: FIRECRAWL_API_KEY
            ? "No website/domain available for enrichment"
            : "FIRECRAWL_API_KEY missing",
        },
        confidence: 0,
      });
    }

    // 5. Fallback determinístico
    let fallbackUsed = false;
    let fallbackReason: string | null = null;
    const fallbackPagesFetched: Array<{ url: string; source_type: string; length: number }> = [];

    const shouldFallback = force_fallback === true || mainContentLength < 1500;
    if (force_fallback === true) fallbackReason = "forced_by_user";
    else if (mainContentLength < 1500) fallbackReason = "low_content_length";
    const domainRoot = website ? getDomainRoot(website) : null;

    if (shouldFallback && domainRoot) {
      for (const { path, source_type } of FALLBACK_PATHS) {
        const url = `${domainRoot}${path}`;
        const text = await fetchFallbackPage(url);
        if (text && text.length > 200) {
          scrapedContent += `\n\n---\nFallback: ${url}\n\n${text}`;
          fallbackUsed = true;
          fallbackPagesFetched.push({ url, source_type, length: text.length });
          await supabase.from("enrichment_raw_sources").insert({
            organization_id: workspace_id,
            prospect_id,
            enrichment_run_id: run.id,
            source_type,
            url,
            raw_content: text,
            content_length: text.length,
          });
        }
      }
    }

    const totalContentLength = scrapedContent.length;

    // 6. Normalização via IA com schema fechado
    let normalized: NormalizedProfile = cleanNormalized({});
    if (totalContentLength > 50 && OPENAI_API_KEY) {
      try {
        const analysisResp = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content: `Você é um motor de inteligência comercial B2B.

Analise o conteúdo abaixo e extraia informações estruturadas da empresa.

REGRAS RÍGIDAS:
- Seja objetivo.
- NÃO invente dados.
- Se não tiver informação suficiente para um campo, retorne null (ou array vazio).
- Não escreva texto fora do JSON.
- Use SOMENTE o tool call estruturado.`,
              },
              {
                role: "user",
                content: `Empresa: ${prospect.company_name}
Domínio: ${website || scrapeTarget || 'não identificado'}

CONTEÚDO:
${scrapedContent.slice(0, 18000)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_normalized_profile",
                  description: "Extract canonical normalized B2B company profile",
                  parameters: {
                    type: "object",
                    properties: {
                      company_summary: { type: ["string", "null"] },
                      business_model: { type: ["string", "null"] },
                      market_type: { type: ["string", "null"], enum: ["B2B", "B2C", "B2B2C", null] },
                      industry: { type: ["string", "null"] },
                      sub_industry: { type: ["string", "null"] },
                      target_customer: { type: ["string", "null"] },
                      geo: { type: ["string", "null"] },
                      company_size_hint: { type: ["string", "null"], enum: ["small", "medium", "large", "unknown", null] },
                      top_pains: { type: "array", items: { type: "string" } },
                      top_opportunities: { type: "array", items: { type: "string" } },
                      trigger_signals: { type: "array", items: { type: "string" } },
                      digital_maturity: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
                      confidence_notes: { type: ["string", "null"] },
                    },
                    required: [
                      "company_summary", "business_model", "market_type", "industry",
                      "top_pains", "top_opportunities", "trigger_signals"
                    ],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "extract_normalized_profile" } },
          }),
        }, 90000);

        if (analysisResp.ok) {
          const aiData = await analysisResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            normalized = cleanNormalized(JSON.parse(toolCall.function.arguments));
          }
        }
      } catch (e) {
        console.error("AI normalization error:", e);
      }
    }

    // 7. Score determinístico
    const qualityScore = calculateConfidence(normalized, totalContentLength, fallbackUsed);
    const qualityGrade = gradeFromScore(qualityScore);
    const qualityLabel = qualityLabelFromGrade(qualityGrade);
    const missingFields = computeMissingFields(normalized);
    const hasNormalized = !!(normalized.company_summary || normalized.business_model || normalized.industry);

    // 8a. Persistir snapshot histórico
    if (hasNormalized || totalContentLength > 0) {
      await supabase.from("enrichment_normalized").insert({
        organization_id: workspace_id,
        prospect_id,
        enrichment_run_id: run.id,
        data: normalized as any,
        confidence_score: qualityScore,
        quality_grade: qualityGrade,
        quality_label: qualityLabel,
        fallback_used: fallbackUsed,
        fallback_reason: fallbackUsed ? fallbackReason : null,
        content_length: totalContentLength,
        missing_fields: missingFields,
        prompt_version: PROMPT_VERSION,
      });
    }

    // 8b. Atualizar enriched_company_profiles (view atual)
    let companyProfile: any = null;
    if (hasNormalized) {
      const { data: existing } = await supabase
        .from("enriched_company_profiles")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("prospect_id", prospect_id)
        .maybeSingle();

      const profileData = {
        workspace_id,
        prospect_id,
        canonical_company_name: prospect.company_name,
        canonical_domain: website,
        company_summary: normalized.company_summary,
        business_model: normalized.business_model,
        market_type: normalized.market_type,
        company_size_estimate: normalized.company_size_hint,
        geographic_presence: normalized.geo ? [normalized.geo] : [],
        products_services: [],
        industries_detected: normalized.industry ? [normalized.industry, normalized.sub_industry].filter(Boolean) : [],
        tech_signals: normalized.trigger_signals,
        growth_signals: normalized.top_opportunities,
        commercial_pains: normalized.top_pains,
        strategic_notes: normalized.confidence_notes,
        confidence: qualityScore / 100,
        last_enriched_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("enriched_company_profiles").update(profileData).eq("id", existing.id);
      } else {
        await supabase.from("enriched_company_profiles").insert(profileData);
      }
      companyProfile = profileData;

      // 8c. Signals
      const signals: any[] = [];
      const addSignals = (type: string, values: string[], weight: number) => {
        for (const v of values || []) {
          signals.push({
            workspace_id,
            enrichment_run_id: run.id,
            prospect_id,
            signal_type: type,
            signal_value: v,
            source_provider: "internal_website",
            weight,
            confidence: qualityScore / 100,
          });
        }
      };
      addSignals("growth", normalized.top_opportunities, 5);
      addSignals("tech", normalized.trigger_signals, 3);
      addSignals("pain", normalized.top_pains, 8);
      if (normalized.industry) addSignals("industry", [normalized.industry], 2);

      if (signals.length > 0) {
        await supabase.from("enrichment_signals").insert(signals);
      }
    }

    // 9. Commercial Brief (mantém comportamento)
    let briefData: any = null;
    if (companyProfile && OPENAI_API_KEY) {
      try {
        const briefResp = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content: `Você é um SDR sênior da NOID (provedora B2B de conectividade e infraestrutura de rede), gerando um brief comercial para prospectar uma empresa-alvo.

REGRAS CRÍTICAS PARA first_touch_message:
- Você é o REMETENTE (SDR da NOID prospectando). NUNCA escreva como se fosse a empresa-alvo.
- Tom: 1ª pessoa do plural ("nós da NOID..."), consultivo, humano, direto. Sem clichês.
- Objetivo: QUALIFICAR (descobrir se há demanda de conectividade/rede), NÃO vender ainda.
- Use o contexto do evento (quando houver) como gancho legítimo.
- 1 pergunta de qualificação clara ao final.
- Máximo 120 palavras. Sem assinatura, sem PS, sem links.
- Personalize com dores/sinais reais detectados.

email_subject: assunto curto (máx 60 caracteres), específico.`,
              },
              {
                role: "user",
                content: `EMPRESA-ALVO: ${prospect.company_name}
${prospect.event_name ? `EVENTO: ${prospect.event_name}${prospect.booth ? ` (stand ${prospect.booth})` : ''}` : ''}
Resumo: ${normalized.company_summary}
Modelo: ${normalized.business_model}
Mercado: ${normalized.market_type}
Indústria: ${normalized.industry || 'n/d'}
Porte estimado: ${normalized.company_size_hint || 'n/d'}
Geo: ${normalized.geo || 'n/d'}
Dores: ${JSON.stringify(normalized.top_pains)}
Oportunidades: ${JSON.stringify(normalized.top_opportunities)}
Trigger signals: ${JSON.stringify(normalized.trigger_signals)}

REMETENTE: SDR da NOID.`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "generate_brief",
                  description: "Generate a commercial brief for B2B prospecting",
                  parameters: {
                    type: "object",
                    properties: {
                      executive_summary: { type: "string" },
                      why_now: { type: "string" },
                      probable_pains: { type: "array", items: { type: "string" } },
                      value_hypotheses: { type: "array", items: { type: "string" } },
                      recommended_pitch_angle: { type: "string" },
                      recommended_channel: { type: "string" },
                      email_subject: { type: "string" },
                      first_touch_message: { type: "string" },
                      objection_predictions: { type: "array", items: { type: "string" } },
                      confidence: { type: "number" },
                    },
                    required: ["executive_summary", "why_now", "probable_pains", "first_touch_message", "email_subject", "confidence"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "generate_brief" } },
          }),
        });

        if (briefResp.ok) {
          const briefAiData = await briefResp.json();
          const toolCall = briefAiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            briefData = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (e) {
        console.error("Brief generation error:", e);
      }
    }

    if (briefData) {
      await supabase.from("commercial_briefs").insert({
        workspace_id,
        enrichment_run_id: run.id,
        prospect_id,
        executive_summary: briefData.executive_summary,
        why_now: briefData.why_now,
        probable_pains: briefData.probable_pains || [],
        value_hypotheses: briefData.value_hypotheses || [],
        recommended_pitch_angle: briefData.recommended_pitch_angle,
        recommended_channel: briefData.recommended_channel,
        first_touch_message: briefData.first_touch_message,
        email_subject: briefData.email_subject,
        objection_predictions: briefData.objection_predictions || [],
        confidence: briefData.confidence || 0,
      });
    }

    // 10. Re-score prospect (Score V3 = base + enrichment + learning_adjustment)
    let scoreBonus = 0;
    if (hasNormalized) {
      if (website) scoreBonus += 10;
      if (normalized.top_pains.length > 0) scoreBonus += 10;
      if (normalized.top_opportunities.length > 0) scoreBonus += 5;
      if (normalized.trigger_signals.length > 0) scoreBonus += 3;
    }

    // Sprint C: compute learning_adjustment from learning_signals
    let learningAdjustment = 0;
    try {
      const { data: prospectSignalsAll } = await supabase
        .from("prospect_signals")
        .select("signal_type, signal_value")
        .eq("organization_id", workspace_id)
        .eq("prospect_id", prospect_id);
      const { data: enrichmentSignalsAll } = await supabase
        .from("enrichment_signals")
        .select("signal_type, signal_value")
        .eq("workspace_id", workspace_id)
        .eq("prospect_id", prospect_id);
      const allSig = [...(prospectSignalsAll ?? []), ...(enrichmentSignalsAll ?? [])];
      if (allSig.length > 0) {
        const { data: learn } = await supabase
          .from("learning_signals")
          .select("signal_type, signal_value, impact_score, confidence")
          .eq("organization_id", workspace_id)
          .gte("confidence", 0.2);
        const learnMap = new Map(
          (learn ?? []).map((l: any) => [`${l.signal_type}:${l.signal_value}`, Number(l.impact_score)]),
        );
        for (const s of allSig) {
          const k = `${(s as any).signal_type}:${(s as any).signal_value}`;
          if (learnMap.has(k)) learningAdjustment += learnMap.get(k)!;
        }
      }
    } catch (e) {
      console.error("[learning_adjustment] failed:", e);
    }

    if (scoreBonus > 0 || learningAdjustment !== 0) {
      const { data: existingScore } = await supabase
        .from("prospect_scores")
        .select("*")
        .eq("prospect_id", prospect_id)
        .maybeSingle();
      if (existingScore) {
        const newSignalScore = (existingScore.signal_score || 0) + scoreBonus;
        const newTotal =
          (existingScore.icp_fit_score || 0) +
          newSignalScore +
          (existingScore.data_quality_score || 0) +
          (existingScore.source_trust_score || 0) -
          (existingScore.penalty_score || 0) +
          learningAdjustment;
        const newGrade = newTotal >= 80 ? "A" : newTotal >= 60 ? "B" : newTotal >= 40 ? "C" : "D";
        await supabase
          .from("prospect_scores")
          .update({
            signal_score: newSignalScore,
            grade: newGrade,
            reasoning: {
              ...(existingScore.reasoning as any || {}),
              enrichment_bonus: scoreBonus,
              learning_adjustment: learningAdjustment,
              enrichment_signals: [
                ...normalized.top_pains.map((p) => `pain:${p}`),
                ...normalized.top_opportunities.map((g) => `growth:${g}`),
              ],
            },
          })
          .eq("id", existingScore.id);
        await supabase.from("prospects").update({ priority_score: Math.max(0, newTotal) }).eq("id", prospect_id);
      }
    }

    // 11. Finalize enrichment_run com novos campos (Sprint B + C)
    await supabase
      .from("enrichment_runs")
      .update({
        status: providersFailed.length > 0 && providersCompleted.length === 0 ? "failed" : "completed",
        providers_completed: providersCompleted,
        providers_failed: providersFailed,
        merge_status: hasNormalized ? "completed" : "failed",
        enrichment_score: qualityScore,
        quality_score: qualityScore,
        quality_grade: qualityGrade,
        quality_label: qualityLabel,
        fallback_used: fallbackUsed,
        fallback_reason: fallbackUsed ? fallbackReason : null,
        content_length: totalContentLength,
        fallback_pages_fetched: fallbackPagesFetched,
        missing_fields: missingFields,
        prompt_version: PROMPT_VERSION,
        learning_adjustment: learningAdjustment,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    // Sprint C: track lifecycle event (fire-and-forget)
    supabase.functions.invoke("track-event", {
      body: {
        event_type: "enrichment_completed",
        organization_id: workspace_id,
        prospect_id,
        metadata: {
          run_id: run.id,
          quality_label: qualityLabel,
          score: qualityScore,
          fallback_used: fallbackUsed,
        },
        dedup_key: `enrichment:${run.id}`,
      },
    }).catch((err) => console.error("track-event enrichment_completed failed:", err));

    // Sprint B: trigger Decision Engine se qualidade for usável (fire-and-forget)
    if (qualityLabel === "high_confidence" || qualityLabel === "usable") {
      try {
        supabase.functions.invoke("run-decision-engine", {
          body: {
            prospect_id,
            enrichment_run_id: run.id,
            organization_id: workspace_id,
          },
        }).catch((err) => console.error("run-decision-engine trigger failed:", err));
      } catch (err) {
        console.error("run-decision-engine invoke error:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        status: providersFailed.length > 0 && providersCompleted.length === 0 ? "failed" : "completed",
        quality_score: qualityScore,
        quality_grade: qualityGrade,
        quality_label: qualityLabel,
        fallback_used: fallbackUsed,
        fallback_reason: fallbackUsed ? fallbackReason : null,
        content_length: totalContentLength,
        missing_fields: missingFields,
        prompt_version: PROMPT_VERSION,
        has_company_profile: hasNormalized,
        has_brief: !!briefData,
        score_bonus: scoreBonus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("run-enrichment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
