import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal secret for CRON calls
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!expectedSecret || internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[run-autonomous-sequences] Starting sequence processing...');

    // Get all active enrollments that need processing
    const { data: enrollments, error: enrollError } = await supabase
      .from('sequence_enrollments')
      .select(`
        *,
        sequences!inner(*),
        opportunities!inner(
          *,
          accounts(*),
          contacts(*)
        )
      `)
      .eq('status', 'active')
      .lte('next_step_at', new Date().toISOString())
      .limit(50);

    if (enrollError) {
      console.error('[run-autonomous-sequences] Error fetching enrollments:', enrollError);
      throw enrollError;
    }

    console.log(`[run-autonomous-sequences] Found ${enrollments?.length || 0} enrollments to process`);

    let processed = 0;
    let paused = 0;
    let escalated = 0;

    for (const enrollment of enrollments || []) {
      try {
        const sequence = enrollment.sequences;
        const opportunity = enrollment.opportunities;
        const account = opportunity?.accounts;
        const contact = opportunity?.contacts;

        // Check auto-pause conditions
        const shouldPause = await checkAutoPause(supabase, enrollment, opportunity);
        if (shouldPause.pause) {
          await supabase
            .from('sequence_enrollments')
            .update({ 
              status: 'paused',
              paused_reason: shouldPause.reason,
              paused_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);
          
          paused++;
          console.log(`[run-autonomous-sequences] Paused enrollment ${enrollment.id}: ${shouldPause.reason}`);
          continue;
        }

        // Check escalation conditions
        const shouldEscalate = await checkEscalation(supabase, enrollment, sequence);
        if (shouldEscalate.escalate && shouldEscalate.reason) {
          await escalateToHuman(supabase, enrollment, opportunity, shouldEscalate.reason);
          escalated++;
          continue;
        }

        // Get sequence steps
        const { data: steps } = await supabase
          .from('sequence_steps')
          .select('*')
          .eq('sequence_id', sequence.id)
          .order('step_order', { ascending: true });

        if (!steps || steps.length === 0) {
          console.log(`[run-autonomous-sequences] No steps found for sequence ${sequence.id}`);
          continue;
        }

        const currentStep = steps[enrollment.current_step];
        if (!currentStep) {
          // Sequence completed
          await supabase
            .from('sequence_enrollments')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);
          continue;
        }

        // Execute step based on action type
        let stepExecuted = false;

        if (currentStep.action_type === 'email' && contact?.emails?.[0]) {
          stepExecuted = await executeEmailStep(
            supabase,
            lovableApiKey,
            currentStep,
            enrollment,
            opportunity,
            account,
            contact
          );
        } else if (currentStep.action_type === 'task') {
          stepExecuted = await executeTaskStep(
            supabase,
            currentStep,
            enrollment,
            opportunity
          );
        } else if (currentStep.action_type === 'wait') {
          stepExecuted = true; // Wait steps just advance
        }

        if (stepExecuted) {
          // Calculate next step timing
          const nextStepIndex = enrollment.current_step + 1;
          const nextStep = steps[nextStepIndex];
          
          let nextStepAt = null;
          if (nextStep) {
            const delayDays = nextStep.delay_days || 1;
            nextStepAt = new Date();
            nextStepAt.setDate(nextStepAt.getDate() + delayDays);
          }

          await supabase
            .from('sequence_enrollments')
            .update({
              current_step: nextStepIndex,
              last_step_at: new Date().toISOString(),
              next_step_at: nextStepAt?.toISOString(),
              total_steps_executed: (enrollment.total_steps_executed || 0) + 1,
            })
            .eq('id', enrollment.id);

          // Update opportunity last contact
          await supabase
            .from('opportunities')
            .update({ last_contact_date: new Date().toISOString() })
            .eq('id', opportunity.id);

          processed++;
        }

      } catch (stepError) {
        console.error(`[run-autonomous-sequences] Error processing enrollment ${enrollment.id}:`, stepError);
      }
    }

    console.log(`[run-autonomous-sequences] Completed - Processed: ${processed}, Paused: ${paused}, Escalated: ${escalated}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        paused,
        escalated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[run-autonomous-sequences] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkAutoPause(supabase: any, enrollment: any, opportunity: any): Promise<{ pause: boolean; reason?: string }> {
  // Check if lead replied (has recent inbound activity)
  const { data: recentActivity } = await supabase
    .from('activities')
    .select('id')
    .eq('opportunity_id', opportunity.id)
    .eq('type', 'email_received')
    .gte('created_at', enrollment.enrolled_at)
    .limit(1)
    .maybeSingle();

  if (recentActivity) {
    return { pause: true, reason: 'lead_replied' };
  }

  // Check if meeting booked
  const { data: meetingBooked } = await supabase
    .from('activities')
    .select('id')
    .eq('opportunity_id', opportunity.id)
    .eq('type', 'meeting')
    .gte('created_at', enrollment.enrolled_at)
    .limit(1)
    .maybeSingle();

  if (meetingBooked) {
    return { pause: true, reason: 'meeting_booked' };
  }

  // Check if opportunity status changed
  if (opportunity.status === 'won' || opportunity.status === 'lost') {
    return { pause: true, reason: `opportunity_${opportunity.status}` };
  }

  return { pause: false };
}

async function checkEscalation(supabase: any, enrollment: any, sequence: any): Promise<{ escalate: boolean; reason?: string }> {
  const maxStepsBeforeEscalation = sequence.escalation_after_steps || 5;
  const maxDaysBeforeEscalation = sequence.escalation_after_days || 14;

  // Check steps threshold
  if ((enrollment.total_steps_executed || 0) >= maxStepsBeforeEscalation) {
    return { escalate: true, reason: 'max_steps_reached' };
  }

  // Check days threshold
  const enrolledDate = new Date(enrollment.enrolled_at);
  const daysSinceEnrollment = Math.floor((Date.now() - enrolledDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceEnrollment >= maxDaysBeforeEscalation) {
    return { escalate: true, reason: 'max_days_reached' };
  }

  return { escalate: false };
}

async function escalateToHuman(supabase: any, enrollment: any, opportunity: any, reason: string) {
  // Create notification for owner
  await supabase
    .from('notifications')
    .insert({
      organization_id: opportunity.organization_id,
      user_id: opportunity.owner_user_id,
      type: 'sequence_escalation',
      title: 'Sequência requer atenção humana',
      message: `A sequência para "${opportunity.title}" foi escalada. Motivo: ${reason}`,
      metadata: {
        opportunity_id: opportunity.id,
        enrollment_id: enrollment.id,
        reason,
      },
    });

  // Create high-priority task
  await supabase
    .from('activities')
    .insert({
      organization_id: opportunity.organization_id,
      owner_user_id: opportunity.owner_user_id,
      opportunity_id: opportunity.id,
      account_id: opportunity.account_id,
      type: 'task',
      title: `[URGENTE] Sequência escalada: ${opportunity.title}`,
      description: `Esta oportunidade passou por ${enrollment.total_steps_executed || 0} passos de sequência sem resposta. Motivo da escalação: ${reason}. Por favor, faça um contato manual.`,
      status: 'pending',
      scheduled_date: new Date().toISOString(),
    });

  // Update enrollment
  await supabase
    .from('sequence_enrollments')
    .update({
      status: 'escalated',
      escalated_at: new Date().toISOString(),
      escalation_reason: reason,
    })
    .eq('id', enrollment.id);
}

async function executeEmailStep(
  supabase: any,
  lovableApiKey: string | undefined,
  step: any,
  enrollment: any,
  opportunity: any,
  account: any,
  contact: any
): Promise<boolean> {
  try {
    // Generate personalized email content using AI
    let emailContent = step.content || '';
    let emailSubject = step.subject || 'Follow-up';

    if (lovableApiKey && step.use_ai_personalization) {
      const aiPrompt = `Gere um email de follow-up profissional e personalizado para:
      
Empresa: ${account?.nome_fantasia || account?.razao_social || 'Cliente'}
Contato: ${contact?.nome || 'Prezado(a)'}
Cargo: ${contact?.cargo || 'Decisor'}
Segmento: ${account?.segmento || 'Geral'}
Contexto: ${step.ai_context || 'Follow-up de oportunidade comercial'}
Número do follow-up: ${(enrollment.total_steps_executed || 0) + 1}

Escreva apenas o corpo do email, sem assunto. Seja breve, objetivo e profissional.
Use um tom ${enrollment.total_steps_executed > 2 ? 'mais urgente' : 'amigável'}.`;

      try {
        const aiResponse = await fetch('https://api.lovable.dev/api/v1/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [{ role: 'user', content: aiPrompt }],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          emailContent = aiData.choices?.[0]?.message?.content || emailContent;
        }
      } catch (aiError) {
        console.error('[run-autonomous-sequences] AI generation error:', aiError);
      }
    }

    // Log the email activity (actual sending would be via email provider)
    await supabase
      .from('activities')
      .insert({
        organization_id: opportunity.organization_id,
        owner_user_id: opportunity.owner_user_id,
        opportunity_id: opportunity.id,
        account_id: opportunity.account_id,
        contact_id: contact?.id,
        type: 'email',
        title: `[Auto] ${emailSubject}`,
        description: emailContent,
        status: 'completed',
        completed_at: new Date().toISOString(),
        is_automated: true,
        ai_generated: step.use_ai_personalization || false,
      });

    // Log automation
    await supabase
      .from('automation_logs')
      .insert({
        opportunity_id: opportunity.id,
        action_type: 'sequence_email',
        status: 'completed',
        message_content: emailContent,
        channel: 'email',
        ai_context: step.ai_context,
        completed_at: new Date().toISOString(),
        metadata: {
          sequence_id: enrollment.sequence_id,
          step_order: step.step_order,
          subject: emailSubject,
        },
      });

    console.log(`[run-autonomous-sequences] Email step executed for opportunity ${opportunity.id}`);
    return true;

  } catch (error) {
    console.error('[run-autonomous-sequences] Email step error:', error);
    return false;
  }
}

async function executeTaskStep(
  supabase: any,
  step: any,
  enrollment: any,
  opportunity: any
): Promise<boolean> {
  try {
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + (step.task_due_days || 0));

    await supabase
      .from('activities')
      .insert({
        organization_id: opportunity.organization_id,
        owner_user_id: opportunity.owner_user_id,
        opportunity_id: opportunity.id,
        account_id: opportunity.account_id,
        type: 'task',
        title: step.task_title || `[Sequência] Tarefa de acompanhamento`,
        description: step.task_description || step.content,
        status: 'pending',
        scheduled_date: scheduledDate.toISOString(),
        is_automated: true,
      });

    // Notify owner
    await supabase
      .from('notifications')
      .insert({
        organization_id: opportunity.organization_id,
        user_id: opportunity.owner_user_id,
        type: 'sequence_task',
        title: 'Nova tarefa da sequência',
        message: `Uma tarefa foi criada automaticamente: ${step.task_title || 'Acompanhamento'}`,
        metadata: {
          opportunity_id: opportunity.id,
          sequence_id: enrollment.sequence_id,
        },
      });

    console.log(`[run-autonomous-sequences] Task step executed for opportunity ${opportunity.id}`);
    return true;

  } catch (error) {
    console.error('[run-autonomous-sequences] Task step error:', error);
    return false;
  }
}
