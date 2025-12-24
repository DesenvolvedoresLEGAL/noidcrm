import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmotionalMemoryUpdate {
  positive_triggers?: string[];
  negative_triggers?: string[];
  ideal_tone?: string;
  response_rhythm?: string;
  dominant_objection_type?: string;
  past_objections?: any[];
  last_interaction_summary?: string;
  last_emotional_state?: string;
  risk_of_vibe_break?: string;
  vibe_break_reason?: string;
  buying_signals?: string[];
  communication_patterns?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId, interactionId, forceAnalysis } = await req.json();
    
    if (!opportunityId) {
      return new Response(
        JSON.stringify({ error: 'opportunityId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Buscando oportunidade: ${opportunityId}`);

    // Buscar oportunidade (sem filtro de deleted_at, service role pode ver tudo)
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(id, razao_social, nome_fantasia, segmento),
        contact:contacts(id, name, cargo),
        stage:stages(name),
        pipeline:pipelines(name, pipeline_type)
      `)
      .eq('id', opportunityId)
      .is('deleted_at', null)
      .maybeSingle();

    console.log(`Resultado busca oportunidade:`, { found: !!opportunity, error: oppError?.message });

    if (oppError) {
      console.error('Erro ao buscar oportunidade:', oppError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar oportunidade', details: oppError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!opportunity) {
      return new Response(
        JSON.stringify({ error: 'Oportunidade não encontrada', opportunityId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar memória emocional existente
    const { data: existingMemory } = await supabase
      .from('lead_emotional_memory')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .maybeSingle();

    // Buscar últimas interações (últimos 60 dias)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(30);

    // Buscar atividades recentes
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    // Buscar memórias do Memory Engine
    const { data: memoryEntries } = await supabase
      .from('memory_entries')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Analisar padrões das interações
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    const channels: Record<string, number> = {};
    const objections: any[] = [];

    interactions?.forEach(i => {
      // Contar sentimentos
      if (i.sentiment === 'positive' || i.sentiment === 'very_positive') sentimentCounts.positive++;
      else if (i.sentiment === 'negative' || i.sentiment === 'very_negative') sentimentCounts.negative++;
      else sentimentCounts.neutral++;

      // Contar canais
      channels[i.channel || 'unknown'] = (channels[i.channel || 'unknown'] || 0) + 1;

      // Coletar objeções
      if (i.type === 'objection' && i.content) {
        objections.push({
          content: i.content,
          sentiment: i.sentiment,
          date: i.created_at,
        });
      }
    });

    // Calcular métricas
    const totalInteractions = interactions?.length || 0;
    const lastInteraction = interactions?.[0];
    const daysSinceLastContact = lastInteraction 
      ? Math.floor((Date.now() - new Date(lastInteraction.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Determinar canal preferido
    const preferredChannel = Object.entries(channels)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Preparar contexto para IA
    const aiContext = {
      opportunity: {
        title: opportunity.title,
        value: opportunity.value || opportunity.valor_previsto,
        probability: opportunity.prob,
        stage: opportunity.stage?.name,
        pipelineType: opportunity.pipeline?.pipeline_type,
        vibeState: opportunity.vibe_state,
        temperature: opportunity.temperature,
      },
      account: {
        name: opportunity.account?.razao_social || opportunity.account?.nome_fantasia,
        segment: opportunity.account?.segmento,
      },
      contact: {
        name: opportunity.contact?.name,
        role: opportunity.contact?.cargo,
      },
      metrics: {
        totalInteractions,
        daysSinceLastContact,
        sentimentCounts,
        preferredChannel,
      },
      existingMemory: existingMemory ? {
        positiveTriggers: existingMemory.positive_triggers,
        negativeTriggers: existingMemory.negative_triggers,
        idealTone: existingMemory.ideal_tone,
        dominantObjection: existingMemory.dominant_objection_type,
      } : null,
      recentInteractions: interactions?.slice(0, 10).map(i => ({
        type: i.type,
        channel: i.channel,
        sentiment: i.sentiment,
        summary: i.summary?.substring(0, 300),
        content: i.content?.substring(0, 500),
        createdAt: i.created_at,
      })),
      memoryInsights: memoryEntries?.slice(0, 15).map(m => ({
        type: m.memory_type,
        content: m.content?.substring(0, 300),
        importance: m.importance_score,
      })),
    };

    let memoryUpdate: EmotionalMemoryUpdate = {};
    let aiConfidence = 0.5;

    // Chamar IA para análise profunda
    if (lovableApiKey && (forceAnalysis || totalInteractions >= 3)) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `Você é um especialista em análise comportamental de vendas (Vibe Selling).
Analise o histórico de interações e memórias de um lead para extrair sua "memória emocional".

Você deve identificar:
1. **Gatilhos positivos**: O que motiva este lead (ex: ROI, cases de sucesso, urgência, inovação, economia)
2. **Gatilhos negativos**: O que trava este lead (ex: pressão, termos técnicos, preço, burocracia)
3. **Tom ideal**: Como se comunicar (direto, tecnico, provocativo, humano, acolhedor, formal)
4. **Ritmo de resposta**: Padrão do lead (rapido, reflexivo, lento)
5. **Tipo de objeção dominante**: (preco, tempo, autoridade, necessidade, concorrencia, confianca)
6. **Sinais de compra**: Indicadores de que está pronto para fechar
7. **Risco de quebra de vibe**: (low, medium, high, critical) com motivo
8. **Resumo da última interação**: Uma frase sobre o estado atual

Responda APENAS em JSON:
{
  "positive_triggers": ["trigger1", "trigger2"],
  "negative_triggers": ["trigger1", "trigger2"],
  "ideal_tone": "direto|tecnico|provocativo|humano|acolhedor|formal",
  "response_rhythm": "rapido|reflexivo|lento",
  "dominant_objection_type": "preco|tempo|autoridade|necessidade|concorrencia|confianca",
  "buying_signals": ["sinal1", "sinal2"],
  "last_interaction_summary": "Resumo em uma frase",
  "last_emotional_state": "Estado emocional atual",
  "risk_of_vibe_break": "low|medium|high|critical",
  "vibe_break_reason": "Motivo do risco se houver",
  "confidence": 0.0-1.0
}`
              },
              {
                role: 'user',
                content: `Analise este contexto e extraia a memória emocional do lead:\n\n${JSON.stringify(aiContext, null, 2)}`
              }
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              memoryUpdate = {
                positive_triggers: parsed.positive_triggers || [],
                negative_triggers: parsed.negative_triggers || [],
                ideal_tone: parsed.ideal_tone,
                response_rhythm: parsed.response_rhythm,
                dominant_objection_type: parsed.dominant_objection_type,
                buying_signals: parsed.buying_signals || [],
                last_interaction_summary: parsed.last_interaction_summary,
                last_emotional_state: parsed.last_emotional_state,
                risk_of_vibe_break: parsed.risk_of_vibe_break,
                vibe_break_reason: parsed.vibe_break_reason,
              };
              aiConfidence = parsed.confidence || 0.7;
            }
          }
        }
      } catch (aiError) {
        console.error('Erro ao chamar IA:', aiError);
      }
    }

    // Fallback: análise baseada em regras
    if (!memoryUpdate.last_interaction_summary && lastInteraction) {
      memoryUpdate.last_interaction_summary = lastInteraction.summary || 
        `Última interação via ${lastInteraction.channel || 'desconhecido'} há ${daysSinceLastContact} dias`;
    }

    // Detectar risco de quebra de vibe baseado em métricas
    if (!memoryUpdate.risk_of_vibe_break) {
      if (daysSinceLastContact > 14 && sentimentCounts.negative > sentimentCounts.positive) {
        memoryUpdate.risk_of_vibe_break = 'critical';
        memoryUpdate.vibe_break_reason = 'Silêncio prolongado com histórico negativo';
      } else if (daysSinceLastContact > 10) {
        memoryUpdate.risk_of_vibe_break = 'high';
        memoryUpdate.vibe_break_reason = 'Sem contato há mais de 10 dias';
      } else if (daysSinceLastContact > 5 && sentimentCounts.negative > 0) {
        memoryUpdate.risk_of_vibe_break = 'medium';
        memoryUpdate.vibe_break_reason = 'Período sem contato com sinais de resistência';
      } else {
        memoryUpdate.risk_of_vibe_break = 'low';
      }
      aiConfidence = 0.4;
    }

    // Merge com objeções coletadas
    if (objections.length > 0) {
      memoryUpdate.past_objections = [
        ...(existingMemory?.past_objections || []),
        ...objections.slice(0, 5),
      ].slice(-10); // Manter últimas 10
    }

    // Upsert memória emocional
    const memoryData = {
      organization_id: opportunity.organization_id,
      opportunity_id: opportunityId,
      contact_id: opportunity.contact_id,
      account_id: opportunity.account_id,
      ...memoryUpdate,
      preferred_channel: preferredChannel,
      communication_patterns: {
        sentimentCounts,
        channelUsage: channels,
        totalInteractions,
        averageResponseTime: null, // Pode ser calculado com mais dados
      },
      ai_confidence: aiConfidence,
      last_ai_analysis_at: new Date().toISOString(),
      analysis_version: (existingMemory?.analysis_version || 0) + 1,
    };

    let result;
    if (existingMemory) {
      const { data, error } = await supabase
        .from('lead_emotional_memory')
        .update(memoryData)
        .eq('id', existingMemory.id)
        .select()
        .single();
      result = { data, error, action: 'updated' };
    } else {
      const { data, error } = await supabase
        .from('lead_emotional_memory')
        .insert(memoryData)
        .select()
        .single();
      result = { data, error, action: 'created' };
    }

    if (result.error) {
      console.error('Erro ao salvar memória emocional:', result.error);
      throw result.error;
    }

    // Se detectou risco alto/crítico, criar alerta
    if (memoryUpdate.risk_of_vibe_break === 'high' || memoryUpdate.risk_of_vibe_break === 'critical') {
      await supabase.from('ai_alerts').insert({
        organization_id: opportunity.organization_id,
        user_id: opportunity.owner_user_id,
        alert_type: 'vibe_risk',
        priority: memoryUpdate.risk_of_vibe_break === 'critical' ? 'critical' : 'high',
        title: `Risco de quebra de vibe: ${opportunity.title}`,
        message: memoryUpdate.vibe_break_reason || 'Lead pode estar esfriando',
        entity_type: 'opportunity',
        entity_id: opportunityId,
        metadata: {
          vibeState: opportunity.vibe_state,
          riskLevel: memoryUpdate.risk_of_vibe_break,
          daysSinceContact: daysSinceLastContact,
        },
      });
    }

    console.log(`Memória emocional ${result.action} para oportunidade ${opportunityId}`);

    return new Response(
      JSON.stringify({
        success: true,
        action: result.action,
        memory: result.data,
        metrics: {
          totalInteractions,
          daysSinceLastContact,
          aiConfidence,
          riskLevel: memoryUpdate.risk_of_vibe_break,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em update-emotional-memory:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
