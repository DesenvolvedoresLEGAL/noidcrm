import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[daily-vibe-check] Starting daily vibe analysis...');

    // Get all open opportunities with emotional memory
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        id, title, organization_id, owner_user_id,
        account:accounts(razao_social)
      `)
      .eq('status', 'open')
      .is('deleted_at', null);

    if (oppError) throw oppError;

    // Get emotional memories
    const oppIds = opportunities?.map(o => o.id) || [];
    const { data: memories } = await supabase
      .from('lead_emotional_memory')
      .select('*')
      .in('opportunity_id', oppIds);

    const memoryMap = new Map(memories?.map(m => [m.opportunity_id, m]) || []);

    // Generate alerts for deals needing attention
    const alertsToCreate: any[] = [];
    const now = new Date();

    for (const opp of opportunities || []) {
      const memory = memoryMap.get(opp.id);
      if (!memory) continue;

      const vibeState = memory.last_emotional_state;
      const riskLevel = memory.risk_of_vibe_break;

      // Hot timing alert
      if (vibeState === 'em_decisao' || vibeState === 'pronto_inseguro') {
        alertsToCreate.push({
          organization_id: opp.organization_id,
          opportunity_id: opp.id,
          user_id: opp.owner_user_id,
          alert_type: 'hot_timing',
          title: 'Timing favorável para fechar',
          message: `${opp.title} está em momento quente`,
          recommendation: 'Aproveite a energia alta para avançar a negociação',
          priority: 'high',
          status: 'active',
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
        });
      }

      // Risk alert
      if (riskLevel === 'high' || riskLevel === 'critical') {
        alertsToCreate.push({
          organization_id: opp.organization_id,
          opportunity_id: opp.id,
          user_id: opp.owner_user_id,
          alert_type: 'energy_drop',
          title: 'Atenção: risco de perder o deal',
          message: `${opp.title} precisa de atenção imediata`,
          recommendation: 'Considere uma abordagem de acolhimento',
          priority: 'urgent',
          status: 'active',
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }

    // Insert alerts
    if (alertsToCreate.length > 0) {
      const { error: alertError } = await supabase
        .from('vibe_alerts')
        .insert(alertsToCreate);

      if (alertError) {
        console.error('[daily-vibe-check] Error creating alerts:', alertError);
      }
    }

    console.log(`[daily-vibe-check] Created ${alertsToCreate.length} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsCreated: alertsToCreate.length,
        dealsAnalyzed: opportunities?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[daily-vibe-check] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
