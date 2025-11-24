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
    const tasksCreated: any[] = [];

    // Rule 1: Create follow-up tasks for opportunities without recent contact
    const { data: staleOpportunities } = await supabase
      .from('opportunities')
      .select('id, title, days_since_contact, valor_previsto')
      .eq('organization_id', organizationId)
      .eq('owner_user_id', user.id)
      .eq('status', 'new')
      .gt('days_since_contact', 3);

    if (staleOpportunities && staleOpportunities.length > 0) {
      for (const opp of staleOpportunities) {
        // Check if task already exists
        const { data: existingTask } = await supabase
          .from('activities')
          .select('id')
          .eq('opportunity_id', opp.id)
          .eq('status', 'scheduled')
          .eq('type', 'call')
          .single();

        if (!existingTask) {
          const { data: task } = await supabase
            .from('activities')
            .insert({
              organization_id: organizationId,
              owner_user_id: user.id,
              opportunity_id: opp.id,
              title: `Follow-up: ${opp.title}`,
              type: 'call',
              status: 'scheduled',
              scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              description: `Oportunidade sem contato há ${opp.days_since_contact} dias. Fazer follow-up urgente.`,
              ai_generated: true
            })
            .select()
            .single();

          if (task) tasksCreated.push(task);
        }
      }
    }

    // Rule 2: Create meeting prep tasks for upcoming meetings
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const { data: upcomingMeetings } = await supabase
      .from('activities')
      .select('id, title, opportunity_id, scheduled_date')
      .eq('organization_id', organizationId)
      .eq('owner_user_id', user.id)
      .eq('type', 'meeting')
      .eq('status', 'scheduled')
      .gte('scheduled_date', new Date().toISOString())
      .lte('scheduled_date', tomorrow.toISOString());

    if (upcomingMeetings && upcomingMeetings.length > 0) {
      for (const meeting of upcomingMeetings) {
        // Check if prep task already exists
        const { data: existingPrep } = await supabase
          .from('activities')
          .select('id')
          .eq('opportunity_id', meeting.opportunity_id)
          .eq('status', 'scheduled')
          .ilike('title', '%Preparar reunião%')
          .single();

        if (!existingPrep) {
          const meetingDate = new Date(meeting.scheduled_date);
          const prepDate = new Date(meetingDate);
          prepDate.setHours(prepDate.getHours() - 2); // 2 hours before meeting

          const { data: task } = await supabase
            .from('activities')
            .insert({
              organization_id: organizationId,
              owner_user_id: user.id,
              opportunity_id: meeting.opportunity_id,
              title: `Preparar reunião: ${meeting.title}`,
              type: 'task',
              status: 'scheduled',
              scheduled_date: prepDate.toISOString(),
              description: 'Revisar histórico, preparar pontos de discussão e materiais.',
              ai_generated: true
            })
            .select()
            .single();

          if (task) tasksCreated.push(task);
        }
      }
    }

    // Rule 3: Create proposal tasks for opportunities in negotiation stage
    const { data: negotiationOpps } = await supabase
      .from('opportunities')
      .select(`
        id, 
        title, 
        stage:stages!inner(name)
      `)
      .eq('organization_id', organizationId)
      .eq('owner_user_id', user.id)
      .eq('status', 'new')
      .ilike('stages.name', '%negociação%');

    if (negotiationOpps && negotiationOpps.length > 0) {
      for (const opp of negotiationOpps) {
        // Check if there's already a proposal or task for it
        const { data: existingProposal } = await supabase
          .from('proposals')
          .select('id')
          .eq('opportunity_id', opp.id)
          .single();

        const { data: existingTask } = await supabase
          .from('activities')
          .select('id')
          .eq('opportunity_id', opp.id)
          .eq('status', 'scheduled')
          .ilike('title', '%proposta%')
          .single();

        if (!existingProposal && !existingTask) {
          const { data: task } = await supabase
            .from('activities')
            .insert({
              organization_id: organizationId,
              owner_user_id: user.id,
              opportunity_id: opp.id,
              title: `Enviar proposta comercial: ${opp.title}`,
              type: 'task',
              status: 'scheduled',
              scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              description: 'Criar e enviar proposta comercial formal.',
              ai_generated: true
            })
            .select()
            .single();

          if (task) tasksCreated.push(task);
        }
      }
    }

    console.log(`Auto-created ${tasksCreated.length} tasks for user ${user.id}`);

    return new Response(JSON.stringify({
      success: true,
      tasks_created: tasksCreated.length,
      tasks: tasksCreated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in auto-task-creator:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
