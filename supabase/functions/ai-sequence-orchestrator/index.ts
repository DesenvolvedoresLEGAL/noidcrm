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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { action, sequenceId, opportunityId, stepContent } = await req.json();

    if (action === 'generate-variations') {
      // Generate AI variations of a message
      if (!lovableApiKey) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: `Você é um especialista em copywriting para vendas B2B. 
              Sua tarefa é criar 3 variações de mensagens para testes A/B.
              As variações devem manter o objetivo principal mas com abordagens diferentes:
              - Variação A: Tom consultivo e educacional
              - Variação B: Tom direto e orientado a valor
              - Variação C: Tom personalizado e storytelling
              
              Retorne um JSON com array de 3 objetos, cada um com: variant (A/B/C), subject (se email), body/message`
            },
            {
              role: 'user',
              content: `Original: ${JSON.stringify(stepContent)}`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_message_variations",
              description: "Create 3 A/B test variations of a sales message",
              parameters: {
                type: "object",
                properties: {
                  variations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        variant: { type: "string", enum: ["A", "B", "C"] },
                        subject: { type: "string" },
                        body: { type: "string" }
                      },
                      required: ["variant", "body"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["variations"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "create_message_variations" } }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Lovable AI error:', response.status, errorText);
        throw new Error(`AI generation failed: ${response.status}`);
      }

      const aiData = await response.json();
      const toolCall = aiData.choices[0].message.tool_calls?.[0];
      const variations = toolCall ? JSON.parse(toolCall.function.arguments).variations : [];

      // Update sequence with variations
      await supabase
        .from('sequences')
        .update({
          ai_variations: variations,
          ai_enabled: true
        })
        .eq('id', sequenceId);

      return new Response(JSON.stringify({ success: true, variations }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check-enrollment') {
      // Check if opportunity should enter sequence based on criteria
      const { data: sequence } = await supabase
        .from('sequences')
        .select('entry_criteria')
        .eq('id', sequenceId)
        .single();

      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('stage_id, temperature, status, created_at, last_contact_date')
        .eq('id', opportunityId)
        .single();

      if (!sequence || !opportunity) {
        throw new Error('Sequence or opportunity not found');
      }

      const criteria = sequence.entry_criteria || {};
      let shouldEnroll = true;
      const reasons: string[] = [];

      // Check stage criteria
      if (criteria.stages && !criteria.stages.includes(opportunity.stage_id)) {
        shouldEnroll = false;
        reasons.push('Stage mismatch');
      }

      // Check temperature criteria
      if (criteria.temperatures && !criteria.temperatures.includes(opportunity.temperature)) {
        shouldEnroll = false;
        reasons.push('Temperature mismatch');
      }

      // Check if already enrolled
      const { data: existing } = await supabase
        .from('sequence_enrollments')
        .select('id')
        .eq('sequence_id', sequenceId)
        .eq('opportunity_id', opportunityId)
        .single();

      if (existing) {
        shouldEnroll = false;
        reasons.push('Already enrolled');
      }

      return new Response(JSON.stringify({ shouldEnroll, reasons }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'enroll') {
      // Enroll opportunity in sequence
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('Not authenticated');

      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', authData.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!memberData) throw new Error('User not in organization');

      // Assign A/B variant
      const variants = ['A', 'B', 'C'];
      const randomVariant = variants[Math.floor(Math.random() * variants.length)];

      const { error } = await supabase
        .from('sequence_enrollments')
        .insert({
          sequence_id: sequenceId,
          opportunity_id: opportunityId,
          organization_id: memberData.organization_id,
          ab_variant: randomVariant,
          status: 'active'
        });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, variant: randomVariant }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check-pause') {
      // Check if sequence should auto-pause based on engagement
      const body = await req.json();
      const { data: enrollment } = await supabase
        .from('sequence_enrollments')
        .select('*, sequences!inner(auto_pause_rules)')
        .eq('id', body.enrollmentId)
        .single();

      if (!enrollment) throw new Error('Enrollment not found');

      const rules = enrollment.sequences.auto_pause_rules || {};
      let shouldPause = false;
      let pauseReason = '';

      // Check for reply
      if (rules.on_reply) {
        const { data: emails } = await supabase
          .from('opportunity_emails')
          .select('id')
          .eq('opportunity_id', enrollment.opportunity_id)
          .gte('sent_at', enrollment.enrolled_at)
          .limit(1);

        if (emails && emails.length > 0) {
          shouldPause = true;
          pauseReason = 'Lead replied to email';
        }
      }

      // Check for meeting booked
      if (rules.on_meeting_booked) {
        const { data: activities } = await supabase
          .from('activities')
          .select('id')
          .eq('opportunity_id', enrollment.opportunity_id)
          .eq('type', 'reuniao')
          .gte('created_at', enrollment.enrolled_at)
          .limit(1);

        if (activities && activities.length > 0) {
          shouldPause = true;
          pauseReason = 'Meeting booked';
        }
      }

      // Check for stage change
      if (rules.on_stage_change) {
        const { data: opportunity } = await supabase
          .from('opportunities')
          .select('stage_id, updated_at')
          .eq('id', enrollment.opportunity_id)
          .single();

        if (opportunity && opportunity.updated_at > enrollment.enrolled_at) {
          shouldPause = true;
          pauseReason = 'Stage changed';
        }
      }

      if (shouldPause) {
        await supabase
          .from('sequence_enrollments')
          .update({
            status: 'paused',
            paused_at: new Date().toISOString(),
            pause_reason: pauseReason
          })
          .eq('id', enrollment.id);
      }

      return new Response(JSON.stringify({ shouldPause, reason: pauseReason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-sequence-orchestrator:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});