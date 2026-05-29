import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";
import {
  calculateProposalAnalyticsScore,
  PROPOSAL_ANALYTICS_SCORING_VERSION,
} from "../_shared/proposal-analytics-scoring.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProposalBehaviorAnalysis {
  summary: string;
  engagement_level: 'low' | 'medium' | 'high' | 'very_high';
  concerns: string[];
  recommended_actions: Array<{
    type: 'call' | 'email' | 'meeting' | 'discount' | 'follow_up';
    message: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  win_probability_delta: number;
  best_contact_time: string | null;
  insights: Array<{
    type: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'success' | 'critical';
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const proposal_id: string | undefined = body?.proposal_id;
    const force_refresh: boolean = !!body?.force_refresh;

    if (!proposal_id) {
      return new Response(
        JSON.stringify({ error: 'proposal_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Signature + cache lookup ----
    const { data: sigData, error: sigErr } = await supabase.rpc('get_proposal_analytics_signature', { p_proposal_id: proposal_id });
    if (sigErr) console.error('[analyze-proposal-behavior] signature error', sigErr);
    const currentSignature: string | null = (sigData as any) ?? null;

    const { data: cacheRow } = await supabase
      .from('proposal_ai_insights_cache')
      .select('*')
      .eq('proposal_id', proposal_id)
      .maybeSingle();

    const cacheValid = !!cacheRow && currentSignature && cacheRow.analytics_signature === currentSignature;

    if (cacheValid && !force_refresh) {
      const payload = (cacheRow!.insights_payload || {}) as any;
      return new Response(JSON.stringify({
        ...payload,
        from_cache: true,
        status: 'ok',
        analyzed_at: cacheRow!.generated_at,
        cached_signature: cacheRow!.analytics_signature,
        current_signature: currentSignature,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const refreshReason = !cacheRow ? 'cache_miss' : (force_refresh ? 'manual_refresh' : 'signature_changed');

    // Fetch proposal data
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        *,
        opportunities!proposals_opportunity_id_fkey (
          title,
          valor_previsto,
          temperature,
          accounts (nome_fantasia, razao_social)
        )
      `)
      .eq('id', proposal_id)
      .single();

    if (proposalError || !proposal) {
      console.error('Error fetching proposal:', proposalError);
      return new Response(
        JSON.stringify({ error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch ONLY EXTERNAL views for this proposal (from clients, not internal CRM users)
    const { data: views, error: viewsError } = await supabase
      .from('proposal_views')
      .select('*')
      .eq('proposal_id', proposal_id)
      .eq('viewer_type', 'external')
      .order('viewed_at', { ascending: false });

    if (viewsError) {
      console.error('Error fetching views:', viewsError);
    }

    // Fetch granular events
    const { data: events, error: eventsError } = await supabase
      .from('proposal_view_events')
      .select('*')
      .eq('proposal_id', proposal_id)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    }

    // Calculate behavioral metrics
    const totalViews = views?.length || 0;
    const totalDuration = views?.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) || 0;
    const avgDuration = totalViews > 0 ? totalDuration / totalViews : 0;
    const uniqueIPs = new Set(views?.map(v => v.viewer_ip).filter(Boolean)).size;
    const uniqueDevices = new Set(views?.map(v => v.device_type).filter(Boolean)).size;

    // Insufficient data: do not call AI, do not log usage
    if (totalViews === 0 && !cacheRow) {
      return new Response(JSON.stringify({
        status: 'insufficient_data',
        from_cache: false,
        current_signature: currentSignature,
        analyzed_at: new Date().toISOString(),
        metrics: {
          total_views: 0, total_duration_seconds: 0, avg_duration_seconds: 0,
          max_scroll_depth: 0, pricing_section_time_percent: 0,
          is_currently_viewing: false, was_forwarded: false, downloaded_pdf: false,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Time analysis
    const now = new Date();
    const lastView = views?.[0];
    const lastViewDate = lastView ? new Date(lastView.viewed_at) : null;
    const hoursSinceLastView = lastViewDate ? (now.getTime() - lastViewDate.getTime()) / (1000 * 60 * 60) : null;
    const isCurrentlyViewing = hoursSinceLastView !== null && hoursSinceLastView < 0.1; // Last 6 minutes
    
    // Section analysis
    const sectionTimes: Record<string, number> = {};
    views?.forEach(v => {
      if (v.time_per_section) {
        Object.entries(v.time_per_section as Record<string, number>).forEach(([section, time]) => {
          sectionTimes[section] = (sectionTimes[section] || 0) + time;
        });
      }
    });
    
    const totalSectionTime = Object.values(sectionTimes).reduce((sum, t) => sum + t, 0);
    const pricingTimePercent = totalSectionTime > 0 
      ? ((sectionTimes['pricing'] || 0) / totalSectionTime * 100) 
      : 0;
    
    // Scroll depth analysis
    const maxScrollDepth = Math.max(...(views?.map(v => v.scroll_depth_percent || 0) || [0]));
    
    // Interaction analysis
    const totalClicks = views?.reduce((sum, v) => {
      const interactions = v.interactions as Record<string, any> | null;
      return sum + (interactions?.clicks || 0);
    }, 0) || 0;
    
    const downloadedPdf = views?.some(v => {
      const interactions = v.interactions as Record<string, any> | null;
      return interactions?.downloaded_pdf;
    }) || false;
    
    const copiedText = views?.some(v => {
      const interactions = v.interactions as Record<string, any> | null;
      return interactions?.copied_text;
    }) || false;
    
    // Forward detection
    const wasForwarded = uniqueIPs > 1 || uniqueDevices > 1;

    // Aggregate viewed sections
    const viewedSectionsSet = new Set<string>();
    views?.forEach(v => {
      (v.sections_viewed as string[] | null)?.forEach(s => viewedSectionsSet.add(s));
      if (v.time_per_section) Object.keys(v.time_per_section).forEach(s => viewedSectionsSet.add(s));
    });
    const viewedSections = Array.from(viewedSectionsSet);
    const sectionLower = viewedSections.map(s => s.toLowerCase());
    const sectionHas = (token: string) => sectionLower.some(s => s.includes(token));

    // ---- Sprint C: deterministic scoring v2 ----
    const scoring = calculateProposalAnalyticsScore({
      proposal_status: proposal.status,
      proposal_sent_at: proposal.sent_at,
      proposal_expires_at: proposal.expires_at,
      total_views: totalViews,
      unique_visitors: uniqueIPs,
      total_duration_seconds: totalDuration,
      avg_duration_seconds: avgDuration,
      last_viewed_at: lastViewDate ? lastViewDate.toISOString() : null,
      forwarded_count: wasForwarded ? Math.max(0, uniqueIPs - 1) : 0,
      viewed_sections: viewedSections,
      attention_map: sectionTimes,
      pricing_section_seen: sectionHas('pric') || sectionHas('preco') || sectionHas('preço') || sectionHas('valor'),
      payment_section_seen: sectionHas('pay') || sectionHas('pagamento') || sectionHas('parcel'),
      items_section_seen: sectionHas('item') || sectionHas('produt') || sectionHas('escopo'),
      header_section_seen: sectionHas('header') || sectionHas('capa'),
      cta_section_seen: sectionHas('cta') || sectionHas('aceit') || sectionHas('approve'),
    });

    // Build context for AI - now includes deterministic scoring
    const behaviorContext = {
      proposal: {
        title: proposal.title,
        value: proposal.value,
        status: proposal.status,
        client_name: proposal.client_name,
        sent_at: proposal.sent_at,
        expires_at: proposal.expires_at,
        opportunity: proposal.opportunities
      },
      deterministic_scoring: scoring,
      metrics: {
        total_views: totalViews,
        total_duration_seconds: totalDuration,
        avg_duration_seconds: Math.round(avgDuration),
        unique_ips: uniqueIPs,
        unique_devices: uniqueDevices,
        max_scroll_depth: maxScrollDepth,
        total_clicks: totalClicks,
        downloaded_pdf: downloadedPdf,
        copied_text: copiedText,
        was_forwarded: wasForwarded,
        is_currently_viewing: isCurrentlyViewing,
        hours_since_last_view: hoursSinceLastView ? Math.round(hoursSinceLastView * 10) / 10 : null,
        pricing_section_time_percent: Math.round(pricingTimePercent),
        section_times: sectionTimes
      },
      events_summary: {
        total_events: events?.length || 0,
        event_types: [...new Set(events?.map(e => e.event_type) || [])]
      }
    };

    // Sprint C: AI must respect deterministic scoring — never contradict it
    const systemPrompt = `Você é um analista comercial sênior interpretando o engajamento de uma proposta B2B.

REGRAS OBRIGATÓRIAS (NÃO violar):
1. O sistema já calculou scores determinísticos em "deterministic_scoring". Você NÃO calcula score, apenas interpreta.
2. NÃO classifique o cliente como "altamente engajado" se last_view_age_days > 7.
3. NÃO gere tendência positiva de fechamento (engagement_level high/very_high) se não houve interação recente.
4. Diferencie "interesse histórico" de "engajamento atual". Leitura antiga NÃO é intenção atual.
5. Priorize alertas ACIONÁVEIS. NÃO transforme métrica descritiva em alerta (ex: "foi visualizada 4 vezes" sem ação não é alerta).
6. Se a entrega está próxima e não houve nova interação, o alerta principal DEVE ser de risco comercial.
7. Se preço/pagamento não foram vistos, gere alerta orientando reforço de valor antes de desconto.
8. Use o "engagement_label" e "score_explanation" do scoring como referência de tom.
9. Responda SEMPRE em português brasileiro.

MAPEAMENTO de engagement_level que você DEVE seguir:
- current_engagement_score >= 75 e last_view_age_days <= 1 → "very_high"
- current_engagement_score >= 60 e last_view_age_days <= 3 → "high"
- current_engagement_score >= 40 → "medium"
- caso contrário → "low"

Retorne JSON válido:
{
  "summary": "1-2 frases de diagnóstico comercial (não métrica descritiva)",
  "engagement_level": "low" | "medium" | "high" | "very_high",
  "commercial_diagnosis": "Análise comercial em 1-2 frases distinguindo histórico de atual",
  "risk_reading": "Leitura de risco em 1 frase",
  "concerns": ["preocupações comerciais reais"],
  "recommended_actions": [
    { "type": "call" | "email" | "meeting" | "discount" | "follow_up", "message": "Ação específica e direta", "priority": "low" | "medium" | "high" }
  ],
  "win_probability_delta": "use exatamente o valor de close_probability do scoring (0-100)",
  "best_contact_time": "Se last_view_age_days <= 3, sugira janela. Se > 7, retorne ação comercial urgente em vez de horário. Se > 14, retorne 'Contato de decisão. Confirmar se o projeto segue ativo.'",
  "next_best_action": "A única próxima ação mais importante",
  "followup_tone": "consultivo" | "urgente" | "decisao" | "reativacao",
  "followup_timing": "agora" | "hoje" | "24h" | "esta_semana",
  "smart_alerts": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "title": "Título do alerta (sem repetir métrica)",
      "description": "O que foi observado em termos comerciais",
      "why_it_matters": "Por que isso importa comercialmente AGORA",
      "recommended_action": "Ação concreta que o vendedor deve tomar",
      "source_metric": "campo do scoring que originou o alerta (ex: last_view_age_days, pricing_section_seen, days_to_delivery)"
    }
  ],
  "insights": [
    { "type": "pricing_focus" | "detailed_review" | "hesitation" | "comparison" | "urgency" | "inactivity" | "forwarded" | "high_engagement", "title": "string", "description": "string", "severity": "info" | "warning" | "success" | "critical" }
  ]
}`;

    const userPrompt = `Analise estes dados de comportamento de visualização de proposta:

${JSON.stringify(behaviorContext, null, 2)}

Gere insights acionáveis baseados nos padrões observados.`;

    let content = '';
    let usage: any = null;
    let modelUsed = 'gpt-5-mini';
    try {
      const aiResult = await callAI({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
        feature: 'proposal_analytics_ai_insights',
        organization_id: proposal.organization_id,
      });
      content = aiResult.content;
      usage = aiResult.usage;
      modelUsed = aiResult.model_used || modelUsed;
    } catch (aiErr) {
      console.error('[analyze-proposal-behavior] AI error', aiErr);
      if (cacheRow) {
        const payload = (cacheRow.insights_payload || {}) as any;
        return new Response(JSON.stringify({
          ...payload,
          status: 'stale',
          from_cache: true,
          error: 'ai_failed',
          analyzed_at: cacheRow.generated_at,
          cached_signature: cacheRow.analytics_signature,
          current_signature: currentSignature,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        status: 'error',
        error: 'ai_failed',
        analyzed_at: new Date().toISOString(),
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!content) {
      console.error('No content in AI response');
      if (cacheRow) {
        const payload = (cacheRow.insights_payload || {}) as any;
        return new Response(JSON.stringify({
          ...payload, status: 'stale', from_cache: true, error: 'empty_ai_content',
          analyzed_at: cacheRow.generated_at,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ status: 'error', error: 'empty_ai_content' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse AI response
    let analysis: ProposalBehaviorAnalysis;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, content);
      if (cacheRow) {
        const payload = (cacheRow.insights_payload || {}) as any;
        return new Response(JSON.stringify({
          ...payload, status: 'stale', from_cache: true, error: 'parse_failed',
          analyzed_at: cacheRow.generated_at,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ status: 'error', error: 'parse_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Store insights as alerts
    const alertsToCreate = analysis.insights.map(insight => ({
      proposal_id,
      organization_id: proposal.organization_id,
      alert_type: mapInsightTypeToAlertType(insight.type),
      message: `${insight.title}: ${insight.description}`,
      metadata: {
        insight_type: insight.type,
        severity: insight.severity,
        ai_generated: true,
        generated_at: new Date().toISOString()
      }
    }));

    if (alertsToCreate.length > 0) {
      const { error: alertsError } = await supabase
        .from('proposal_alerts')
        .insert(alertsToCreate);

      if (alertsError) {
        console.error('Error creating alerts:', alertsError);
      }
    }

    // ---- Persist cache ----
    const engagementMap: Record<string, number> = { low: 25, medium: 55, high: 80, very_high: 95 };
    const insightsPayload = {
      summary: analysis.summary,
      engagement: { score: engagementMap[analysis.engagement_level] ?? null, level: analysis.engagement_level },
      close_probability: { value: analysis.win_probability_delta, trend: 'neutral' },
      insights: analysis.insights,
      recommended_actions: analysis.recommended_actions,
      smart_alerts: analysis.insights,
      best_contact_time: analysis.best_contact_time,
      concerns: analysis.concerns,
      metrics: behaviorContext.metrics,
    };

    const tokensIn = usage?.prompt_tokens ?? 0;
    const tokensOut = usage?.completion_tokens ?? 0;
    const tokensTot = usage?.total_tokens ?? (tokensIn + tokensOut);

    if (currentSignature) {
      const { error: upsertErr } = await supabase.rpc('upsert_proposal_ai_insights_cache', {
        p_organization_id: proposal.organization_id,
        p_opportunity_id: proposal.opportunity_id,
        p_proposal_id: proposal_id,
        p_analytics_signature: currentSignature,
        p_insights_payload: insightsPayload,
        p_engagement_score: engagementMap[analysis.engagement_level] ?? null,
        p_engagement_level: analysis.engagement_level,
        p_close_probability: analysis.win_probability_delta,
        p_risk_level: null,
        p_recommended_actions: analysis.recommended_actions as any,
        p_smart_alerts: analysis.insights as any,
        p_generated_summary: analysis.summary,
        p_model_used: modelUsed,
        p_tokens_input: tokensIn,
        p_tokens_output: tokensOut,
        p_total_tokens: tokensTot,
      });
      if (upsertErr) console.error('[analyze-proposal-behavior] cache upsert error', upsertErr);
    }

    return new Response(
      JSON.stringify({
        ...analysis,
        ...insightsPayload,
        status: 'ok',
        from_cache: false,
        reason: refreshReason,
        current_signature: currentSignature,
        cached_signature: currentSignature,
        metrics: behaviorContext.metrics,
        analyzed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-proposal-behavior:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapInsightTypeToAlertType(type: string): string {
  const mapping: Record<string, string> = {
    'pricing_focus': 'price_focus',
    'detailed_review': 'multiple_views',
    'hesitation': 'hesitation',
    'comparison': 'comparison',
    'urgency': 'viewing_now',
    'inactivity': 'inactivity',
    'forwarded': 'forwarded',
    'high_engagement': 'high_engagement'
  };
  return mapping[type] || 'general';
}

function generateFallbackAnalysis(context: any): ProposalBehaviorAnalysis {
  const metrics = context.metrics;
  const insights: ProposalBehaviorAnalysis['insights'] = [];
  const recommended_actions: ProposalBehaviorAnalysis['recommended_actions'] = [];
  const concerns: string[] = [];
  
  let engagement_level: ProposalBehaviorAnalysis['engagement_level'] = 'low';
  let win_probability_delta = 0;
  let best_contact_time: string | null = null;
  
  // Currently viewing
  if (metrics.is_currently_viewing) {
    insights.push({
      type: 'urgency',
      title: 'Cliente Online AGORA',
      description: 'O cliente está visualizando a proposta neste momento. Momento ideal para contato!',
      severity: 'critical'
    });
    recommended_actions.push({
      type: 'call',
      message: 'Ligar agora - cliente está ativo na proposta',
      priority: 'high'
    });
    best_contact_time = 'AGORA - cliente está online';
    win_probability_delta += 15;
  }
  
  // Pricing focus
  if (metrics.pricing_section_time_percent > 50) {
    insights.push({
      type: 'pricing_focus',
      title: 'Foco em Preços',
      description: `Cliente gastou ${metrics.pricing_section_time_percent}% do tempo na seção de valores. Possível preocupação com preço.`,
      severity: 'warning'
    });
    concerns.push('pricing');
    recommended_actions.push({
      type: 'email',
      message: 'Enviar comparativo de valor vs. benefícios',
      priority: 'medium'
    });
    win_probability_delta -= 5;
  }
  
  // Multiple views
  if (metrics.total_views >= 3) {
    insights.push({
      type: 'detailed_review',
      title: 'Revisão Detalhada',
      description: `Cliente visualizou a proposta ${metrics.total_views} vezes. Alto interesse demonstrado.`,
      severity: 'success'
    });
    engagement_level = 'high';
    win_probability_delta += 10;
  }
  
  // Hesitation
  if (metrics.total_views >= 5 && context.proposal.status !== 'accepted') {
    insights.push({
      type: 'hesitation',
      title: 'Possível Hesitação',
      description: `${metrics.total_views} visualizações sem aceite. Cliente pode ter dúvidas não resolvidas.`,
      severity: 'warning'
    });
    concerns.push('decision_delay');
    recommended_actions.push({
      type: 'call',
      message: 'Ligar para esclarecer dúvidas e facilitar decisão',
      priority: 'high'
    });
  }
  
  // Forwarded
  if (metrics.was_forwarded) {
    insights.push({
      type: 'forwarded',
      title: 'Proposta Compartilhada',
      description: 'Proposta foi visualizada de diferentes IPs/dispositivos. Pode ter sido encaminhada para outros decisores.',
      severity: 'info'
    });
    win_probability_delta += 5;
  }
  
  // Inactivity
  if (metrics.hours_since_last_view && metrics.hours_since_last_view > 168) { // 7 days
    insights.push({
      type: 'inactivity',
      title: 'Proposta Inativa',
      description: `Sem visualização há ${Math.round(metrics.hours_since_last_view / 24)} dias. Necessário reengajamento.`,
      severity: 'warning'
    });
    recommended_actions.push({
      type: 'follow_up',
      message: 'Fazer follow-up - proposta sem atividade recente',
      priority: 'high'
    });
    win_probability_delta -= 10;
  }
  
  // Downloaded PDF
  if (metrics.downloaded_pdf) {
    insights.push({
      type: 'high_engagement',
      title: 'PDF Baixado',
      description: 'Cliente baixou o PDF da proposta. Sinal positivo de interesse em compartilhar internamente.',
      severity: 'success'
    });
    win_probability_delta += 5;
  }
  
  // Set engagement level based on metrics
  if (metrics.total_duration_seconds > 600 || metrics.total_views >= 5) {
    engagement_level = 'very_high';
  } else if (metrics.total_duration_seconds > 300 || metrics.total_views >= 3) {
    engagement_level = 'high';
  } else if (metrics.total_duration_seconds > 60 || metrics.total_views >= 2) {
    engagement_level = 'medium';
  }
  
  // Generate summary
  let summary = '';
  if (engagement_level === 'very_high' || engagement_level === 'high') {
    summary = 'Cliente demonstra alto interesse na proposta';
    if (concerns.includes('pricing')) {
      summary += ', porém está focado nos valores - considere abordar ROI';
    }
  } else if (engagement_level === 'medium') {
    summary = 'Engajamento moderado. Recomendado follow-up para aumentar interesse.';
  } else {
    summary = 'Baixo engajamento até o momento. Necessário reengajamento ativo.';
  }
  
  // Default action if none
  if (recommended_actions.length === 0) {
    recommended_actions.push({
      type: 'follow_up',
      message: 'Acompanhar proposta e verificar interesse',
      priority: 'medium'
    });
  }
  
  return {
    summary,
    engagement_level,
    concerns,
    recommended_actions,
    win_probability_delta: Math.max(-30, Math.min(30, win_probability_delta)),
    best_contact_time,
    insights
  };
}
