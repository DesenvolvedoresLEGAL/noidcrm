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
    const { opportunityId, context, emailType, previousEmail } = await req.json();
    
    if (!opportunityId) {
      throw new Error('opportunityId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados da oportunidade
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(*),
        contact:contacts(*)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError) throw oppError;

    // Buscar emails anteriores
    const { data: emails } = await supabase
      .from('opportunity_emails')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('sent_at', { ascending: false })
      .limit(5);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const emailContext = previousEmail ? `Email anterior do cliente:\n${previousEmail}\n\n` : '';
    const userContext = context ? `Contexto adicional: ${context}\n\n` : '';

    const prompt = `Gere um email profissional de vendas B2B para esta oportunidade.

Tipo de email: ${emailType || 'follow-up'}
${emailContext}${userContext}
Dados da Oportunidade:
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || 0}
- Status: ${opportunity.status}

Destinatário:
- Nome: ${opportunity.contact?.nome || 'Cliente'}
- Cargo: ${opportunity.contact?.cargo || ''}
- Empresa: ${opportunity.account?.razao_social}

Histórico de emails: ${emails?.length || 0} emails anteriores

Retorne EXATAMENTE neste formato JSON:
{
  "subject": "<assunto do email>",
  "body": "<corpo do email em HTML formatado>",
  "tone": "<professional|friendly|formal>",
  "cta": "<call to action principal>",
  "alternatives": [
    {
      "subject": "<assunto alternativo>",
      "body": "<corpo alternativo>"
    }
  ]
}

Diretrizes:
- Seja conciso e direto
- Inclua um CTA claro
- Personalize com informações da empresa
- Mantenha tom profissional mas amigável
- Use HTML simples para formatação (p, strong, ul, li)`;

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
            content: 'Você é um especialista em copywriting de vendas B2B. Escreva emails persuasivos e profissionais.'
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

    console.log('AI Email generated:', aiResponse);

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-email-assist:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
