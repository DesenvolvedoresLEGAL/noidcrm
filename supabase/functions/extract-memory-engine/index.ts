import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MemoryExtraction {
  memory_type: string;
  title: string;
  content: string;
  keywords: string[];
  confidence_score: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      source_type, 
      source_id, 
      organization_id,
      context 
    } = await req.json();

    if (!source_type || !source_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sourceData: any = null;
    let opportunityData: any = null;
    let accountData: any = null;

    // Fetch source data based on type
    if (source_type === 'win_loss') {
      const { data: winLoss } = await supabase
        .from('win_loss_records')
        .select(`
          *,
          opportunity:opportunities(
            id, title, valor_previsto, stage_id, pipeline_id,
            account:accounts(id, razao_social, nome_fantasia, segmento, porte)
          )
        `)
        .eq('id', source_id)
        .single();
      
      sourceData = winLoss;
      opportunityData = winLoss?.opportunity;
      accountData = winLoss?.opportunity?.account;
    } else if (source_type === 'churn') {
      const { data: churn } = await supabase
        .from('churn_predictions')
        .select(`
          *,
          account:accounts(id, razao_social, nome_fantasia, segmento, porte)
        `)
        .eq('id', source_id)
        .single();
      
      sourceData = churn;
      accountData = churn?.account;
    } else if (source_type === 'playbook') {
      const { data: execution } = await supabase
        .from('playbook_executions')
        .select(`
          *,
          playbook:ai_playbooks(id, name, steps, target_stage),
          opportunity:opportunities(
            id, title, valor_previsto, stage_id, pipeline_id,
            account:accounts(id, razao_social, nome_fantasia, segmento, porte)
          )
        `)
        .eq('id', source_id)
        .single();
      
      sourceData = execution;
      opportunityData = execution?.opportunity;
      accountData = execution?.opportunity?.account;
    }

    if (!sourceData) {
      return new Response(
        JSON.stringify({ error: 'Source data not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt for memory extraction
    const prompt = buildExtractionPrompt(source_type, sourceData, accountData, context);

    // Call Lovable AI Gateway to extract memories
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em análise de vendas B2B. 
Sua tarefa é extrair memórias organizacionais acionáveis de eventos de vendas.

Tipos de memória que você pode extrair:
- objection: Objeções enfrentadas e como foram tratadas
- win_pattern: Padrões que levaram ao ganho do negócio
- loss_pattern: Padrões que levaram à perda do negócio
- churn_signal: Sinais que indicaram risco de churn
- converting_language: Frases/abordagens que funcionaram bem
- countermeasure: Contramedidas eficazes para objeções/problemas

Retorne APENAS um array JSON de memórias extraídas, no formato:
[
  {
    "memory_type": "win_pattern",
    "title": "Título curto e descritivo",
    "content": "Descrição detalhada do aprendizado",
    "keywords": ["keyword1", "keyword2"],
    "confidence_score": 0.8
  }
]

Extraia de 1 a 5 memórias relevantes. Seja específico e acionável.`
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    console.log('[extract-memory-engine] AI API response status:', aiResponse.status);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[extract-memory-engine] AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '[]';
    console.log('[extract-memory-engine] AI response content length:', aiContent.length);
    
    // Parse AI response
    let extractedMemories: MemoryExtraction[] = [];
    try {
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedMemories = JSON.parse(jsonMatch[0]);
        console.log('[extract-memory-engine] Extracted memories count:', extractedMemories.length);
      }
    } catch (e) {
      console.error('[extract-memory-engine] Failed to parse AI response:', e);
    }

    // Mark win_loss_record as processed
    if (source_type === 'win_loss') {
      await supabase
        .from('win_loss_records')
        .update({ memories_extracted: true })
        .eq('id', source_id);
    }

    // Insert extracted memories
    const insertedMemories = [];
    for (const memory of extractedMemories) {
      const { data: inserted, error } = await supabase
        .from('memories')
        .insert({
          organization_id,
          memory_type: memory.memory_type,
          title: memory.title,
          content: memory.content,
          keywords: memory.keywords || [],
          source_type,
          source_id,
          source_metadata: {
            extracted_from: source_type,
            account_name: accountData?.nome_fantasia || accountData?.razao_social,
            opportunity_title: opportunityData?.title,
            extraction_date: new Date().toISOString()
          },
          industry: accountData?.segmento,
          deal_size: getDealSize(opportunityData?.valor_previsto),
          stage: opportunityData?.stage_id,
          pipeline_id: opportunityData?.pipeline_id,
          confidence_score: memory.confidence_score || 0.5
        })
        .select()
        .single();

      if (!error && inserted) {
        insertedMemories.push(inserted);
      }
    }

    // Log AI run
    await supabase.from('ai_runs').insert({
      organization_id,
      run_type: 'memory_extraction',
      feature: 'memory_engine',
      model_used: 'openai/gpt-5-mini',
      input_context: { source_type, source_id, context },
      output_result: { memories_extracted: insertedMemories.length },
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      trace_id: crypto.randomUUID()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        memories_extracted: insertedMemories.length,
        memories: insertedMemories 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Memory extraction error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildExtractionPrompt(
  sourceType: string, 
  sourceData: any, 
  accountData: any,
  context?: any
): string {
  const accountInfo = accountData 
    ? `Empresa: ${accountData.nome_fantasia || accountData.razao_social}, Segmento: ${accountData.segmento || 'N/A'}, Porte: ${accountData.porte || 'N/A'}`
    : 'Empresa não identificada';

  if (sourceType === 'win_loss') {
    const outcome = sourceData.outcome === 'won' ? 'GANHO' : 'PERDIDO';
    return `
Analise este registro de ${outcome} e extraia memórias organizacionais:

${accountInfo}

Resultado: ${outcome}
${sourceData.reason_seller ? `Motivo (vendedor): ${sourceData.reason_seller}` : ''}
${sourceData.reason_free_text ? `Detalhes: ${sourceData.reason_free_text}` : ''}
${sourceData.key_differentiator ? `Diferencial chave: ${sourceData.key_differentiator}` : ''}
${sourceData.customer_feedback ? `Feedback do cliente: ${sourceData.customer_feedback}` : ''}
${sourceData.objections_faced?.length ? `Objeções enfrentadas: ${JSON.stringify(sourceData.objections_faced)}` : ''}
${sourceData.strengths_mentioned?.length ? `Pontos fortes mencionados: ${JSON.stringify(sourceData.strengths_mentioned)}` : ''}
${sourceData.weaknesses_mentioned?.length ? `Pontos fracos mencionados: ${JSON.stringify(sourceData.weaknesses_mentioned)}` : ''}
${sourceData.lessons_learned?.length ? `Lições aprendidas: ${JSON.stringify(sourceData.lessons_learned)}` : ''}
${sourceData.competitor ? `Competidor: ${sourceData.competitor}` : ''}
${sourceData.final_value ? `Valor final: R$ ${sourceData.final_value}` : ''}
${sourceData.sales_cycle_days ? `Ciclo de vendas: ${sourceData.sales_cycle_days} dias` : ''}

Extraia memórias acionáveis deste ${outcome === 'GANHO' ? 'sucesso' : 'fracasso'}.`;
  }

  if (sourceType === 'churn') {
    return `
Analise esta previsão de CHURN e extraia sinais de alerta:

${accountInfo}

Probabilidade de Churn: ${(sourceData.churn_probability * 100).toFixed(1)}%
Nível de Risco: ${sourceData.risk_level}
${sourceData.risk_factors ? `Fatores de Risco: ${JSON.stringify(sourceData.risk_factors)}` : ''}
${sourceData.recommendations ? `Recomendações: ${JSON.stringify(sourceData.recommendations)}` : ''}

Extraia sinais de churn e contramedidas sugeridas.`;
  }

  if (sourceType === 'playbook') {
    return `
Analise esta execução de PLAYBOOK e extraia aprendizados:

${accountInfo}

Playbook: ${sourceData.playbook?.name || 'N/A'}
Resultado: ${sourceData.outcome || 'N/A'}
${sourceData.execution_notes ? `Notas: ${sourceData.execution_notes}` : ''}
${sourceData.playbook?.steps ? `Passos executados: ${JSON.stringify(sourceData.playbook.steps)}` : ''}

Extraia padrões de sucesso e linguagem que converte.`;
  }

  return `Analise o seguinte contexto e extraia memórias: ${JSON.stringify(sourceData)}`;
}

function getDealSize(value?: number): string | null {
  if (!value) return null;
  if (value < 10000) return 'small';
  if (value < 50000) return 'medium';
  if (value < 200000) return 'large';
  return 'enterprise';
}
