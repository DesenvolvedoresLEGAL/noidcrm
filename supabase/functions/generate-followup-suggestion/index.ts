import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";


const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId, context } = await req.json();
    
    if (!opportunityId) {
      throw new Error('opportunityId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch opportunity with all context including Vibe Selling fields
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(id, razao_social, nome_fantasia, segmento, porte, cnae, fit_score, intent_score),
        contact:contacts(id, nome, cargo, emails, telefones),
        stage:stages(id, name, order_index),
        pipeline:pipelines(id, name, pipeline_type),
        activities(id, type, title, status, scheduled_date, completed_at, description, created_at)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError) throw oppError;

    // Buscar memória emocional do lead (Vibe Selling)
    const { data: emotionalMemory } = await supabase
      .from('lead_emotional_memory')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .maybeSingle();

    // Get recent conversations/timeline
    const { data: timeline } = await supabase
      .from('unified_timeline')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('timestamp', { ascending: false })
      .limit(15);

    // Get any pending AI suggestions
    const { data: existingSuggestions } = await supabase
      .from('ai_suggestions')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('status', 'pending')
      .eq('suggestion_type', 'next_action')
      .limit(5);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const now = new Date();
    const completedActivities = (opportunity.activities || []).filter((a: any) => a.status === 'completed');
    const pendingActivities = (opportunity.activities || []).filter((a: any) => a.status === 'pending' || a.status === 'scheduled');
    
    const lastActivity = completedActivities.sort((a: any, b: any) => 
      new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime()
    )[0];

    const daysSinceContact = lastActivity 
      ? Math.floor((now.getTime() - new Date(lastActivity.completed_at || lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Construir contexto de Vibe Selling
    const vibeContext = emotionalMemory ? `
## Memória Emocional do Lead (Vibe Selling)
- Estado de Vibe: ${opportunity.vibe_state || 'neutral'}
- Temperatura: ${opportunity.temperature || 'warm'}
- Score de Energia: ${opportunity.energy_score || 50}/100
- Score de Timing: ${opportunity.timing_score || 50}/100
- Velocidade de Resposta: ${opportunity.response_velocity ? `${opportunity.response_velocity.toFixed(1)}h` : 'N/A'}
- Risco de Quebra de Vibe: ${emotionalMemory.risk_of_vibe_break || 'low'}
- Tom Ideal: ${emotionalMemory.ideal_tone || 'não definido'}
- Ritmo de Resposta: ${emotionalMemory.response_rhythm || 'não definido'}
- Gatilhos Positivos: ${emotionalMemory.positive_triggers?.join(', ') || 'nenhum identificado'}
- Gatilhos Negativos: ${emotionalMemory.negative_triggers?.join(', ') || 'nenhum identificado'}
- Objeção Dominante: ${emotionalMemory.dominant_objection_type || 'nenhuma'}
- Sinais de Compra: ${emotionalMemory.buying_signals?.join(', ') || 'nenhum identificado'}
- Última Interação: ${emotionalMemory.last_interaction_summary || 'sem resumo'}
- Estado Emocional Atual: ${emotionalMemory.last_emotional_state || 'desconhecido'}
` : `
## Vibe Selling
- Estado de Vibe: ${opportunity.vibe_state || 'neutral'}
- Temperatura: ${opportunity.temperature || 'warm'}
- Score de Energia: ${opportunity.energy_score || 50}/100
- Score de Timing: ${opportunity.timing_score || 50}/100
`;

    const prompt = `Você é um especialista em Vibe Selling - a arte de vender através da leitura emocional do lead.

IMPORTANTE: Em vez de sugerir "follow-up em X dias", você deve sugerir CONDIÇÕES para agir (trigger_condition).

## Contexto da Oportunidade
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || opportunity.value || 0}
- MRR: R$ ${opportunity.mrr || 0}/mês
- Etapa atual: ${opportunity.stage?.name} (posição ${opportunity.stage?.order_index})
- Pipeline: ${opportunity.pipeline?.name} (${opportunity.pipeline?.pipeline_type})
- Probabilidade: ${opportunity.prob || 0}%
- Dias na etapa: ${opportunity.days_in_stage || 0}
- Dias sem contato: ${daysSinceContact}

${vibeContext}

## Conta
- Empresa: ${opportunity.account?.nome_fantasia || opportunity.account?.razao_social}
- Segmento: ${opportunity.account?.segmento || 'N/A'}
- Porte: ${opportunity.account?.porte || 'N/A'}
- Fit Score: ${opportunity.account?.fit_score || 0}
- Intent Score: ${opportunity.account?.intent_score || 0}

## Contato Principal
- Nome: ${opportunity.contact?.nome || 'N/A'}
- Cargo: ${opportunity.contact?.cargo || 'N/A'}

## Histórico de Atividades (últimas 10)
${(opportunity.activities || []).slice(0, 10).map((a: any) => 
  `- ${a.type}: ${a.title} (${a.status}) - ${a.completed_at || a.scheduled_date || 'sem data'}`
).join('\n')}

## Últimas Interações
${(timeline || []).slice(0, 5).map((t: any) => 
  `- ${t.event_type}: ${t.title} - ${t.timestamp}`
).join('\n')}

## Contexto Adicional
${context || 'Nenhum contexto adicional fornecido'}

Retorne EXATAMENTE neste formato JSON com 2-4 sugestões de follow-up baseadas em VIBE:
{
  "suggestions": [
    {
      "type": "<call|email|meeting|whatsapp|proposal|follow-up|task|nurture|nudge>",
      "title": "<título curto e claro da ação>",
      "description": "<descrição detalhada do que fazer e por quê>",
      "priority": "<high|medium|low>",
      "trigger_condition": {
        "type": "<immediate|time_based|conditional>",
        "trigger": "<energy_drop|silence_3days|silence_5days|timing_favorable|vibe_recovery|engagement_spike|hot_moment|post_objection>",
        "description": "<descrição humanizada de quando agir>",
        "wait_for": "<condição específica ou null>"
      },
      "tone_recommendation": "<direto|tecnico|provocativo|humano|acolhedor|formal>",
      "expected_outcome": "<resultado esperado desta ação>",
      "script_hint": "<dica de script ou abordagem para o vendedor>",
      "vibe_risk": "<low|medium|high - risco de quebrar a vibe com esta ação>",
      "confidence": <0.0 a 1.0>
    }
  ],
  "overall_strategy": "<estratégia geral considerando a vibe do lead>",
  "urgency": "<low|medium|high|critical>",
  "key_insight": "<insight principal sobre a vibe deste deal>",
  "vibe_recommendation": "<recomendação geral sobre como manter/recuperar a vibe>"
}

REGRAS IMPORTANTES:
1. Se o lead está "blocked" ou com alto risco de quebra de vibe, priorize ações de acolhimento
2. Se está "hot_silent", sugira um nudge sutil em vez de pressão
3. Se está "ready_insecure", foque em dar segurança antes de pedir fechamento
4. Sempre considere os gatilhos negativos do lead para evitá-los
5. Use o tom ideal identificado na memória emocional
6. trigger_condition.type pode ser:
   - "immediate": agir agora
   - "time_based": após X dias (use como último recurso)
   - "conditional": aguardar uma condição específica (preferível)`;

    console.log('Generating Vibe-based follow-up suggestions for opportunity:', opportunityId);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em Vibe Selling com 20 anos de experiência. Sugira ações baseadas na leitura emocional do lead, não apenas em prazos. Sempre considere o risco de quebrar a vibe.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse;
    
    try {
      aiResponse = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', data.choices[0].message.content);
      throw new Error('Failed to parse AI response');
    }

    // Store suggestions in ai_suggestions table
    const { data: orgData } = await supabase
      .from('opportunities')
      .select('organization_id, owner_user_id')
      .eq('id', opportunityId)
      .single();

    if (orgData && aiResponse.suggestions) {
      // Delete existing pending suggestions for this opportunity
      await supabase
        .from('ai_suggestions')
        .delete()
        .eq('opportunity_id', opportunityId)
        .eq('suggestion_type', 'next_action')
        .eq('status', 'pending');

      // Insert new suggestions with trigger_condition
      for (const suggestion of aiResponse.suggestions) {
        await supabase
          .from('ai_suggestions')
          .insert({
            organization_id: orgData.organization_id,
            user_id: orgData.owner_user_id,
            opportunity_id: opportunityId,
            suggestion_type: 'next_action',
            suggested_value: {
              ...suggestion,
              vibe_based: true, // Marcar como sugestão baseada em vibe
            },
            reasoning: aiResponse.overall_strategy,
            confidence_score: suggestion.confidence || 0.7,
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
      }
    }

    // Log AI usage
    if (orgData) {
      await supabase.from('ai_usage_logs').insert({
        organization_id: orgData.organization_id,
        user_id: orgData.owner_user_id,
        entity_type: 'opportunity',
        entity_id: opportunityId,
        feature: 'vibe_selling',
        action: 'generate_followup_suggestion',
        model_used: 'gpt-5-mini',
        tokens_input: data.usage?.prompt_tokens || 0,
        tokens_output: data.usage?.completion_tokens || 0,
        tokens_total: data.usage?.total_tokens || 0,
        success: true
      });
    }

    console.log('Generated Vibe-based follow-up suggestions:', aiResponse);

    return new Response(JSON.stringify({
      success: true,
      ...aiResponse
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-followup-suggestion:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
