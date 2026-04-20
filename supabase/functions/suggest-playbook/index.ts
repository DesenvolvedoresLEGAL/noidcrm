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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { opportunity_id, organization_id } = await req.json();

    if (!opportunity_id || !organization_id) {
      return new Response(JSON.stringify({ error: 'opportunity_id and organization_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch opportunity with context
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        id, titulo, valor_previsto, prob, temperature, status, stage_id,
        account:accounts(razao_social, nome_fantasia, segmento, porte, cidade, uf),
        contact:contacts(nome, cargo),
        pipeline:pipelines(name, pipeline_type),
        stage:stages(name)
      `)
      .eq('id', opportunity_id)
      .single();

    if (oppError || !opportunity) {
      return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch existing playbooks
    const { data: playbooks } = await supabase
      .from('ai_playbooks')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .order('success_rate', { ascending: false });

    // Fetch recent activities
    const { data: activities } = await supabase
      .from('activities')
      .select('type, status, title, completed_at')
      .eq('opportunity_id', opportunity_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Find matching playbooks based on conditions
    const matchingPlaybooks = playbooks?.filter(pb => {
      const conditions = pb.trigger_conditions || [];
      
      // Check temperature match
      if (pb.target_temperature && pb.target_temperature !== opportunity.temperature) {
        return false;
      }
      
      // Check stage match
      if (pb.target_stage && pb.target_stage !== (opportunity.stage as any)?.name) {
        return false;
      }
      
      return true;
    }) || [];

    let aiSuggestion = null;

    // Use AI to generate or select best playbook
    if (lovableApiKey) {
      try {
        const contextPrompt = `Analise esta oportunidade de vendas e sugira a melhor abordagem:

OPORTUNIDADE:
- Título: ${opportunity.titulo}
- Valor: R$ ${opportunity.valor_previsto?.toLocaleString('pt-BR') || 0}
- Temperatura: ${opportunity.temperature || 'não definida'}
- Estágio: ${(opportunity.stage as any)?.name || 'não definido'}
- Pipeline: ${(opportunity.pipeline as any)?.name || 'não definido'}

EMPRESA:
- Nome: ${(opportunity.account as any)?.nome_fantasia || (opportunity.account as any)?.razao_social || 'não informado'}
- Segmento: ${(opportunity.account as any)?.segmento || 'não informado'}
- Porte: ${(opportunity.account as any)?.porte || 'não informado'}
- Localização: ${(opportunity.account as any)?.cidade || ''} ${(opportunity.account as any)?.uf || ''}

CONTATO:
- Nome: ${(opportunity.contact as any)?.nome || 'não informado'}
- Cargo: ${(opportunity.contact as any)?.cargo || 'não informado'}

ATIVIDADES RECENTES:
${activities?.map(a => `- ${a.type}: ${a.title} (${a.status})`).join('\n') || 'Nenhuma atividade registrada'}

PLAYBOOKS DISPONÍVEIS:
${matchingPlaybooks.length > 0 
  ? matchingPlaybooks.map(p => `- ${p.name}: ${p.description} (Taxa de sucesso: ${p.success_rate}%)`).join('\n')
  : 'Nenhum playbook específico cadastrado'}

Responda em JSON com:
{
  "recommended_playbook_id": "id do playbook recomendado ou null se sugerir novo",
  "recommendation_reason": "razão da recomendação",
  "suggested_steps": [
    {"order": 1, "action": "ação", "channel": "email|call|meeting|whatsapp", "timing": "quando executar", "script_hint": "dica de script"}
  ],
  "key_talking_points": ["ponto 1", "ponto 2"],
  "objection_handlers": [{"objection": "objeção comum", "response": "resposta sugerida"}],
  "success_probability": número de 0-100
}`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: 'Você é um especialista em vendas B2B. Sugira playbooks e estratégias de abordagem baseadas no contexto.' },
              { role: 'user', content: contextPrompt }
            ],
            temperature: 0.4,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              aiSuggestion = JSON.parse(jsonMatch[0]);
            }
          } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
          }

          // Log AI usage
          await supabase.from('ai_usage_logs').insert({
            organization_id,
            user_id: user.id,
            feature: 'playbooks',
            action: 'suggest_playbook',
            entity_type: 'opportunity',
            entity_id: opportunity_id,
            model_used: 'google/gemini-2.5-flash',
            tokens_input: aiData.usage?.prompt_tokens || 0,
            tokens_output: aiData.usage?.completion_tokens || 0,
            tokens_total: aiData.usage?.total_tokens || 0,
            success: true,
          });
        }
      } catch (aiError) {
        console.error('AI suggestion error:', aiError);
      }
    }

    // Find the recommended playbook if AI suggested one
    let recommendedPlaybook = null;
    if (aiSuggestion?.recommended_playbook_id) {
      recommendedPlaybook = matchingPlaybooks.find(p => p.id === aiSuggestion.recommended_playbook_id);
    }

    return new Response(JSON.stringify({
      success: true,
      opportunity: {
        id: opportunity.id,
        title: opportunity.titulo,
        temperature: opportunity.temperature,
        stage: (opportunity.stage as any)?.name,
      },
      matchingPlaybooks: matchingPlaybooks.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        successRate: p.success_rate,
        usageCount: p.usage_count,
      })),
      recommendedPlaybook,
      aiSuggestion,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-playbook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
