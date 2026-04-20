import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId, question, conversationHistory } = await req.json();
    
    if (!opportunityId) {
      return new Response(
        JSON.stringify({ error: 'opportunityId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar oportunidade com todos os dados relevantes
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(id, razao_social, nome_fantasia, segmento, porte),
        contact:contacts(id, nome, cargo, emails),
        stage:stages(name, order_index),
        pipeline:pipelines(name, pipeline_type)
      `)
      .eq('id', opportunityId)
      .is('deleted_at', null)
      .maybeSingle();

    if (oppError || !opportunity) {
      console.error('Erro ao buscar oportunidade:', oppError);
      return new Response(
        JSON.stringify({ error: 'Oportunidade não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar memória emocional
    const { data: emotionalMemory } = await supabase
      .from('lead_emotional_memory')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .maybeSingle();

    // Buscar últimas interações
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(15);

    // Buscar atividades recentes
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Buscar memórias do Memory Engine
    const { data: memoryEntries } = await supabase
      .from('memory_entries')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('importance_score', { ascending: false })
      .limit(20);

    // Buscar alertas de vibe ativos
    const { data: vibeAlerts } = await supabase
      .from('vibe_alerts')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);

    // Calcular métricas
    const now = new Date();
    const lastInteraction = interactions?.[0];
    const daysSinceLastContact = lastInteraction 
      ? Math.floor((now.getTime() - new Date(lastInteraction.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Preparar contexto completo para a IA
    const vibeContext = {
      opportunity: {
        title: opportunity.title,
        value: opportunity.value || opportunity.valor_previsto,
        probability: opportunity.prob,
        stage: opportunity.stage?.name,
        stageIndex: opportunity.stage?.order_index,
        pipelineType: opportunity.pipeline?.pipeline_type,
        vibeState: opportunity.vibe_state,
        temperature: opportunity.temperature,
        energyScore: opportunity.energy_score,
        timingScore: opportunity.timing_score,
        responseVelocity: opportunity.response_velocity,
        daysInStage: opportunity.days_in_stage,
        closeDate: opportunity.close_date || opportunity.close_date_prevista,
        status: opportunity.status,
      },
      account: {
        name: opportunity.account?.razao_social || opportunity.account?.nome_fantasia,
        segment: opportunity.account?.segmento,
        size: opportunity.account?.porte,
      },
      contact: {
        name: opportunity.contact?.nome,
        role: opportunity.contact?.cargo,
      },
      emotionalMemory: emotionalMemory ? {
        positiveTriggers: emotionalMemory.positive_triggers,
        negativeTriggers: emotionalMemory.negative_triggers,
        idealTone: emotionalMemory.ideal_tone,
        responseRhythm: emotionalMemory.response_rhythm,
        dominantObjection: emotionalMemory.dominant_objection_type,
        buyingSignals: emotionalMemory.buying_signals,
        lastInteractionSummary: emotionalMemory.last_interaction_summary,
        lastEmotionalState: emotionalMemory.last_emotional_state,
        riskOfVibeBreak: emotionalMemory.risk_of_vibe_break,
        vibeBreakReason: emotionalMemory.vibe_break_reason,
      } : null,
      metrics: {
        daysSinceLastContact,
        totalInteractions: interactions?.length || 0,
        recentSentiments: interactions?.slice(0, 5).map(i => i.sentiment).filter(Boolean),
      },
      recentInteractions: interactions?.slice(0, 5).map(i => ({
        type: i.type,
        channel: i.channel,
        sentiment: i.sentiment,
        summary: i.summary?.substring(0, 200),
        date: i.created_at,
      })),
      memoryInsights: memoryEntries?.slice(0, 10).map(m => ({
        type: m.memory_type,
        content: m.content?.substring(0, 200),
        importance: m.importance_score,
      })),
      activeAlerts: vibeAlerts?.map(a => ({
        type: a.alert_type,
        title: a.title,
        message: a.message,
        priority: a.priority,
      })),
    };

    // Construir prompt do sistema
    const systemPrompt = `Você é um Coach de Vendas especializado em Vibe Selling - a arte de vender através da leitura emocional e contextual do lead.

Seu papel é aconselhar vendedores sobre:
- Quando e como abordar o lead
- Qual tom usar na comunicação
- Riscos emocionais de cada ação
- Timing ideal para fechar
- Como recuperar vibes quebradas

## Contexto do Lead
${JSON.stringify(vibeContext, null, 2)}

## Estados de Vibe
- neutral: Sem informação suficiente
- curious: Demonstra interesse, faz perguntas
- exploratory: Aberto, fase de descoberta
- skeptical: Dúvidas, precisa de provas
- comparative: Avaliando opções, comparando
- deciding: Momento de decisão
- blocked: Travado emocionalmente
- hot_silent: Alto interesse mas silencioso
- ready_insecure: Quer fechar mas tem medo

## Diretrizes
1. Seja direto e prático nas recomendações
2. Sempre considere o risco emocional de cada ação
3. Baseie-se nos gatilhos positivos/negativos do lead
4. Respeite o ritmo de resposta do lead
5. Priorize a construção de confiança sobre pressão
6. Se o lead está "blocked", sugira acolhimento antes de argumentação
7. Se está "hot_silent", um nudge sutil é melhor que pressão

Responda em português de forma conversacional mas profissional.
Seja conciso (máximo 3-4 parágrafos).
Quando apropriado, estruture a resposta em tópicos.`;

    // Construir mensagens
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Adicionar histórico de conversa se houver
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Adicionar pergunta atual
    const userQuestion = question || 'Como devo abordar esse lead agora? Qual a melhor estratégia considerando o contexto atual?';
    messages.push({ role: 'user', content: userQuestion });

    // Chamar IA
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit excedido. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Entre em contato com o administrador.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'Não foi possível gerar uma resposta.';

    console.log(`AI Vibe Advisor respondeu para oportunidade ${opportunityId}`);

    return new Response(
      JSON.stringify({
        success: true,
        answer,
        context: {
          vibeState: opportunity.vibe_state,
          temperature: opportunity.temperature,
          energyScore: opportunity.energy_score,
          timingScore: opportunity.timing_score,
          riskLevel: emotionalMemory?.risk_of_vibe_break,
          idealTone: emotionalMemory?.ideal_tone,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em ai-vibe-advisor:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
