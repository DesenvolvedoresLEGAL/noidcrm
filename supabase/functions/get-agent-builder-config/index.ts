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

    const { agent_id, version_id } = await req.json();
    if (!agent_id) throw new Error('agent_id is required');

    // Get agent
    const { data: agent, error: agentErr } = await supabase
      .from('ai_agents').select('*').eq('id', agent_id).single();
    if (agentErr) throw agentErr;

    // Get version (specific or active draft)
    let version;
    if (version_id) {
      const { data, error } = await supabase
        .from('ai_agent_versions').select('*').eq('id', version_id).single();
      if (error) throw error;
      version = data;
    } else {
      // Get latest draft version
      const { data, error } = await supabase
        .from('ai_agent_versions').select('*')
        .eq('agent_id', agent_id)
        .eq('is_published', false)
        .order('version_number', { ascending: false })
        .limit(1).maybeSingle();
      if (error) throw error;
      if (!data) {
        // Fall back to active version
        const { data: active, error: ae } = await supabase
          .from('ai_agent_versions').select('*')
          .eq('agent_id', agent_id).eq('is_active', true).maybeSingle();
        if (ae) throw ae;
        version = active;
      } else {
        version = data;
      }
    }

    if (!version) {
      return new Response(JSON.stringify({ error: 'No version found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vid = version.id;

    // Fetch all builder data in parallel
    const [triggers, tools, memory, rulesets, prompts, escalation] = await Promise.all([
      supabase.from('ai_agent_triggers').select('*').eq('agent_version_id', vid).order('priority'),
      supabase.from('ai_agent_tools').select('*, ai_tools_registry(*)').eq('agent_version_id', vid),
      supabase.from('ai_agent_memory_profiles').select('*').eq('agent_version_id', vid).maybeSingle(),
      supabase.from('ai_agent_rulesets').select('*').eq('agent_version_id', vid).maybeSingle(),
      supabase.from('ai_agent_prompt_layers').select('*').eq('agent_version_id', vid).maybeSingle(),
      supabase.from('ai_agent_escalation_policies').select('*').eq('agent_version_id', vid).maybeSingle(),
    ]);

    return new Response(JSON.stringify({
      agent,
      version,
      triggers: triggers.data || [],
      tools: tools.data || [],
      memory: memory.data || null,
      rulesets: rulesets.data || null,
      prompts: prompts.data || null,
      escalation: escalation.data || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
