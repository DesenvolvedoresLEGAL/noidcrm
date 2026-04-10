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

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { agent_id, agent_version_id } = await req.json();
    if (!agent_id || !agent_version_id) throw new Error('agent_id and agent_version_id required');

    // Fetch all data in parallel
    const [agentRes, triggersRes, toolsRes, memoryRes, promptsRes, escalationRes] = await Promise.all([
      supabase.from('ai_agents').select('name, objective, agent_scope').eq('id', agent_id).single(),
      supabase.from('ai_agent_triggers').select('id').eq('agent_version_id', agent_version_id),
      supabase.from('ai_agent_tools').select('id, execution_mode, ai_tools_registry(risk_level, requires_approval_by_default)')
        .eq('agent_version_id', agent_version_id).eq('is_enabled', true),
      supabase.from('ai_agent_memory_profiles').select('*').eq('agent_version_id', agent_version_id).maybeSingle(),
      supabase.from('ai_agent_prompt_layers').select('system_prompt, deliberation_prompt, output_contract_json')
        .eq('agent_version_id', agent_version_id).maybeSingle(),
      supabase.from('ai_agent_escalation_policies').select('escalation_mode')
        .eq('agent_version_id', agent_version_id).maybeSingle(),
    ]);

    const agent = agentRes.data;
    const triggers = triggersRes.data || [];
    const tools = toolsRes.data || [];
    const prompts = promptsRes.data;
    const escalation = escalationRes.data;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Blocking errors
    if (!agent?.name) errors.push('Nome do agente é obrigatório');
    if (!agent?.objective) errors.push('Objetivo do agente é obrigatório');
    if (!agent?.agent_scope || agent.agent_scope.length === 0) errors.push('Pelo menos um escopo é necessário');
    if (triggers.length === 0) errors.push('Pelo menos um trigger é necessário');
    if (tools.length === 0) errors.push('Pelo menos uma tool habilitada é necessária');
    if (!prompts?.system_prompt) errors.push('System prompt é obrigatório');
    if (!prompts?.deliberation_prompt) errors.push('Deliberation prompt é obrigatório');
    if (!prompts?.output_contract_json || Object.keys(prompts.output_contract_json).length === 0) {
      errors.push('Output contract é obrigatório');
    }
    if (!escalation) errors.push('Política de escalonamento é obrigatória');

    // Warnings
    const highRiskTools = tools.filter((t: any) => 
      t.ai_tools_registry?.risk_level === 'high' || t.ai_tools_registry?.risk_level === 'critical'
    );
    if (highRiskTools.length > 2) warnings.push('Muitas tools de alto risco habilitadas');

    const highRiskWithoutApproval = highRiskTools.filter((t: any) => t.execution_mode === 'allowed');
    if (highRiskWithoutApproval.length > 0) {
      warnings.push('Tools de alto risco sem exigência de aprovação');
    }

    if (memoryRes.data?.learning_memory_enabled && memoryRes.data?.operational_memory_enabled) {
      warnings.push('Memória ampla habilitada pode aumentar custo por execução');
    }

    if (!prompts?.deliberation_prompt && prompts?.system_prompt) {
      // Already an error, skip
    }

    // Determine status
    let builder_status = 'incomplete';
    if (errors.length === 0 && warnings.length === 0) {
      builder_status = 'publish_ready';
    } else if (errors.length === 0) {
      builder_status = 'draft_ready';
    } else {
      builder_status = 'review_required';
    }

    // Update version
    await supabase.from('ai_agent_versions').update({
      builder_status,
      validation_json: { errors, warnings, validated_at: new Date().toISOString() },
      config_summary_json: {
        trigger_count: triggers.length,
        tool_count: tools.length,
        has_memory: !!memoryRes.data,
        has_prompts: !!prompts?.system_prompt,
        has_escalation: !!escalation,
      },
    }).eq('id', agent_version_id);

    // Audit
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
    await supabase.from('ai_agent_audit').insert({
      organization_id: agent ? (await supabase.from('ai_agents').select('organization_id').eq('id', agent_id).single()).data?.organization_id : null,
      agent_id,
      actor_id: profile?.id || null,
      action_type: 'builder_validation_run',
      payload_json: { builder_status, error_count: errors.length, warning_count: warnings.length },
    });

    return new Response(JSON.stringify({
      is_valid: errors.length === 0,
      builder_status,
      errors,
      warnings,
      summary: {
        trigger_count: triggers.length,
        tool_count: tools.length,
        has_memory: !!memoryRes.data,
        has_prompts: !!prompts?.system_prompt,
        has_escalation: !!escalation,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
