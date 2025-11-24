import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

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
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { opportunityId } = await req.json();

    // Get opportunity data with related info
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        stages!inner(id, name, order_index),
        pipelines!inner(id, name)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError || !opportunity) {
      throw new Error('Opportunity not found');
    }

    // Get recent activities
    const { data: activities } = await supabase
      .from('activities')
      .select('type, status, completed_at, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent emails
    const { data: emails } = await supabase
      .from('opportunity_emails')
      .select('sent_at, opened_at, clicked_at')
      .eq('opportunity_id', opportunityId)
      .order('sent_at', { ascending: false })
      .limit(5);

    // Get proposals
    const { data: proposals } = await supabase
      .from('proposals')
      .select('status, sent_at, viewed_at')
      .eq('opportunity_id', opportunityId)
      .order('sent_at', { ascending: false })
      .limit(3);

    // Get next stages
    const { data: nextStages } = await supabase
      .from('stages')
      .select('id, name, order_index')
      .eq('pipeline_id', opportunity.pipeline_id)
      .gt('order_index', opportunity.stages.order_index)
      .order('order_index', { ascending: true })
      .limit(3);

    if (!nextStages || nextStages.length === 0) {
      return new Response(JSON.stringify({ 
        suggestion: null, 
        message: 'Opportunity is in final stage' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context for AI
    const context = {
      opportunity: {
        title: opportunity.title,
        current_stage: opportunity.stages.name,
        value: opportunity.valor_previsto,
        probability: opportunity.prob,
        temperature: opportunity.temperature,
        days_since_contact: opportunity.days_since_contact,
        created_at: opportunity.created_at
      },
      recent_activities: activities?.map(a => ({
        type: a.type,
        status: a.status,
        days_ago: Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
      })),
      email_engagement: {
        total_sent: emails?.length || 0,
        opened: emails?.filter(e => e.opened_at).length || 0,
        clicked: emails?.filter(e => e.clicked_at).length || 0
      },
      proposals: proposals?.map(p => ({
        status: p.status,
        sent: !!p.sent_at,
        viewed: !!p.viewed_at
      })),
      next_stages: nextStages.map(s => ({ id: s.id, name: s.name }))
    };

    // Call AI to analyze
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
            content: `Você é um especialista em gestão de pipeline de vendas B2B.
            Analise o contexto da oportunidade e determine se ela deve avançar para o próximo estágio.
            
            Critérios para sugerir avanço:
            - Atividades recentes concluídas (reuniões, demos)
            - Engajamento positivo (emails abertos, links clicados)
            - Proposta enviada e visualizada
            - Tempo adequado no estágio atual
            - Temperatura indicando interesse
            
            Retorne análise em JSON com: should_progress (boolean), suggested_stage_id, confidence_score (0-1), reasoning`
          },
          {
            role: 'user',
            content: `Analise esta oportunidade:\n${JSON.stringify(context, null, 2)}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_stage_progression",
            description: "Analyze if opportunity should progress to next stage",
            parameters: {
              type: "object",
              properties: {
                should_progress: { type: "boolean" },
                suggested_stage_id: { type: "string" },
                confidence_score: { type: "number", minimum: 0, maximum: 1 },
                reasoning: { type: "string" }
              },
              required: ["should_progress", "confidence_score", "reasoning"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_stage_progression" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    const analysis = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!analysis || !analysis.should_progress) {
      return new Response(JSON.stringify({ suggestion: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Not authenticated');

    const { data: memberData } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!memberData) throw new Error('User not in organization');

    // Create suggestion
    const { data: suggestion, error: suggestionError } = await supabase
      .from('stage_progression_suggestions')
      .insert({
        opportunity_id: opportunityId,
        organization_id: memberData.organization_id,
        current_stage_id: opportunity.stage_id,
        suggested_stage_id: analysis.suggested_stage_id,
        confidence_score: analysis.confidence_score,
        reasoning: analysis.reasoning
      })
      .select()
      .single();

    if (suggestionError) throw suggestionError;

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in stage-progression-detector:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});