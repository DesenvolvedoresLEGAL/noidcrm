import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.76.1/cors';

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

    const { agent_id, source_version_id } = await req.json();
    if (!agent_id || !source_version_id) throw new Error('agent_id and source_version_id required');

    // Get source version
    const { data: source, error: srcErr } = await supabase
      .from('ai_agent_versions').select('*').eq('id', source_version_id).single();
    if (srcErr) throw srcErr;

    // Get max version number
    const { data: maxV } = await supabase
      .from('ai_agent_versions').select('version_number')
      .eq('agent_id', agent_id).order('version_number', { ascending: false }).limit(1).single();
    const newVersionNumber = (maxV?.version_number || 0) + 1;

    // Create new version
    const { data: newVersion, error: nvErr } = await supabase
      .from('ai_agent_versions').insert({
        agent_id,
        organization_id: source.organization_id,
        version_number: newVersionNumber,
        config_json: source.config_json,
        prompt_system: source.prompt_system,
        prompt_deliberation: source.prompt_deliberation,
        prompt_generation: source.prompt_generation,
        prompt_review: source.prompt_review,
        is_active: false,
        is_published: false,
        environment: 'draft',
        change_summary: `Duplicada da v${source.version_number}`,
        builder_status: 'incomplete',
      }).select().single();
    if (nvErr) throw nvErr;

    const nvId = newVersion.id;
    const orgId = source.organization_id;

    // Copy triggers, tools, memory, rulesets, prompts, escalation in parallel
    const [triggers, tools, memory, rulesets, promptLayers, escalation] = await Promise.all([
      supabase.from('ai_agent_triggers').select('*').eq('agent_version_id', source_version_id),
      supabase.from('ai_agent_tools').select('*').eq('agent_version_id', source_version_id),
      supabase.from('ai_agent_memory_profiles').select('*').eq('agent_version_id', source_version_id).maybeSingle(),
      supabase.from('ai_agent_rulesets').select('*').eq('agent_version_id', source_version_id).maybeSingle(),
      supabase.from('ai_agent_prompt_layers').select('*').eq('agent_version_id', source_version_id).maybeSingle(),
      supabase.from('ai_agent_escalation_policies').select('*').eq('agent_version_id', source_version_id).maybeSingle(),
    ]);

    const copyOps = [];

    if (triggers.data && triggers.data.length > 0) {
      copyOps.push(supabase.from('ai_agent_triggers').insert(
        triggers.data.map(({ id, created_at, updated_at, ...t }: any) => ({ ...t, agent_version_id: nvId }))
      ));
    }
    if (tools.data && tools.data.length > 0) {
      copyOps.push(supabase.from('ai_agent_tools').insert(
        tools.data.map(({ id, created_at, updated_at, ...t }: any) => ({ ...t, agent_version_id: nvId }))
      ));
    }
    if (memory.data) {
      const { id, created_at, updated_at, ...m } = memory.data as any;
      copyOps.push(supabase.from('ai_agent_memory_profiles').insert({ ...m, agent_version_id: nvId }));
    }
    if (rulesets.data) {
      const { id, created_at, updated_at, ...r } = rulesets.data as any;
      copyOps.push(supabase.from('ai_agent_rulesets').insert({ ...r, agent_version_id: nvId }));
    }
    if (promptLayers.data) {
      const { id, created_at, updated_at, ...p } = promptLayers.data as any;
      copyOps.push(supabase.from('ai_agent_prompt_layers').insert({ ...p, agent_version_id: nvId }));
    }
    if (escalation.data) {
      const { id, created_at, updated_at, ...e } = escalation.data as any;
      copyOps.push(supabase.from('ai_agent_escalation_policies').insert({ ...e, agent_version_id: nvId }));
    }

    await Promise.all(copyOps);

    // Audit
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
    await supabase.from('ai_agent_audit').insert({
      organization_id: orgId,
      agent_id,
      actor_id: profile?.id || null,
      action_type: 'builder_version_duplicated',
      payload_json: { source_version_id, new_version_id: nvId, new_version_number: newVersionNumber },
    });

    return new Response(JSON.stringify({ version: newVersion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
