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
    const rulesApplied: string[] = [];

    // Fetch active rules for the organization
    const { data: rules } = await supabase
      .from('auto_tasks_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    console.log(`[auto-task-creator] Found ${rules?.length || 0} active rules for org ${organizationId}`);

    // =============================================
    // RULE 1: Stale Opportunities (no recent contact)
    // =============================================
    const staleRule = rules?.find(r => r.rule_type === 'stale_opportunity');
    if (staleRule) {
      const daysThreshold = staleRule.trigger_conditions?.days_without_contact || 3;
      
      const { data: staleOpportunities } = await supabase
        .from('opportunities')
        .select(`
          id, title, days_in_stage,
          account:accounts(nome_fantasia, razao_social)
        `)
        .eq('organization_id', organizationId)
        .eq('owner_user_id', user.id)
        .in('status', ['open', 'in_progress', 'new'])
        .gt('days_in_stage', daysThreshold);

      if (staleOpportunities && staleOpportunities.length > 0) {
        for (const opp of staleOpportunities) {
          // Check if task already exists
          const { data: existingTask } = await supabase
            .from('activities')
            .select('id')
            .eq('opportunity_id', opp.id)
            .eq('status', 'scheduled')
            .ilike('title', '%Follow-up%')
            .maybeSingle();

          if (!existingTask) {
            const taskTemplate = staleRule.task_template || {};
            const title = (taskTemplate.title_pattern || 'Follow-up: {opportunity_title}')
              .replace('{opportunity_title}', opp.title)
              .replace('{days}', String(opp.days_in_stage || daysThreshold));
            
            const { data: task } = await supabase
              .from('activities')
              .insert({
                organization_id: organizationId,
                owner_user_id: user.id,
                opportunity_id: opp.id,
                title,
                type: taskTemplate.type || 'call',
                status: 'scheduled',
                scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                description: (taskTemplate.description || 'Oportunidade sem contato. Fazer follow-up urgente.')
                  .replace('{days}', String(opp.days_in_stage || daysThreshold)),
                ai_generated: true
              })
              .select()
              .single();

            if (task) tasksCreated.push(task);
          }
        }
        rulesApplied.push('stale_opportunity');
      }
    }

    // =============================================
    // RULE 2: High Score Leads (A/B grade without activity)
    // =============================================
    const highScoreRule = rules?.find(r => r.rule_type === 'high_score_lead');
    if (highScoreRule) {
      const conditions = highScoreRule.trigger_conditions || {};
      const minScore = conditions.min_lead_score || 70;
      const targetGrades = conditions.lead_grades || ['A', 'B'];

      // Find opportunities with high-score accounts but no recent activity
      const { data: highScoreOpps } = await supabase
        .from('opportunities')
        .select(`
          id, title, created_at,
          account:accounts!inner(id, nome_fantasia, razao_social, lead_score, lead_grade)
        `)
        .eq('organization_id', organizationId)
        .eq('owner_user_id', user.id)
        .in('status', ['open', 'in_progress', 'new'])
        .gte('accounts.lead_score', minScore);

      if (highScoreOpps && highScoreOpps.length > 0) {
        for (const opp of highScoreOpps) {
          const account = opp.account as any;
          if (!targetGrades.includes(account?.lead_grade)) continue;

          // Check if there's any activity for this opportunity
          const { count: activityCount } = await supabase
            .from('activities')
            .select('id', { count: 'exact', head: true })
            .eq('opportunity_id', opp.id);

          if (activityCount === 0 || conditions.no_activity) {
            // Check if priority task already exists
            const { data: existingTask } = await supabase
              .from('activities')
              .select('id')
              .eq('opportunity_id', opp.id)
              .eq('status', 'scheduled')
              .ilike('title', '%prioritário%')
              .maybeSingle();

            if (!existingTask) {
              const taskTemplate = highScoreRule.task_template || {};
              const accountName = account?.nome_fantasia || account?.razao_social || 'Lead';
              const title = (taskTemplate.title_pattern || 'Contato prioritário: {account_name}')
                .replace('{account_name}', accountName)
                .replace('{opportunity_title}', opp.title);

              const { data: task } = await supabase
                .from('activities')
                .insert({
                  organization_id: organizationId,
                  owner_user_id: user.id,
                  opportunity_id: opp.id,
                  account_id: account?.id,
                  title,
                  type: taskTemplate.type || 'call',
                  status: 'scheduled',
                  scheduled_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
                  description: taskTemplate.description || 'Lead de alta qualidade sem atividade. Contatar imediatamente.',
                  ai_generated: true
                })
                .select()
                .single();

              if (task) tasksCreated.push(task);
            }
          }
        }
        rulesApplied.push('high_score_lead');
      }
    }

    // =============================================
    // RULE 3: Meeting Prep (prep tasks before meetings)
    // =============================================
    const meetingPrepRule = rules?.find(r => r.rule_type === 'meeting_prep');
    if (meetingPrepRule) {
      const hoursBefore = meetingPrepRule.trigger_conditions?.hours_before || 2;
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
            .ilike('title', '%Preparar%')
            .maybeSingle();

          if (!existingPrep) {
            const taskTemplate = meetingPrepRule.task_template || {};
            const meetingDate = new Date(meeting.scheduled_date);
            const prepDate = new Date(meetingDate);
            prepDate.setHours(prepDate.getHours() - hoursBefore);

            const title = (taskTemplate.title_pattern || 'Preparar reunião: {activity_title}')
              .replace('{activity_title}', meeting.title);

            const { data: task } = await supabase
              .from('activities')
              .insert({
                organization_id: organizationId,
                owner_user_id: user.id,
                opportunity_id: meeting.opportunity_id,
                title,
                type: 'task',
                status: 'scheduled',
                scheduled_date: prepDate.toISOString(),
                description: taskTemplate.description || 'Revisar histórico, preparar pontos de discussão e materiais.',
                ai_generated: true
              })
              .select()
              .single();

            if (task) tasksCreated.push(task);
          }
        }
        rulesApplied.push('meeting_prep');
      }
    }

    // =============================================
    // RULE 4: Proposal Reminder (for negotiation stage)
    // =============================================
    const proposalRule = rules?.find(r => r.rule_type === 'proposal_reminder');
    if (proposalRule || !rules?.length) {
      // Default behavior even without explicit rule
      const { data: negotiationOpps } = await supabase
        .from('opportunities')
        .select(`
          id, 
          title, 
          stage:stages!inner(name)
        `)
        .eq('organization_id', organizationId)
        .eq('owner_user_id', user.id)
        .in('status', ['open', 'in_progress', 'new'])
        .ilike('stages.name', '%negociação%');

      if (negotiationOpps && negotiationOpps.length > 0) {
        for (const opp of negotiationOpps) {
          // Check if there's already a proposal
          const { data: existingProposal } = await supabase
            .from('proposals')
            .select('id')
            .eq('opportunity_id', opp.id)
            .maybeSingle();

          const { data: existingTask } = await supabase
            .from('activities')
            .select('id')
            .eq('opportunity_id', opp.id)
            .eq('status', 'scheduled')
            .ilike('title', '%proposta%')
            .maybeSingle();

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
        rulesApplied.push('proposal_reminder');
      }
    }

    // Update rule execution stats
    if (rulesApplied.length > 0 && rules) {
      for (const ruleType of rulesApplied) {
        const rule = rules.find(r => r.rule_type === ruleType);
        if (rule) {
          await supabase
            .from('auto_tasks_rules')
            .update({
              last_executed_at: new Date().toISOString(),
              executions_count: (rule.executions_count || 0) + 1
            })
            .eq('id', rule.id);
        }
      }
    }

    // Log AI usage
    await supabase.from('ai_usage_logs').insert({
      organization_id: organizationId,
      user_id: user.id,
      feature: 'auto_task_creator',
      action: 'generate',
      model_used: 'rule_based_v1',
      tokens_total: 0,
      volts_used: 0.25,
      success: true,
      request_metadata: { 
        rules_applied: rulesApplied,
        tasks_created: tasksCreated.length
      }
    });

    console.log(`[auto-task-creator] Created ${tasksCreated.length} tasks for user ${user.id} using rules: ${rulesApplied.join(', ')}`);

    return new Response(JSON.stringify({
      success: true,
      tasks_created: tasksCreated.length,
      rules_applied: rulesApplied,
      tasks: tasksCreated.map(t => ({ id: t.id, title: t.title, type: t.type }))
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
