import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Detect stale opportunities (no contact > 7 days) and create alerts
 * Runs via CRON to proactively notify salespeople about neglected deals
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[detect-stale-opportunities] Starting detection...');

  try {
    // Validate internal secret for CRON calls
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!authHeaderCheck && (!internalSecret || !expectedSecret || internalSecret !== expectedSecret)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const STALE_DAYS = 7;
    const MAX_ALERTS_PER_RUN = 50;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS);

    // Find stale opportunities
    const { data: staleOpps, error: fetchError } = await supabase
      .from('opportunities')
      .select(`
        id,
        title,
        valor_previsto,
        last_contact_date,
        days_since_contact,
        owner_user_id,
        organization_id,
        stage:stages(name),
        account:accounts(razao_social, nome_fantasia)
      `)
      .eq('status', 'open')
      .or(`last_contact_date.is.null,last_contact_date.lt.${cutoffDate.toISOString()}`)
      .limit(100);

    if (fetchError) {
      console.error('[detect-stale-opportunities] Error fetching opportunities:', fetchError);
      throw fetchError;
    }

    console.log(`[detect-stale-opportunities] Found ${staleOpps?.length || 0} stale opportunities`);

    // Filter out opportunities that already have recent alerts
    const alertsCreated: string[] = [];
    const alertsSkipped: string[] = [];

    for (const opp of (staleOpps || []).slice(0, MAX_ALERTS_PER_RUN)) {
      // Check if we already sent an alert in the last 7 days
      const { data: existingAlert } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'stale_opportunity')
        .eq('metadata->>opportunity_id', opp.id)
        .gte('created_at', cutoffDate.toISOString())
        .limit(1);

      if (existingAlert && existingAlert.length > 0) {
        alertsSkipped.push(opp.id);
        continue;
      }

      // Calculate days since contact
      const daysSinceContact = opp.last_contact_date 
        ? Math.floor((Date.now() - new Date(opp.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Create alert notification
      const account = Array.isArray(opp.account) ? opp.account[0] : opp.account;
      const stage = Array.isArray(opp.stage) ? opp.stage[0] : opp.stage;
      const accountName = account?.nome_fantasia || account?.razao_social || 'Sem conta';
      const stageName = stage?.name || 'Sem estágio';
      const valor = opp.valor_previsto 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opp.valor_previsto)
        : 'Sem valor';

      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: opp.owner_user_id,
          organization_id: opp.organization_id,
          type: 'stale_opportunity',
          title: '⚠️ Oportunidade sem contato',
          message: `A oportunidade "${opp.title}" está há ${daysSinceContact} dias sem contato. Conta: ${accountName}. Valor: ${valor}. Estágio: ${stageName}.`,
          metadata: {
            opportunity_id: opp.id,
            title: opp.title,
            account_name: accountName,
            stage_name: stageName,
            valor_previsto: opp.valor_previsto,
            days_without_contact: daysSinceContact,
            last_contact_date: opp.last_contact_date,
            action_suggested: 'Agendar follow-up ou atualizar status',
          },
        });

      if (insertError) {
        console.error(`[detect-stale-opportunities] Error creating alert for ${opp.id}:`, insertError);
        continue;
      }

      alertsCreated.push(opp.id);
      console.log(`[detect-stale-opportunities] Created alert for "${opp.title}" (${daysSinceContact} days without contact)`);
    }

    const duration = Date.now() - startTime;
    console.log(`[detect-stale-opportunities] Completed: ${alertsCreated.length} alerts created, ${alertsSkipped.length} skipped in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      total_stale: staleOpps?.length || 0,
      alerts_created: alertsCreated.length,
      alerts_skipped: alertsSkipped.length,
      duration_ms: duration,
      opportunities_alerted: alertsCreated,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[detect-stale-opportunities] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to detect stale opportunities',
      details: String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
