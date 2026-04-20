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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      accountName, 
      segment, 
      product, 
      value, 
      clientName,
      companySize,
      city,
      state,
      cnae,
      contactRole,
      opportunityStage 
    } = await req.json();

    console.log('Generating introduction for:', { accountName, segment, product, value, companySize, city });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build rich context for AI
    const contextParts: string[] = [];
    contextParts.push(`Empresa: ${clientName || accountName}`);
    if (segment) contextParts.push(`Segmento de atuação: ${segment}`);
    if (companySize) contextParts.push(`Porte da empresa: ${companySize}`);
    if (city && state) contextParts.push(`Localização: ${city}/${state}`);
    if (cnae) contextParts.push(`CNAE/Atividade principal: ${cnae}`);
    if (contactRole) contextParts.push(`Cargo do contato: ${contactRole}`);
    if (product) contextParts.push(`Produto/Serviço oferecido: ${product}`);
    if (value) contextParts.push(`Valor da proposta: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    if (opportunityStage) contextParts.push(`Estágio do funil: ${opportunityStage}`);

    const prompt = `Você é um especialista em vendas B2B e criação de propostas comerciais persuasivas.

Com base nas informações do cliente abaixo, gere uma introdução profissional e personalizada para uma proposta comercial.

INFORMAÇÕES DO CLIENTE:
${contextParts.join('\n')}

DIRETRIZES PARA A INTRODUÇÃO:
- Máximo 3 parágrafos curtos e objetivos
- Personalize com base no segmento, porte e localização do cliente
- Demonstre compreensão dos desafios típicos do setor/segmento
- Destaque o valor da solução proposta de forma consultiva
- Use tom profissional mas acolhedor
- NÃO inclua valores monetários na introdução
- Texto em português brasileiro (pt-BR)

Responda APENAS com a introdução em texto corrido, sem títulos, bullet points ou formatação markdown.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'Você é um especialista em vendas B2B e criação de propostas comerciais persuasivas.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('Failed to generate introduction');
    }

    const aiData = await aiResponse.json();
    const introduction = aiData.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ introduction }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in ai-generate-proposal-intro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao gerar introdução' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
