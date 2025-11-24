import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const today = new Date().toISOString().split('T')[0];

    // Check if briefing already exists for today
    const { data: existing } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('briefing_date', today)
      .single();

    if (existing) {
      return new Response(JSON.stringify(existing), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user's opportunities
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(razao_social),
        contact:contacts(nome),
        stage:stages(name)
      `)
      .eq('organization_id', organizationId)
      .eq('owner_user_id', user.id)
      .eq('status', 'new')
      .order('urgency_score', { ascending: false });

    // Fetch recent activities
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('owner_user_id', user.id)
      .eq('status', 'scheduled')
      .gte('scheduled_date', new Date().toISOString())
      .lte('scheduled_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('scheduled_date', { ascending: true });

    // Analyze opportunities
    const hotOpportunities = opportunities?.filter(o => 
      (o.temperature === 'burning' || o.temperature === 'hot') && 
      o.valor_previsto && o.valor_previsto > 0
    ).slice(0, 5) || [];

    const atRiskDeals = opportunities?.filter(o => 
      o.days_since_contact > 5 && 
      o.valor_previsto && o.valor_previsto > 10000
    ).slice(0, 5) || [];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Generate AI briefing
    const prompt = `Você é um assistente de vendas. Gere um briefing diário conciso para o vendedor com base nos dados abaixo.

Oportunidades Quentes (${hotOpportunities.length}):
${hotOpportunities.map(o => `- ${o.title}: R$ ${o.valor_previsto}, ${o.stage?.name}, temperatura: ${o.temperature}`).join('\n')}

Deals em Risco (${atRiskDeals.length}):
${atRiskDeals.map(o => `- ${o.title}: R$ ${o.valor_previsto}, sem contato há ${o.days_since_contact} dias`).join('\n')}

Atividades Agendadas (${activities?.length || 0}):
${activities?.slice(0, 5).map(a => `- ${a.title}: ${new Date(a.scheduled_date).toLocaleDateString('pt-BR')}`).join('\n') || 'Nenhuma'}

Retorne EXATAMENTE neste formato JSON:
{
  "priority_actions": [
    {
      "action": "descrição da ação",
      "opportunity_id": "uuid ou null",
      "priority": "high|medium|low",
      "reason": "motivo da prioridade"
    }
  ],
  "summary": "resumo do dia em 2-3 linhas"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de vendas especializado em priorização e planejamento diário.'
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
    const aiResponse = JSON.parse(data.choices[0].message.content);

    // Create briefing record
    const { data: briefing, error: briefingError } = await supabase
      .from('daily_briefings')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        briefing_date: today,
        priority_actions: aiResponse.priority_actions || [],
        hot_opportunities: hotOpportunities.map(o => ({
          id: o.id,
          title: o.title,
          value: o.valor_previsto,
          temperature: o.temperature
        })),
        at_risk_deals: atRiskDeals.map(o => ({
          id: o.id,
          title: o.title,
          value: o.valor_previsto,
          days_since_contact: o.days_since_contact
        })),
        summary: aiResponse.summary,
        tasks_created: 0
      })
      .select()
      .single();

    if (briefingError) throw briefingError;

    console.log('Daily briefing created:', briefing.id);

    return new Response(JSON.stringify(briefing), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in daily-briefing-generator:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
