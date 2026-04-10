import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: { user }, error: authErr } = await createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (authErr || !user) throw new Error('Unauthorized');

    const { simulation_run_id, rating, feedback_type, notes } = await req.json();
    if (!simulation_run_id) throw new Error('simulation_run_id is required');

    // Get run to find org/agent/version
    const { data: run, error: runErr } = await supabase
      .from('ai_agent_simulation_runs').select('organization_id, agent_id, agent_version_id')
      .eq('id', simulation_run_id).single();
    if (runErr || !run) throw new Error('Simulation run not found');

    const { data, error } = await supabase.from('ai_agent_simulation_feedback').insert({
      organization_id: run.organization_id,
      simulation_run_id,
      agent_id: run.agent_id,
      agent_version_id: run.agent_version_id,
      user_id: user.id,
      rating,
      feedback_type: feedback_type || 'general',
      notes,
    }).select().single();
    if (error) throw error;

    // Audit
    await supabase.from('ai_agent_audit').insert({
      organization_id: run.organization_id,
      agent_id: run.agent_id,
      actor_id: user.id,
      action_type: 'simulation_feedback_submitted',
      payload_json: { simulation_run_id, rating },
    });

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
