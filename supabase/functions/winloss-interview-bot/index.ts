import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InterviewRequest {
  organizationId: string;
  winLossRecordId?: string;
  opportunityId?: string;
  interviewType: 'win' | 'loss' | 'churn';
  channel: 'whatsapp' | 'audio' | 'voip' | 'form' | 'email';
  contactId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, winLossRecordId, opportunityId, interviewType, channel, contactId } = await req.json() as InterviewRequest;

    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'organizationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[winloss-interview-bot] Starting interview creation for org: ${organizationId}`);

    // Get win/loss record details if provided
    let recordData = null;
    let accountId = null;
    let contactData = null;

    if (winLossRecordId) {
      const { data: record } = await supabase
        .from('win_loss_records')
        .select(`
          *,
          opportunity:opportunities(
            id,
            title,
            account_id,
            contact_id,
            account:accounts(id, razao_social, nome_fantasia),
            contact:contacts(id, nome, emails)
          )
        `)
        .eq('id', winLossRecordId)
        .maybeSingle();
      
      if (record) {
        recordData = record;
        accountId = (record.opportunity as any)?.account_id;
        contactData = (record.opportunity as any)?.contact;
      }
    }

    // Generate dynamic interview questions based on type
    const questions = generateQuestions(interviewType, recordData);

    // Create interview record
    const { data: interview, error: insertError } = await supabase
      .from('winloss_interviews')
      .insert({
        organization_id: organizationId,
        opportunity_id: opportunityId || (recordData?.opportunity as any)?.id,
        account_id: accountId,
        contact_id: contactId || contactData?.id,
        win_loss_record_id: winLossRecordId,
        interview_type: interviewType,
        channel,
        status: 'pending',
        questions,
        scheduled_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('[winloss-interview-bot] Error creating interview:', insertError);
      throw insertError;
    }

    console.log(`[winloss-interview-bot] Interview created: ${interview.id}`);

    // Generate interview message based on channel
    const interviewMessage = generateInterviewMessage(interviewType, channel, contactData);

    // In production, this would integrate with WhatsApp API, email service, etc.
    // For now, we simulate sending
    const { error: updateError } = await supabase
      .from('winloss_interviews')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', interview.id);

    if (updateError) {
      console.error('[winloss-interview-bot] Error updating interview status:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      interview: {
        id: interview.id,
        status: 'sent',
        channel,
        questions,
        message: interviewMessage
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[winloss-interview-bot] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateQuestions(type: 'win' | 'loss' | 'churn', recordData: any): any[] {
  const baseQuestions = [
    {
      id: 'overall_experience',
      question: 'Como você avalia sua experiência geral durante o processo?',
      type: 'scale',
      scale: { min: 1, max: 10 }
    },
    {
      id: 'main_factor',
      question: type === 'win' 
        ? 'Qual foi o fator principal que levou à sua decisão de compra?'
        : 'Qual foi o fator principal que influenciou sua decisão?',
      type: 'text'
    }
  ];

  if (type === 'win') {
    return [
      ...baseQuestions,
      {
        id: 'differentiator',
        question: 'O que nos diferenciou da concorrência?',
        type: 'text'
      },
      {
        id: 'improvement',
        question: 'O que poderíamos ter feito melhor durante o processo?',
        type: 'text'
      },
      {
        id: 'recommend',
        question: 'Você recomendaria nossa solução para outros?',
        type: 'scale',
        scale: { min: 0, max: 10 }
      }
    ];
  } else if (type === 'loss') {
    return [
      ...baseQuestions,
      {
        id: 'competitor',
        question: 'Você optou por outra solução? Se sim, qual?',
        type: 'text'
      },
      {
        id: 'missing_feature',
        question: 'Houve alguma funcionalidade ou característica que sentiu falta?',
        type: 'text'
      },
      {
        id: 'price_factor',
        question: 'O preço foi um fator decisivo na sua escolha?',
        type: 'choice',
        choices: ['Sim, decisivo', 'Parcialmente', 'Não influenciou']
      },
      {
        id: 'reconsider',
        question: 'O que precisaria mudar para você reconsiderar nossa solução no futuro?',
        type: 'text'
      }
    ];
  } else {
    // Churn
    return [
      ...baseQuestions,
      {
        id: 'churn_reason',
        question: 'Qual o principal motivo do cancelamento?',
        type: 'text'
      },
      {
        id: 'usage_frequency',
        question: 'Com que frequência você utilizava nossa solução?',
        type: 'choice',
        choices: ['Diariamente', 'Semanalmente', 'Mensalmente', 'Raramente']
      },
      {
        id: 'support_experience',
        question: 'Como você avalia o suporte recebido?',
        type: 'scale',
        scale: { min: 1, max: 10 }
      },
      {
        id: 'return_possibility',
        question: 'Há possibilidade de retorno no futuro?',
        type: 'choice',
        choices: ['Sim', 'Talvez', 'Não']
      }
    ];
  }
}

function generateInterviewMessage(type: 'win' | 'loss' | 'churn', channel: string, contact: any): string {
  const contactName = contact?.nome?.split(' ')[0] || 'Cliente';
  
  const typeMessages = {
    win: `Olá ${contactName}! 🎉 Ficamos muito felizes com sua escolha. Para continuarmos melhorando, gostaríamos de entender melhor o que contribuiu para sua decisão. Leva apenas 90 segundos!`,
    loss: `Olá ${contactName}! Entendemos que optou por seguir outro caminho. Para melhorarmos nossos processos, gostaríamos de entender sua decisão. Sua opinião é muito valiosa e totalmente confidencial. Leva apenas 90 segundos!`,
    churn: `Olá ${contactName}! Sentimos sua falta. Para melhorarmos, gostaríamos de entender os motivos da sua decisão. Sua resposta é confidencial e nos ajuda muito. Leva apenas 90 segundos!`
  };

  return typeMessages[type];
}
