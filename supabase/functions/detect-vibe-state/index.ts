import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estados de vibe disponíveis
const VIBE_STATES = {
  neutral: { label: 'Neutro', description: 'Estado inicial, sem informação suficiente' },
  curious: { label: 'Curioso', description: 'Demonstra interesse, faz perguntas' },
  exploratory: { label: 'Exploratório', description: 'Quer entender mais, está aberto' },
  skeptical: { label: 'Cético', description: 'Dúvidas, resistências, precisa de provas' },
  comparative: { label: 'Comparativo', description: 'Avaliando opções, comparando' },
  deciding: { label: 'Em Decisão', description: 'Momento de escolha, perto do fechamento' },
  blocked: { label: 'Travado', description: 'Bloqueio emocional, precisa de acolhimento' },
  hot_silent: { label: 'Quente Silencioso', description: 'Interesse alto mas pouca comunicação' },
  ready_insecure: { label: 'Pronto mas Inseguro', description: 'Quer fechar mas tem medo' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId } = await req.json();
    
    if (!opportunityId) {
      return new Response(
        JSON.stringify({ error: 'opportunityId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados da oportunidade
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(razao_social, nome_fantasia),
        contact:contacts(name, email),
        stage:stages(name),
        pipeline:pipelines(name)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError || !opportunity) {
      console.error('Erro ao buscar oportunidade:', oppError);
      return new Response(
        JSON.stringify({ error: 'Oportunidade não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar interações recentes (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    // Buscar atividades recentes
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    // Calcular métricas de engagement
    const now = new Date();
    const lastInteraction = interactions?.[0];
    const daysSinceLastInteraction = lastInteraction 
      ? Math.floor((now.getTime() - new Date(lastInteraction.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Calcular velocidade de resposta média
    let responseVelocity = null;
    if (interactions && interactions.length >= 2) {
      const responseTimes: number[] = [];
      for (let i = 1; i < interactions.length; i++) {
        const timeDiff = new Date(interactions[i-1].created_at).getTime() - 
                        new Date(interactions[i].created_at).getTime();
        responseTimes.push(timeDiff / (1000 * 60 * 60)); // em horas
      }
      responseVelocity = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    // Analisar sentimentos das interações
    const sentiments = interactions?.map(i => i.sentiment).filter(Boolean) || [];
    const positiveSentiments = sentiments.filter(s => s === 'positive' || s === 'very_positive').length;
    const negativeSentiments = sentiments.filter(s => s === 'negative' || s === 'very_negative').length;

    // Calcular energy_score (0-100)
    let energyScore = 50; // Base
    
    // Ajustar por frequência de interações
    const interactionCount = interactions?.length || 0;
    energyScore += Math.min(interactionCount * 3, 20); // Max +20 por quantidade
    
    // Ajustar por sentimento
    energyScore += (positiveSentiments - negativeSentiments) * 5;
    
    // Penalizar por silêncio
    if (daysSinceLastInteraction > 7) energyScore -= 15;
    else if (daysSinceLastInteraction > 3) energyScore -= 5;
    
    // Ajustar por velocidade de resposta
    if (responseVelocity !== null) {
      if (responseVelocity < 4) energyScore += 15; // Resposta < 4h
      else if (responseVelocity < 24) energyScore += 5; // Resposta < 1 dia
      else if (responseVelocity > 72) energyScore -= 10; // Resposta > 3 dias
    }
    
    energyScore = Math.max(0, Math.min(100, energyScore));

    // Calcular timing_score (0-100)
    let timingScore = 50;
    
    // Ajustar por proximidade do close_date
    if (opportunity.close_date) {
      const daysToClose = Math.floor((new Date(opportunity.close_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToClose < 0) timingScore -= 20; // Passou a data
      else if (daysToClose <= 7) timingScore += 20; // Próxima semana
      else if (daysToClose <= 14) timingScore += 10; // Próximas 2 semanas
      else if (daysToClose > 60) timingScore -= 10; // Muito distante
    }
    
    // Ajustar por atividade recente do lead
    if (daysSinceLastInteraction === 0) timingScore += 20;
    else if (daysSinceLastInteraction <= 2) timingScore += 10;
    else if (daysSinceLastInteraction > 14) timingScore -= 15;
    
    timingScore = Math.max(0, Math.min(100, timingScore));

    // Preparar contexto para IA
    const context = {
      opportunity: {
        title: opportunity.title,
        value: opportunity.value,
        probability: opportunity.prob,
        stage: opportunity.stage?.name,
        daysInStage: opportunity.days_in_stage,
        temperature: opportunity.temperature,
        status: opportunity.status,
      },
      account: {
        name: opportunity.account?.razao_social || opportunity.account?.nome_fantasia,
      },
      metrics: {
        energyScore,
        timingScore,
        responseVelocity,
        daysSinceLastInteraction,
        interactionCount,
        positiveSentiments,
        negativeSentiments,
      },
      recentInteractions: interactions?.slice(0, 5).map(i => ({
        type: i.type,
        sentiment: i.sentiment,
        summary: i.summary?.substring(0, 200),
        createdAt: i.created_at,
      })),
      recentActivities: activities?.slice(0, 5).map(a => ({
        type: a.type,
        title: a.title,
        status: a.status,
        scheduledDate: a.scheduled_date,
      })),
    };

    // Chamar IA para detectar vibe state
    let detectedState = 'neutral';
    let confidence = 0.5;
    let factors: string[] = [];

    if (lovableApiKey) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [
              {
                role: 'system',
                content: `Você é um especialista em análise comportamental de vendas (Vibe Selling).
Analise o contexto de uma oportunidade de venda e determine o estado emocional/comportamental do lead.

Estados disponíveis:
- neutral: Estado inicial, sem informação suficiente para classificar
- curious: Lead demonstra interesse ativo, faz perguntas, quer saber mais
- exploratory: Lead está aberto, explorando possibilidades, fase de descoberta
- skeptical: Lead tem dúvidas, resistências, precisa de provas e cases
- comparative: Lead está comparando opções, avaliando concorrentes
- deciding: Lead está em momento de decisão, perto do fechamento
- blocked: Lead está travado emocionalmente, precisa de acolhimento
- hot_silent: Lead demonstrou muito interesse mas ficou silencioso recentemente
- ready_insecure: Lead quer fechar mas demonstra insegurança ou medo

Responda APENAS em JSON com:
{
  "state": "nome_do_estado",
  "confidence": 0.0-1.0,
  "factors": ["fator1", "fator2", "fator3"],
  "recommendation": "Uma frase sobre como abordar este lead"
}`
              },
              {
                role: 'user',
                content: `Analise este contexto e determine o vibe state do lead:\n\n${JSON.stringify(context, null, 2)}`
              }
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            // Extrair JSON da resposta
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.state && VIBE_STATES[parsed.state as keyof typeof VIBE_STATES]) {
                detectedState = parsed.state;
                confidence = parsed.confidence || 0.7;
                factors = parsed.factors || [];
              }
            }
          }
        }
      } catch (aiError) {
        console.error('Erro ao chamar IA:', aiError);
        // Fallback para detecção baseada em regras
      }
    }

    // Fallback: detecção baseada em regras se IA falhar
    if (detectedState === 'neutral' && !lovableApiKey) {
      // Regras heurísticas
      if (energyScore > 80 && daysSinceLastInteraction > 5) {
        detectedState = 'hot_silent';
        factors.push('Alta energia mas silêncio recente');
      } else if (energyScore > 70 && timingScore > 70) {
        detectedState = 'deciding';
        factors.push('Alta energia e timing favorável');
      } else if (energyScore < 30) {
        detectedState = 'blocked';
        factors.push('Baixa energia de engagement');
      } else if (negativeSentiments > positiveSentiments) {
        detectedState = 'skeptical';
        factors.push('Sentimentos negativos predominantes');
      } else if (interactionCount > 5 && energyScore > 60) {
        detectedState = 'exploratory';
        factors.push('Múltiplas interações com engagement');
      } else if (interactionCount > 0) {
        detectedState = 'curious';
        factors.push('Interações iniciais positivas');
      }
      confidence = 0.5;
    }

    // Buscar estado anterior
    const previousState = opportunity.vibe_state;

    // Atualizar oportunidade
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({
        vibe_state: detectedState,
        energy_score: energyScore,
        timing_score: timingScore,
        response_velocity: responseVelocity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId);

    if (updateError) {
      console.error('Erro ao atualizar oportunidade:', updateError);
      throw updateError;
    }

    // Registrar no histórico se mudou
    if (previousState !== detectedState) {
      await supabase
        .from('vibe_state_history')
        .insert({
          opportunity_id: opportunityId,
          organization_id: opportunity.organization_id,
          previous_state: previousState,
          new_state: detectedState,
          detected_by: 'ai',
          confidence_score: confidence,
          detection_factors: { factors, context: { energyScore, timingScore, responseVelocity } },
        });
    }

    console.log(`Vibe state detectado para ${opportunityId}: ${detectedState} (confidence: ${confidence})`);

    return new Response(
      JSON.stringify({
        success: true,
        opportunityId,
        vibeState: detectedState,
        vibeLabel: VIBE_STATES[detectedState as keyof typeof VIBE_STATES]?.label,
        confidence,
        factors,
        metrics: {
          energyScore,
          timingScore,
          responseVelocity,
          daysSinceLastInteraction,
        },
        stateChanged: previousState !== detectedState,
        previousState,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em detect-vibe-state:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
