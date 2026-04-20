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
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid token');

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('User has no organization');
    }

    const organizationId = profile.organization_id;

    // Find stale opportunities (candidates for cleanup)
    const staleThresholdDays = 45;
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleThresholdDays);

    const { data: staleOpportunities } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(razao_social),
        stage:stages(name),
        activities(id, type, completed_at)
      `)
      .eq('organization_id', organizationId)
      .eq('owner_user_id', user.id)
      .eq('status', 'new')
      .or(`last_contact_date.lt.${staleDate.toISOString()},last_contact_date.is.null`)
      .lt('prob', 30);

    if (!staleOpportunities || staleOpportunities.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Analyze each stale opportunity with AI
    const suggestions = [];

    for (const opp of staleOpportunities.slice(0, 10)) { // Limit to 10 to avoid timeout
      const daysSinceContact = opp.days_since_contact || 999;
      const activityCount = opp.activities?.length || 0;
      
      const prompt = `Analise se esta oportunidade deve ser arquivada ou se vale a pena tentar reativar.

Oportunidade: ${opp.title}
Valor: R$ ${opp.valor_previsto || 0}
Stage: ${opp.stage?.name}
Probabilidade: ${opp.prob}%
Dias sem contato: ${daysSinceContact}
Atividades totais: ${activityCount}
Conta: ${opp.account?.razao_social}

Retorne EXATAMENTE neste formato JSON:
{
  "action": "archive" ou "reactivate",
  "confidence_score": 0.85,
  "reasoning": "explicação clara da decisão"
}`;

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
              content: 'Você é um assistente de CRM especializado em pipeline health e limpeza de deals inativos.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiResponse = JSON.parse(data.choices[0].message.content);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // Expire in 30 days

        const { data: stored } = await supabase
          .from('ai_suggestions')
          .insert({
            organization_id: organizationId,
            user_id: user.id,
            opportunity_id: opp.id,
            suggestion_type: 'pipeline_cleanup',
            entity_type: 'opportunity',
            entity_id: opp.id,
            suggested_value: aiResponse.action,
            confidence_score: aiResponse.confidence_score,
            reasoning: aiResponse.reasoning,
            status: 'pending',
            expires_at: expiresAt.toISOString()
          })
          .select()
          .single();

        if (stored) {
          suggestions.push({
            ...stored,
            opportunity: {
              id: opp.id,
              title: opp.title,
              valor_previsto: opp.valor_previsto,
              days_since_contact: daysSinceContact
            }
          });
        }
      }
    }

    console.log(`Created ${suggestions.length} cleanup suggestions for user ${user.id}`);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in pipeline-cleanup-suggester:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
