import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { opportunityId, channel, context } = await req.json();

    if (!opportunityId || !channel) {
      throw new Error('opportunityId and channel are required');
    }

    console.log(`Generating ${channel} message for opportunity ${opportunityId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar dados da oportunidade
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(nome_fantasia, razao_social, segmento),
        contact:contacts(nome)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError) throw oppError;
    if (!opportunity) throw new Error('Opportunity not found');

    // Buscar última atividade
    const { data: lastActivity } = await supabase
      .from('activities')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Construir prompts
    const systemPrompt = channel === 'whatsapp' 
      ? `Você é um assistente de vendas especializado em ${opportunity.produto || 'soluções tecnológicas'}.
Seu objetivo é manter leads engajados através de follow-ups amigáveis e profissionais via WhatsApp.

Tom: informal, amigável e consultivo
Limite: 2-3 linhas curtas (máximo 40 palavras)
Formato: Mensagem de WhatsApp sem saudação excessiva

IMPORTANTE:
- NUNCA mencione que é uma mensagem automatizada
- Seja natural e humano
- Foque no valor para o cliente
- Inclua um call-to-action claro mas suave
- Use emojis com moderação (máximo 1-2)`
      : `Você é um assistente de vendas especializado em ${opportunity.produto || 'soluções tecnológicas'}.
Seu objetivo é manter leads engajados através de follow-ups profissionais via email.

Tom: profissional mas acessível
Limite: 2 parágrafos curtos
Formato: Email com assunto e corpo

IMPORTANTE:
- NUNCA mencione que é uma mensagem automatizada
- Seja consultivo e focado no cliente
- Mostre valor e benefícios
- Inclua call-to-action claro
- Assunto: máximo 50 caracteres`;

    const accountName = opportunity.account?.nome_fantasia || opportunity.account?.razao_social || 'cliente';
    const contactName = opportunity.contact?.nome || '';
    const daysSinceContact = opportunity.days_since_contact || 0;

    const userPrompt = `
Cliente: ${accountName}
${contactName ? `Contato: ${contactName}` : ''}
Produto/Interesse: ${opportunity.produto || 'produto'}
Etapa: ${opportunity.stage_id || 'inicial'}
Última interação: ${lastActivity ? `${daysSinceContact} dias atrás - ${lastActivity.title}` : `${daysSinceContact} dias atrás`}
Temperatura: ${opportunity.temperature || 'warm'} (${opportunity.urgency_score || 50}/100)
Probabilidade: ${opportunity.prob || 50}%
${context ? `Contexto adicional: ${context}` : ''}

${lastActivity?.description ? `Notas da última interação:\n${lastActivity.description}\n` : ''}

Crie uma mensagem de follow-up contextualizada e personalizada.
${channel === 'email' ? 'Retorne no formato JSON: { "subject": "...", "body": "..." }' : ''}
`;

    console.log('Calling Lovable AI...');

    // Chamar Lovable AI
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const generatedMessage = aiData.choices[0].message.content;

    console.log('Message generated successfully');

    // Parse email format if needed
    let result;
    if (channel === 'email') {
      try {
        // Tentar parsear JSON
        const parsed = JSON.parse(generatedMessage);
        result = {
          subject: parsed.subject,
          body: parsed.body,
        };
      } catch {
        // Se não for JSON, tentar extrair manualmente
        const lines = generatedMessage.split('\n');
        const subjectLine = lines.find((l: string) => l.toLowerCase().includes('assunto:') || l.toLowerCase().includes('subject:'));
        result = {
          subject: subjectLine ? subjectLine.split(':')[1].trim() : 'Follow-up',
          body: generatedMessage,
        };
      }
    } else {
      result = {
        message: generatedMessage,
      };
    }

    // Registrar geração no log
    await supabase.from('automation_logs').insert({
      opportunity_id: opportunityId,
      action_type: `${channel}_sent`,
      channel: channel,
      message_content: generatedMessage,
      ai_context: userPrompt,
      status: 'pending',
      metadata: { 
        generated_at: new Date().toISOString(),
        model: 'google/gemini-2.5-flash',
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        metadata: {
          opportunityId,
          channel,
          temperature: opportunity.temperature,
          urgencyScore: opportunity.urgency_score,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in ai-generate-message:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
