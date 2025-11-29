import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

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

    const { accountName, segment, product, value, clientName } = await req.json();

    console.log('Generating introduction for:', { accountName, segment, product, value });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Gere uma introdução profissional e persuasiva para uma proposta comercial com as seguintes informações:

Cliente: ${clientName || accountName}
Segmento: ${segment || 'não especificado'}
Produto/Serviço: ${product || 'não especificado'}
Valor: ${value ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'não especificado'}

A introdução deve:
- Ser profissional e objetiva (máximo 3 parágrafos)
- Demonstrar compreensão do negócio do cliente
- Destacar o valor da solução proposta
- Criar conexão emocional com os desafios do cliente
- Usar tom consultivo e focado em resultados
- Estar em português brasileiro (pt-BR)

Responda APENAS com a introdução em texto, sem títulos ou formatação markdown.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
