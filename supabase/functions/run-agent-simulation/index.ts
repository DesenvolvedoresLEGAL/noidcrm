import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY = 'https://api.openai.com/v1/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: { user }, error: authErr } = await createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (authErr || !user) throw new Error('Unauthorized');

    // Resolve profile.id (profiles.id != auth.users.id in this schema)
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('user_id', user.id).maybeSingle();
    const profileId = profile?.id || null;

    const { agent_id, agent_version_id, scenario, execution_mode = 'dry_run' } = await req.json();
    if (!agent_id || !agent_version_id) throw new Error('agent_id and agent_version_id are required');

    // 1. Pre-check: load agent + version + builder config
    const [agentRes, versionRes] = await Promise.all([
      supabase.from('ai_agents').select('*').eq('id', agent_id).single(),
      supabase.from('ai_agent_versions').select('*').eq('id', agent_version_id).single(),
    ]);
    if (agentRes.error) throw agentRes.error;
    if (versionRes.error) throw versionRes.error;
    const agent = agentRes.data;
    const version = versionRes.data;

    // Get org membership
    const { data: membership } = await supabase
      .from('organization_members').select('organization_id')
      .eq('user_id', user.id).eq('organization_id', agent.organization_id).single();
    if (!membership) throw new Error('Not a member of this organization');

    // Load builder data
    const vid = version.id;
    const [triggersRes, toolsRes, memoryRes, rulesetsRes, promptsRes, escalationRes] = await Promise.all([
      supabase.from('ai_agent_triggers').select('*').eq('agent_version_id', vid),
      supabase.from('ai_agent_tools').select('*, ai_tools_registry(*)').eq('agent_version_id', vid).eq('is_enabled', true),
      supabase.from('ai_agent_memory_profiles').select('*').eq('agent_version_id', vid).maybeSingle(),
      supabase.from('ai_agent_rulesets').select('*').eq('agent_version_id', vid).maybeSingle(),
      supabase.from('ai_agent_prompt_layers').select('*').eq('agent_version_id', vid).maybeSingle(),
      supabase.from('ai_agent_escalation_policies').select('*').eq('agent_version_id', vid).maybeSingle(),
    ]);

    const triggers = triggersRes.data || [];
    const tools = toolsRes.data || [];
    const prompts = promptsRes.data;
    const escalation = escalationRes.data;
    const rulesets = rulesetsRes.data;
    const memory = memoryRes.data;

    // 2. Build context from scenario
    const scenarioInput = scenario?.input_payload_json || scenario || {};
    const contextSnapshot = {
      agent: { name: agent.name, objective: agent.objective, scope: agent.agent_scope, autonomy: agent.autonomy_level },
      scenario: scenarioInput,
      triggers_configured: triggers.length,
      tools_available: tools.map((t: any) => ({
        key: t.ai_tools_registry?.key,
        name: t.ai_tools_registry?.name,
        risk: t.ai_tools_registry?.risk_level,
        mode: t.execution_mode,
      })),
      memory_config: memory ? {
        short_term: memory.short_term_enabled,
        operational: memory.operational_memory_enabled,
        learning: memory.learning_memory_enabled,
        context_sources: memory.context_sources_json,
      } : null,
      rules: rulesets?.rules_json || [],
      escalation_mode: escalation?.escalation_mode || 'not_configured',
    };

    let deliberationResult: any = {};
    let toolPlan: any[] = [];
    let outputPreview: any = {};
    let totalTokens = 0;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (execution_mode !== 'preview_only' && LOVABLE_API_KEY && prompts?.system_prompt) {
      // 3. Deliberation via AI
      const deliberationMessages = [
        { role: 'system', content: prompts.system_prompt || 'You are an AI agent assistant.' },
        ...(prompts.deliberation_prompt ? [{ role: 'system', content: `Deliberation instructions: ${prompts.deliberation_prompt}` }] : []),
        {
          role: 'user',
          content: `Analyze this scenario and provide a structured deliberation.

CONTEXT:
${JSON.stringify(contextSnapshot, null, 2)}

RULES:
${JSON.stringify(rulesets?.rules_json || [], null, 2)}

AVAILABLE TOOLS:
${JSON.stringify(contextSnapshot.tools_available, null, 2)}

Respond ONLY with a valid JSON object with this structure:
{
  "objective": "what the agent should achieve",
  "hypothesis": "main hypothesis about the situation",
  "secondary_hypothesis": "alternative interpretation",
  "confidence_score": 0.0-1.0,
  "risk_level": "low|medium|high",
  "suggested_action": "what action to take",
  "reasoning": "step by step reasoning",
  "selected_tools": ["tool_key_1"],
  "requires_approval": true/false
}`
        },
      ];

      try {
        const aiResp = await fetch(AI_GATEWAY, {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-5-mini', messages: deliberationMessages }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          totalTokens = (aiData.usage?.total_tokens) || 0;

          try {
            const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            deliberationResult = JSON.parse(cleaned);
          } catch {
            deliberationResult = { raw_response: content, parse_error: true };
          }
        } else {
          const errText = await aiResp.text();
          deliberationResult = { error: `AI gateway error: ${aiResp.status}`, details: errText };
        }
      } catch (aiErr: any) {
        deliberationResult = { error: aiErr.message };
      }

      // 4. Tool planning
      const selectedToolKeys = deliberationResult.selected_tools || [];
      toolPlan = tools
        .filter((t: any) => selectedToolKeys.includes(t.ai_tools_registry?.key))
        .map((t: any) => ({
          tool_key: t.ai_tools_registry?.key,
          tool_name: t.ai_tools_registry?.name,
          execution_mode: t.execution_mode,
          risk_level: t.ai_tools_registry?.risk_level,
          would_be_blocked: t.execution_mode === 'blocked',
          requires_approval: t.execution_mode === 'approval_required' || t.ai_tools_registry?.requires_approval_by_default,
          guardrails: t.guardrails_json,
          simulated_payload: { action: deliberationResult.suggested_action, context: 'dry_run' },
        }));

      // If no tools matched, suggest based on deliberation
      if (toolPlan.length === 0 && deliberationResult.suggested_action) {
        toolPlan = [{ tool_key: 'none_matched', note: 'No configured tools match the suggested action', suggested_action: deliberationResult.suggested_action }];
      }

      // 5. Output preview via generation prompt
      if (prompts.generation_prompt && LOVABLE_API_KEY) {
        try {
          const genResp = await fetch(AI_GATEWAY, {
            method: 'POST',
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-5-mini',
              messages: [
                { role: 'system', content: prompts.generation_prompt },
                {
                  role: 'user',
                  content: `Based on this deliberation, generate the output preview.

DELIBERATION: ${JSON.stringify(deliberationResult)}
CONTEXT: ${JSON.stringify(scenarioInput)}
TOOLS PLANNED: ${JSON.stringify(toolPlan)}

Generate the final output as JSON with structure:
{
  "action_type": "email|note|update|suggestion",
  "content": "the generated content",
  "subject": "if email",
  "next_step": "recommended next step",
  "metadata": {}
}`
                },
              ],
            }),
          });

          if (genResp.ok) {
            const genData = await genResp.json();
            const genContent = genData.choices?.[0]?.message?.content || '';
            totalTokens += (genData.usage?.total_tokens) || 0;
            try {
              outputPreview = JSON.parse(genContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
            } catch {
              outputPreview = { raw_content: genContent };
            }
          }
        } catch {}
      }
    }

    // 6. Validation assisted
    const validationResult = runValidation(agent, version, triggers, tools, prompts, escalation, rulesets, memory, deliberationResult, toolPlan, outputPreview);

    const executionTimeMs = Date.now() - startTime;
    const estimatedCost = totalTokens > 0 ? totalTokens * 0.000001 : null;

    // 7. Persist simulation run
    const { data: runData, error: runErr } = await supabase.from('ai_agent_simulation_runs').insert({
      organization_id: agent.organization_id,
      agent_id,
      agent_version_id,
      executed_by: profileId,
      scenario_type: scenario?.scenario_type || 'manual',
      scenario_source: scenario?.source_type || 'manual',
      scenario_reference_id: scenario?.id || null,
      input_payload_json: scenarioInput,
      context_snapshot_json: contextSnapshot,
      deliberation_json: deliberationResult,
      tool_plan_json: toolPlan,
      output_preview_json: outputPreview,
      validation_result_json: validationResult,
      execution_mode,
      run_status: 'completed',
      total_tokens: totalTokens || null,
      estimated_cost: estimatedCost,
      execution_time_ms: executionTimeMs,
    }).select().single();

    if (runErr) throw runErr;

    // Persist validation report
    await supabase.from('ai_agent_validation_reports').insert({
      organization_id: agent.organization_id,
      agent_id,
      agent_version_id,
      simulation_run_id: runData.id,
      validation_type: 'assisted',
      overall_status: validationResult.overall_status,
      score: validationResult.score,
      blocking_issues_json: validationResult.blocking_issues,
      warnings_json: validationResult.warnings,
      recommendations_json: validationResult.recommendations,
      readiness_summary_json: validationResult.readiness,
      created_by: profileId,
    });

    // Audit
    await supabase.from('ai_agent_audit').insert({
      organization_id: agent.organization_id,
      agent_id,
      actor_id: profileId,
      action_type: 'simulation_completed',
      payload_json: { version_id: agent_version_id, execution_mode, run_id: runData.id, score: validationResult.score },
    });

    return new Response(JSON.stringify({
      run: runData,
      context: contextSnapshot,
      deliberation: deliberationResult,
      tool_plan: toolPlan,
      output_preview: outputPreview,
      validation: validationResult,
      execution_time_ms: executionTimeMs,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Simulation error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function runValidation(
  agent: any, version: any, triggers: any[], tools: any[],
  prompts: any, escalation: any, rulesets: any, memory: any,
  deliberation: any, toolPlan: any[], output: any
) {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Config score (20%)
  let configScore = 0;
  if (agent.objective) configScore += 4;
  else blockingIssues.push('Agente sem objetivo definido');
  if (agent.agent_scope?.length > 0) configScore += 3;
  else blockingIssues.push('Agente sem escopo definido');
  if (triggers.length > 0) configScore += 3;
  else blockingIssues.push('Nenhum trigger configurado');
  if (tools.length > 0) configScore += 3;
  else blockingIssues.push('Nenhuma tool habilitada');
  if (prompts?.system_prompt) configScore += 4;
  else blockingIssues.push('System prompt ausente');
  if (prompts?.deliberation_prompt) configScore += 3;
  else warnings.push('Deliberation prompt ausente');

  // Coherence score (25%)
  let coherenceScore = 0;
  if (deliberation && !deliberation.error && !deliberation.parse_error) {
    if (deliberation.objective) coherenceScore += 6;
    if (deliberation.reasoning) coherenceScore += 6;
    if (deliberation.confidence_score != null) coherenceScore += 5;
    if (deliberation.suggested_action) coherenceScore += 4;
    if (deliberation.risk_level) coherenceScore += 4;
  } else if (deliberation?.error) {
    warnings.push('Erro na deliberação do agente — verifique os prompts');
  }

  // Security score (25%)
  let securityScore = 15; // start generous
  const highRiskTools = tools.filter((t: any) =>
    t.ai_tools_registry?.risk_level === 'high' || t.ai_tools_registry?.risk_level === 'critical'
  );
  const unguardedHighRisk = highRiskTools.filter((t: any) => t.execution_mode === 'allowed');
  if (unguardedHighRisk.length > 0) {
    securityScore -= 5;
    warnings.push(`${unguardedHighRisk.length} tool(s) de alto risco sem exigência de aprovação`);
  }
  if (agent.autonomy_level === 'autonomous' && (!escalation || escalation.escalation_mode === 'never')) {
    securityScore -= 5;
    warnings.push('Autonomia alta sem política de escalonamento');
  }
  if (escalation) securityScore += 5;
  else warnings.push('Política de escalonamento não configurada');
  if (rulesets?.rules_json?.length > 0) securityScore += 5;
  else recommendations.push('Adicione regras operacionais para maior controle');

  // Quality score (20%)
  let qualityScore = 0;
  if (output && !output.raw_content && output.action_type) qualityScore += 8;
  else if (output?.raw_content) { qualityScore += 4; warnings.push('Output não estruturado — ajuste o generation prompt'); }
  if (prompts?.review_prompt) qualityScore += 4;
  else recommendations.push('Adicione um review prompt para auto-revisão');
  if (prompts?.output_contract_json && Object.keys(prompts.output_contract_json).length > 0) qualityScore += 4;
  else recommendations.push('Defina um contrato de saída (output contract)');
  if (output?.next_step) qualityScore += 4;

  // Completeness score (10%)
  let completenessScore = 0;
  if (memory) completenessScore += 3;
  else recommendations.push('Configure a memória do agente');
  if (prompts?.role_prompt) completenessScore += 2;
  if (prompts?.context_builder_prompt) completenessScore += 2;
  if (prompts?.generation_prompt) completenessScore += 3;
  else warnings.push('Generation prompt ausente');

  const score = Math.min(100, Math.max(0, configScore + coherenceScore + securityScore + qualityScore + completenessScore));
  let overallStatus: string;
  if (blockingIssues.length > 0) overallStatus = 'blocked';
  else if (score >= 85) overallStatus = 'passed';
  else overallStatus = 'review_required';

  return {
    score,
    overall_status: overallStatus,
    blocking_issues: blockingIssues,
    warnings,
    recommendations,
    readiness: {
      config_score: configScore,
      coherence_score: coherenceScore,
      security_score: securityScore,
      quality_score: qualityScore,
      completeness_score: completenessScore,
      has_objective: !!agent.objective,
      has_triggers: triggers.length > 0,
      has_tools: tools.length > 0,
      has_prompts: !!prompts?.system_prompt,
      has_escalation: !!escalation,
      has_memory: !!memory,
      has_rules: (rulesets?.rules_json?.length || 0) > 0,
    },
  };
}
