import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";


const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id, workspace_id } = await req.json();
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
    const { data: prospect, error: pErr } = await supabase
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
        trigger_source: "manual",
        status: "running",
        providers_requested: ["internal_website"],
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);

    const providersCompleted: string[] = [];
    const providersFailed: string[] = [];

    // 3. Scrape website via Firecrawl
    let scrapedContent = "";
    const website = prospect.website || prospect.normalized_domain;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (website && FIRECRAWL_API_KEY) {
      try {
        const formattedUrl = website.startsWith("http") ? website : `https://${website}`;

        // Scrape main page
        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: formattedUrl, formats: ["markdown"], onlyMainContent: true }),
        });
        const scrapeData = await scrapeResp.json();
        const mainContent = scrapeData?.data?.markdown || scrapeData?.markdown || "";
        scrapedContent += mainContent;

        // Map to find additional pages
        let additionalPages: string[] = [];
        try {
          const mapResp = await fetch("https://api.firecrawl.dev/v1/map", {
            method: "POST",
            headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: formattedUrl, search: "about products services contact", limit: 10 }),
          });
          const mapData = await mapResp.json();
          const allLinks: string[] = mapData?.links || [];
          const patterns = [/about/i, /produto/i, /product/i, /servic/i, /contact/i, /quem.somos/i, /sobre/i];
          additionalPages = allLinks
            .filter((l: string) => patterns.some((p) => p.test(l)))
            .slice(0, 3);
        } catch (e) {
          console.warn("Map failed, continuing with main page only:", e);
        }

        // Scrape additional pages
        for (const pageUrl of additionalPages) {
          try {
            const pageResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ url: pageUrl, formats: ["markdown"], onlyMainContent: true }),
            });
            const pageData = await pageResp.json();
            const pageContent = pageData?.data?.markdown || pageData?.markdown || "";
            if (pageContent) scrapedContent += `\n\n---\nPágina: ${pageUrl}\n\n${pageContent}`;
          } catch (e) {
            console.warn("Failed to scrape:", pageUrl, e);
          }
        }

        // Save provider result
        await supabase.from("enrichment_provider_results").insert({
          workspace_id,
          enrichment_run_id: run.id,
          provider_name: "internal_website",
          provider_entity_type: "company",
          provider_status: "completed",
          raw_response: { content: scrapedContent.slice(0, 50000), pages_scraped: 1 + additionalPages.length },
          confidence: scrapedContent.length > 200 ? 0.8 : 0.4,
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
    }

    // 4. AI Synthesis — Company Profile
    let companyProfile: any = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (scrapedContent.length > 50 && LOVABLE_API_KEY) {
      try {
        const analysisResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content: `Você é o Caramelo Enrichment Agent. Analise o site oficial de uma empresa e transforme conteúdo disperso em inteligência comercial útil para vendas B2B. Regras: nunca invente dados, quando houver incerteza reduza confidence, priorize fatos observáveis, retorne apenas JSON estruturado.`,
              },
              {
                role: "user",
                content: `Analise o conteúdo extraído do site desta empresa (${prospect.company_name}, domínio: ${website}).

Retorne JSON com:
{
  "company_summary": "resumo objetivo em até 3 linhas",
  "business_model": "modelo de negócio provável",
  "market_type": "B2B, B2C ou ambos",
  "company_size_estimate": "micro/pequena/média/grande",
  "geographic_presence": ["lista de regiões/cidades"],
  "products_services": ["lista de produtos ou serviços principais"],
  "industries_detected": ["setores de atuação"],
  "tech_signals": ["sinais de tecnologia detectados"],
  "growth_signals": ["sinais de crescimento"],
  "commercial_pains": ["dores comerciais prováveis"],
  "strategic_notes": "observações estratégicas",
  "confidence": 0.0 a 1.0
}

Conteúdo do site:
${scrapedContent.slice(0, 15000)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_company_profile",
                  description: "Extract structured company profile from website content",
                  parameters: {
                    type: "object",
                    properties: {
                      company_summary: { type: "string" },
                      business_model: { type: "string" },
                      market_type: { type: "string" },
                      company_size_estimate: { type: "string" },
                      geographic_presence: { type: "array", items: { type: "string" } },
                      products_services: { type: "array", items: { type: "string" } },
                      industries_detected: { type: "array", items: { type: "string" } },
                      tech_signals: { type: "array", items: { type: "string" } },
                      growth_signals: { type: "array", items: { type: "string" } },
                      commercial_pains: { type: "array", items: { type: "string" } },
                      strategic_notes: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["company_summary", "business_model", "market_type", "confidence"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "extract_company_profile" } },
          }),
        });

        if (analysisResp.ok) {
          const aiData = await analysisResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            companyProfile = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (e) {
        console.error("AI synthesis error:", e);
      }
    }

    // 5. Save enriched_company_profiles
    if (companyProfile) {
      // Check for existing profile
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
        company_summary: companyProfile.company_summary,
        business_model: companyProfile.business_model,
        market_type: companyProfile.market_type,
        company_size_estimate: companyProfile.company_size_estimate,
        geographic_presence: companyProfile.geographic_presence || [],
        products_services: companyProfile.products_services || [],
        industries_detected: companyProfile.industries_detected || [],
        tech_signals: companyProfile.tech_signals || [],
        growth_signals: companyProfile.growth_signals || [],
        commercial_pains: companyProfile.commercial_pains || [],
        strategic_notes: companyProfile.strategic_notes,
        confidence: companyProfile.confidence || 0,
        last_enriched_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("enriched_company_profiles").update(profileData).eq("id", existing.id);
      } else {
        await supabase.from("enriched_company_profiles").insert(profileData);
      }

      // 6. Create enrichment_signals
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
            confidence: companyProfile.confidence || 0,
          });
        }
      };
      addSignals("growth", companyProfile.growth_signals, 5);
      addSignals("tech", companyProfile.tech_signals, 3);
      addSignals("pain", companyProfile.commercial_pains, 8);
      addSignals("industry", companyProfile.industries_detected, 2);

      if (signals.length > 0) {
        await supabase.from("enrichment_signals").insert(signals);
      }
    }

    // 7. Commercial Brief via AI
    let briefData: any = null;
    if (companyProfile && LOVABLE_API_KEY) {
      try {
        const briefResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content: `Você é um SDR sênior da NOID (provedora B2B de conectividade e infraestrutura de rede), gerando um brief comercial para prospectar uma empresa-alvo.

REGRAS CRÍTICAS PARA O CAMPO first_touch_message:
- Você é o REMETENTE (SDR da NOID prospectando). A empresa-alvo é o DESTINATÁRIO. NUNCA escreva como se fosse a empresa-alvo se apresentando.
- Tom: 1ª pessoa do plural ("nós da NOID..."), consultivo, humano, direto. Sem clichês de vendas, sem "espero que esteja bem".
- Objetivo da mensagem: QUALIFICAR (descobrir se há demanda de conectividade/rede), NÃO vender ainda.
- Use o contexto do evento (quando houver) como gancho legítimo: "vimos que vocês vão estar no [evento]/no stand [X]".
- Faça 1 pergunta de qualificação clara ao final (ex.: sobre demanda de conectividade, expansão, infraestrutura).
- Máximo 120 palavras. Sem assinatura, sem PS, sem links.
- Personalize com dores/sinais reais detectados, não com genéricos.

Para email_subject: assunto curto (máx 60 caracteres), específico, sem clickbait. Pode usar nome da empresa + gancho do evento.

Retorne apenas dados estruturados via tool call.`,
              },
              {
                role: "user",
                content: `Gere o brief comercial para prospecção da empresa abaixo. Lembre: VOCÊ é o SDR da NOID escrevendo PARA esta empresa.

EMPRESA-ALVO (destinatário): ${prospect.company_name}
${prospect.event_name ? `EVENTO ONDE FOI IDENTIFICADA: ${prospect.event_name}${prospect.booth ? ` (stand ${prospect.booth})` : ''}` : ''}
Resumo: ${companyProfile.company_summary}
Modelo: ${companyProfile.business_model}
Mercado: ${companyProfile.market_type}
Porte estimado: ${companyProfile.company_size_estimate || 'n/d'}
Presença: ${JSON.stringify(companyProfile.geographic_presence || [])}
Produtos: ${JSON.stringify(companyProfile.products_services)}
Dores prováveis: ${JSON.stringify(companyProfile.commercial_pains)}
Sinais de crescimento: ${JSON.stringify(companyProfile.growth_signals)}
Sinais técnicos: ${JSON.stringify(companyProfile.tech_signals)}

REMETENTE: SDR da NOID (provedora de conectividade B2B / infraestrutura de rede).`,
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
                      email_subject: { type: "string", description: "Assunto curto e específico para o e-mail inicial (máx 60 chars)" },
                      first_touch_message: { type: "string", description: "Corpo do e-mail inicial. SDR da NOID escrevendo PARA a empresa-alvo. 1ª pessoa, máx 120 palavras, 1 pergunta de qualificação ao final." },
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

    // 8. Save commercial_briefs
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
        objection_predictions: briefData.objection_predictions || [],
        confidence: briefData.confidence || 0,
      });
    }

    // 9. Re-score prospect
    let scoreBonus = 0;
    if (companyProfile) {
      if (website) scoreBonus += 10; // website confirmed
      if ((companyProfile.commercial_pains || []).length > 0) scoreBonus += 10;
      if ((companyProfile.growth_signals || []).length > 0) scoreBonus += 5;
      if ((companyProfile.tech_signals || []).length > 0) scoreBonus += 3;
    }

    if (scoreBonus > 0) {
      const { data: existingScore } = await supabase
        .from("prospect_scores")
        .select("*")
        .eq("prospect_id", prospect_id)
        .maybeSingle();

      if (existingScore) {
        const newSignalScore = (existingScore.signal_score || 0) + scoreBonus;
        const newTotal = (existingScore.icp_fit_score || 0) + newSignalScore + (existingScore.data_quality_score || 0) + (existingScore.source_trust_score || 0) - (existingScore.penalty_score || 0);
        const newGrade = newTotal >= 80 ? "A" : newTotal >= 60 ? "B" : newTotal >= 40 ? "C" : "D";

        await supabase
          .from("prospect_scores")
          .update({
            signal_score: newSignalScore,
            grade: newGrade,
            reasoning: {
              ...(existingScore.reasoning as any || {}),
              enrichment_bonus: scoreBonus,
              enrichment_signals: [
                ...(companyProfile.commercial_pains || []).map((p: string) => `pain:${p}`),
                ...(companyProfile.growth_signals || []).map((g: string) => `growth:${g}`),
              ],
            },
          })
          .eq("id", existingScore.id);

        // Update prospect priority_score
        await supabase
          .from("prospects")
          .update({ priority_score: newTotal })
          .eq("id", prospect_id);
      }
    }

    // 10. Finalize enrichment_run
    const enrichmentScore = companyProfile ? (companyProfile.confidence || 0) * 100 : 0;
    await supabase
      .from("enrichment_runs")
      .update({
        status: providersFailed.length > 0 && providersCompleted.length === 0 ? "failed" : "completed",
        providers_completed: providersCompleted,
        providers_failed: providersFailed,
        merge_status: companyProfile ? "completed" : "failed",
        enrichment_score: enrichmentScore,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        status: providersFailed.length > 0 && providersCompleted.length === 0 ? "failed" : "completed",
        providers_completed: providersCompleted,
        providers_failed: providersFailed,
        has_company_profile: !!companyProfile,
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
