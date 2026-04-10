import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { agent_id, agent_version_id, section, payload } = await req.json();
    if (!agent_id || !agent_version_id || !section || !payload) {
      throw new Error('agent_id, agent_version_id, section, and payload are required');
    }

    const validSections = ['overview', 'triggers', 'tools', 'memory', 'rules', 'prompts', 'escalation'];
    if (!validSections.includes(section)) throw new Error(`Invalid section: ${section}`);

    // Check version is not published
    const { data: version, error: vErr } = await supabase
      .from('ai_agent_versions').select('is_published, organization_id')
      .eq('id', agent_version_id).single();
    if (vErr) throw vErr;
    if (version.is_published) throw new Error('Cannot edit a published version');

    const orgId = version.organization_id;

    // Get profile for audit
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('user_id', user.id).single();
    const actorId = profile?.id || null;

    let result: any = null;

    switch (section) {
      case 'overview': {
        const { error } = await supabase
          .from('ai_agents')
          .update({
            name: payload.name,
            description: payload.description,
            objective: payload.objective,
            autonomy_level: payload.autonomy_level,
            agent_scope: payload.agent_scope,
            primary_channel: payload.primary_channel,
          })
          .eq('id', agent_id);
        if (error) throw error;
        result = { updated: 'overview' };
        break;
      }

      case 'triggers': {
        // Replace all triggers for this version
        await supabase.from('ai_agent_triggers').delete().eq('agent_version_id', agent_version_id);
        if (payload.triggers && payload.triggers.length > 0) {
          const rows = payload.triggers.map((t: any) => ({
            organization_id: orgId,
            agent_id,
            agent_version_id,
            trigger_kind: t.trigger_kind,
            trigger_name: t.trigger_name,
            entity_type: t.entity_type || null,
            event_name: t.event_name || null,
            schedule_cron: t.schedule_cron || null,
            condition_json: t.condition_json || {},
            priority: t.priority ?? 100,
            is_active: t.is_active ?? true,
          }));
          const { error } = await supabase.from('ai_agent_triggers').insert(rows);
          if (error) throw error;
        }
        result = { updated: 'triggers', count: payload.triggers?.length || 0 };
        break;
      }

      case 'tools': {
        await supabase.from('ai_agent_tools').delete().eq('agent_version_id', agent_version_id);
        if (payload.tools && payload.tools.length > 0) {
          const rows = payload.tools.map((t: any) => ({
            organization_id: orgId,
            agent_id,
            agent_version_id,
            tool_id: t.tool_id,
            is_enabled: t.is_enabled ?? true,
            execution_mode: t.execution_mode || 'allowed',
            config_json: t.config_json || {},
            guardrails_json: t.guardrails_json || {},
          }));
          const { error } = await supabase.from('ai_agent_tools').insert(rows);
          if (error) throw error;
        }
        result = { updated: 'tools', count: payload.tools?.length || 0 };
        break;
      }

      case 'memory': {
        await supabase.from('ai_agent_memory_profiles').delete().eq('agent_version_id', agent_version_id);
        const { error } = await supabase.from('ai_agent_memory_profiles').insert({
          organization_id: orgId,
          agent_id,
          agent_version_id,
          short_term_enabled: payload.short_term_enabled ?? true,
          operational_memory_enabled: payload.operational_memory_enabled ?? false,
          learning_memory_enabled: payload.learning_memory_enabled ?? false,
          short_term_window: payload.short_term_window ?? 10,
          context_sources_json: payload.context_sources_json || [],
          retention_policy_json: payload.retention_policy_json || {},
        });
        if (error) throw error;
        result = { updated: 'memory' };
        break;
      }

      case 'rules': {
        await supabase.from('ai_agent_rulesets').delete().eq('agent_version_id', agent_version_id);
        const { error } = await supabase.from('ai_agent_rulesets').insert({
          organization_id: orgId,
          agent_id,
          agent_version_id,
          rules_json: payload.rules_json || [],
          business_constraints_json: payload.business_constraints_json || {},
          risk_controls_json: payload.risk_controls_json || {},
        });
        if (error) throw error;
        result = { updated: 'rules' };
        break;
      }

      case 'prompts': {
        await supabase.from('ai_agent_prompt_layers').delete().eq('agent_version_id', agent_version_id);
        const { error } = await supabase.from('ai_agent_prompt_layers').insert({
          organization_id: orgId,
          agent_id,
          agent_version_id,
          system_prompt: payload.system_prompt || null,
          role_prompt: payload.role_prompt || null,
          context_builder_prompt: payload.context_builder_prompt || null,
          deliberation_prompt: payload.deliberation_prompt || null,
          generation_prompt: payload.generation_prompt || null,
          review_prompt: payload.review_prompt || null,
          output_contract_json: payload.output_contract_json || {},
          style_rules_json: payload.style_rules_json || [],
          forbidden_patterns_json: payload.forbidden_patterns_json || [],
        });
        if (error) throw error;
        result = { updated: 'prompts' };
        break;
      }

      case 'escalation': {
        await supabase.from('ai_agent_escalation_policies').delete().eq('agent_version_id', agent_version_id);
        const { error } = await supabase.from('ai_agent_escalation_policies').insert({
          organization_id: orgId,
          agent_id,
          agent_version_id,
          escalation_mode: payload.escalation_mode || 'conditional',
          confidence_threshold: payload.confidence_threshold ?? null,
          risk_threshold: payload.risk_threshold || null,
          escalation_targets_json: payload.escalation_targets_json || [],
          approval_rules_json: payload.approval_rules_json || [],
          fallback_actions_json: payload.fallback_actions_json || [],
        });
        if (error) throw error;
        result = { updated: 'escalation' };
        break;
      }
    }

    // Audit
    await supabase.from('ai_agent_audit').insert({
      organization_id: orgId,
      agent_id,
      actor_id: actorId,
      action_type: `builder_${section}_updated`,
      payload_json: { section, version_id: agent_version_id },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
