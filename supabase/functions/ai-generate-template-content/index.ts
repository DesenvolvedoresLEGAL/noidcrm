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
    const { type, segment, tone, productContext, templateName } = await req.json();

    if (!type || !['introduction', 'terms', 'observations'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const toneDescriptions: Record<string, string> = {
      formal: 'formal e profissional',
      cordial: 'cordial e amigável',
      consultivo: 'consultivo e orientador',
      tecnico: 'técnico e detalhado',
    };

    const toneDesc = toneDescriptions[tone] || 'formal e profissional';

    let prompt = '';
    
    if (type === 'introduction') {
      prompt = `Gere uma introdução profissional para uma proposta comercial em português brasileiro.

Contexto:
- Segmento do cliente: ${segment || 'Geral'}
- Tom: ${toneDesc}
- Produto/Serviço: ${productContext || 'Serviços/Produtos diversos'}
- Nome do template: ${templateName || 'Proposta Comercial'}

Requisitos:
- Use variáveis como {{contato_nome}}, {{cliente_nome_fantasia}}, {{org_nome}} para personalização
- Seja ${toneDesc}
- Máximo 3 parágrafos
- Destaque o valor e benefícios
- Termine com uma frase de abertura para os detalhes da proposta

Gere apenas o texto da introdução, sem títulos ou formatação especial.`;
    } else if (type === 'terms') {
      prompt = `Gere termos e condições padrão para uma proposta comercial em português brasileiro.

Contexto:
- Segmento: ${segment || 'Geral'}
- Produto/Serviço: ${productContext || 'Serviços/Produtos diversos'}

Requisitos:
- Liste de 8 a 12 itens numerados
- Inclua: validade da proposta (use {{proposta_validade}}), forma de pagamento, prazo de entrega, garantias, suporte, cancelamento
- Linguagem clara e objetiva
- Proteja tanto vendedor quanto comprador
- Use variáveis como {{proposta_validade}}, {{org_nome}} quando apropriado

Gere apenas a lista de termos numerados.`;
    } else if (type === 'observations') {
      prompt = `Gere observações e notas úteis para uma proposta comercial em português brasileiro.

Contexto:
- Segmento: ${segment || 'Geral'}  
- Produto/Serviço: ${productContext || 'Serviços/Produtos diversos'}
- Tom: ${toneDesc}

Requisitos:
- 3 a 5 observações importantes
- Informações que agregam valor ao cliente
- Dicas de uso ou implementação
- Diferenciais competitivos
- Próximos passos sugeridos

Gere apenas as observações em formato de lista com bullets.`;
    }

    // Call Lovable AI
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em copywriting comercial brasileiro. Gere textos profissionais, persuasivos e adequados para propostas comerciais B2B. Sempre responda em português brasileiro.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      throw new Error('Failed to generate content');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate content' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
