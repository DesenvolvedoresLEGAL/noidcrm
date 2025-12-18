import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id, target_stage, target_persona, category } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating playbook from win/loss data for org: ${organization_id}`);

    // Fetch win/loss records with detailed reasons
    const { data: winLossRecords, error: winLossError } = await supabase
      .from('win_loss_records')
      .select(`
        *,
        opportunities:opportunity_id (
          title,
          valor_previsto,
          temperature,
          stage_id,
          pipeline_stages:stage_id (name)
        )
      `)
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (winLossError) {
      console.error('Error fetching win/loss records:', winLossError);
      throw winLossError;
    }

    // Fetch organizational memories
    const { data: memories, error: memoriesError } = await supabase
      .from('organizational_memories')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .order('confidence_score', { ascending: false })
      .limit(50);

    if (memoriesError) {
      console.error('Error fetching memories:', memoriesError);
    }

    // Analyze patterns
    const wins = winLossRecords?.filter(r => r.outcome === 'won') || [];
    const losses = winLossRecords?.filter(r => r.outcome === 'lost') || [];
    
    // Calculate win rate by category
    const winReasons: Record<string, number> = {};
    const lossReasons: Record<string, number> = {};
    const objections: Record<string, number> = {};
    const competitors: Record<string, { wins: number; losses: number }> = {};

    wins.forEach(w => {
      if (w.win_reason) {
        winReasons[w.win_reason] = (winReasons[w.win_reason] || 0) + 1;
      }
    });

    losses.forEach(l => {
      if (l.loss_reason) {
        lossReasons[l.loss_reason] = (lossReasons[l.loss_reason] || 0) + 1;
      }
      if (l.competitor_name) {
        if (!competitors[l.competitor_name]) {
          competitors[l.competitor_name] = { wins: 0, losses: 0 };
        }
        competitors[l.competitor_name].losses++;
      }
      if (l.objections_faced && Array.isArray(l.objections_faced)) {
        l.objections_faced.forEach((obj: string) => {
          objections[obj] = (objections[obj] || 0) + 1;
        });
      }
    });

    wins.forEach(w => {
      if (w.competitor_name) {
        if (!competitors[w.competitor_name]) {
          competitors[w.competitor_name] = { wins: 0, losses: 0 };
        }
        competitors[w.competitor_name].wins++;
      }
    });

    // Extract key insights from memories
    const memoryInsights = memories?.map(m => ({
      type: m.memory_type,
      insight: m.insight,
      confidence: m.confidence_score,
    })) || [];

    // Build context for AI
    const analysisContext = {
      totalDeals: winLossRecords?.length || 0,
      winRate: wins.length / (winLossRecords?.length || 1),
      topWinReasons: Object.entries(winReasons)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count })),
      topLossReasons: Object.entries(lossReasons)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count })),
      topObjections: Object.entries(objections)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([objection, count]) => ({ objection, count })),
      competitorAnalysis: Object.entries(competitors)
        .map(([name, stats]) => ({ 
          name, 
          ...stats, 
          winRate: stats.wins / (stats.wins + stats.losses) 
        }))
        .sort((a, b) => b.losses - a.losses)
        .slice(0, 5),
      memoryInsights: memoryInsights.slice(0, 10),
      avgDealSize: wins.reduce((sum, w) => sum + (w.opportunities?.valor_previsto || 0), 0) / (wins.length || 1),
      avgSalesCycle: wins.reduce((sum, w) => sum + (w.sales_cycle_days || 0), 0) / (wins.length || 1),
    };

    // Generate playbook using AI if available
    let generatedPlaybook = null;
    
    if (lovableApiKey) {
      const systemPrompt = `Você é um especialista em vendas B2B e criação de playbooks de vendas.
Analise os dados de win/loss e memórias organizacionais para criar um playbook de vendas otimizado.

O playbook deve incluir:
1. Nome descritivo e objetivo claro
2. Passos detalhados com ações específicas
3. Gatilhos de quando usar este playbook
4. Métricas de sucesso esperadas
5. Técnicas para superar as objeções mais comuns
6. Diferenciais contra os principais competidores

Responda em JSON com a estrutura:
{
  "name": "string",
  "description": "string",
  "category": "prospecting|discovery|demo|negotiation|closing|objection_handling|competitor_battle",
  "complexity": "basic|intermediate|advanced",
  "estimated_hours": number,
  "target_persona": "string ou null",
  "target_stage": "string ou null",
  "steps": [
    {
      "order": number,
      "title": "string",
      "description": "string",
      "action_type": "email|call|meeting|task|wait",
      "duration_minutes": number,
      "scripts": ["string"],
      "tips": ["string"]
    }
  ],
  "trigger_conditions": {
    "stage": "string ou null",
    "temperature": "string ou null",
    "deal_size_min": number ou null,
    "competitor_mentioned": "string ou null"
  },
  "success_metrics": {
    "target_conversion_rate": number,
    "target_cycle_days": number,
    "expected_roi": number
  },
  "objection_handlers": [
    {
      "objection": "string",
      "response": "string",
      "follow_up": "string"
    }
  ],
  "competitor_battlecards": [
    {
      "competitor": "string",
      "weaknesses": ["string"],
      "our_strengths": ["string"],
      "key_differentiators": ["string"]
    }
  ]
}`;

      const userPrompt = `Dados de análise Win/Loss:
${JSON.stringify(analysisContext, null, 2)}

${target_stage ? `Foco no estágio: ${target_stage}` : ''}
${target_persona ? `Persona alvo: ${target_persona}` : ''}
${category ? `Categoria desejada: ${category}` : ''}

Crie um playbook otimizado baseado nesses dados de vendas reais.`;

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
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              generatedPlaybook = JSON.parse(jsonMatch[0]);
            }
          }
        } else {
          console.error('AI response not ok:', aiResponse.status);
        }
      } catch (aiError) {
        console.error('Error calling AI:', aiError);
      }
    }

    // Fallback to rule-based generation if AI fails
    if (!generatedPlaybook) {
      const topObjection = Object.entries(objections).sort(([,a], [,b]) => b - a)[0];
      const topCompetitor = Object.entries(competitors)
        .sort(([,a], [,b]) => b.losses - a.losses)[0];

      generatedPlaybook = {
        name: category ? `Playbook ${category}` : 'Playbook Baseado em Dados',
        description: `Playbook gerado automaticamente a partir de ${winLossRecords?.length || 0} registros de win/loss`,
        category: category || 'discovery',
        complexity: 'intermediate',
        estimated_hours: 2,
        target_persona: target_persona || null,
        target_stage: target_stage || null,
        steps: [
          {
            order: 1,
            title: 'Qualificação Inicial',
            description: 'Validar fit e interesse do prospect',
            action_type: 'call',
            duration_minutes: 15,
            scripts: ['Olá, vi que sua empresa...'],
            tips: ['Focar em dores específicas do segmento']
          },
          {
            order: 2,
            title: 'Apresentação de Valor',
            description: 'Demonstrar ROI e diferenciais',
            action_type: 'meeting',
            duration_minutes: 45,
            scripts: [],
            tips: wins.length > 0 
              ? [`Principal motivo de vitória: ${Object.keys(winReasons)[0] || 'Qualidade'}`]
              : []
          },
          {
            order: 3,
            title: 'Follow-up',
            description: 'Manter engajamento e avançar negociação',
            action_type: 'email',
            duration_minutes: 10,
            scripts: [],
            tips: []
          }
        ],
        trigger_conditions: {
          stage: target_stage || null,
          temperature: null,
          deal_size_min: null,
          competitor_mentioned: topCompetitor ? topCompetitor[0] : null
        },
        success_metrics: {
          target_conversion_rate: analysisContext.winRate * 1.1,
          target_cycle_days: Math.round(analysisContext.avgSalesCycle * 0.9),
          expected_roi: 2.5
        },
        objection_handlers: topObjection ? [{
          objection: topObjection[0],
          response: 'Resposta padrão para esta objeção',
          follow_up: 'Agendar call de follow-up'
        }] : [],
        competitor_battlecards: topCompetitor ? [{
          competitor: topCompetitor[0],
          weaknesses: ['Identificar via análise'],
          our_strengths: Object.keys(winReasons).slice(0, 3),
          key_differentiators: []
        }] : []
      };
    }

    // Save the generated playbook
    const { data: savedPlaybook, error: saveError } = await supabase
      .from('ai_playbooks')
      .insert({
        organization_id,
        name: generatedPlaybook.name,
        description: generatedPlaybook.description,
        category: generatedPlaybook.category,
        complexity: generatedPlaybook.complexity,
        estimated_hours: generatedPlaybook.estimated_hours,
        target_persona: generatedPlaybook.target_persona,
        target_stage: generatedPlaybook.target_stage,
        steps: generatedPlaybook.steps,
        trigger_conditions: generatedPlaybook.trigger_conditions,
        success_metrics: generatedPlaybook.success_metrics,
        is_active: false, // Starts as draft
        is_ai_generated: true,
        version: 1,
        roi_threshold: 1.5,
        min_sample_size: 10,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving playbook:', saveError);
      throw saveError;
    }

    console.log(`Playbook generated and saved: ${savedPlaybook.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        playbook: savedPlaybook,
        generatedContent: generatedPlaybook,
        analysisContext,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-playbook-from-winloss:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
