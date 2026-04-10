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

    const { data: membership } = await supabase
      .from('organization_members').select('organization_id')
      .eq('user_id', user.id).limit(1).single();
    if (!membership) throw new Error('No organization found');

    const body = await req.json();
    const { id, name, description, scenario_type, source_type, target_entity_type, target_entity_id, input_payload_json, expected_behavior_json, expected_tools_json, expected_constraints_json } = body;

    if (id) {
      // Update
      const { data, error } = await supabase.from('ai_agent_test_scenarios').update({
        name, description, scenario_type, source_type,
        target_entity_type, target_entity_id,
        input_payload_json: input_payload_json || {},
        expected_behavior_json: expected_behavior_json || {},
        expected_tools_json: expected_tools_json || [],
        expected_constraints_json: expected_constraints_json || [],
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('organization_id', membership.organization_id).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      // Insert
      const { data, error } = await supabase.from('ai_agent_test_scenarios').insert({
        organization_id: membership.organization_id,
        created_by: user.id,
        name: name || 'Cenário sem nome',
        description, scenario_type: scenario_type || 'custom',
        source_type: source_type || 'manual_payload',
        target_entity_type, target_entity_id,
        input_payload_json: input_payload_json || {},
        expected_behavior_json: expected_behavior_json || {},
        expected_tools_json: expected_tools_json || [],
        expected_constraints_json: expected_constraints_json || [],
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
